import path from "path";
import {
    startDemoPublishers,
    stopDemoPublishers,
} from "../broker/demo/publishers.js";
import fss from "fs/promises";
import fs from "fs";
import readline from "readline";
import zlib from "node:zlib";
import tar from "tar-stream";
import { pipeline } from "node:stream/promises";

let tirStatus = false;
const BASE_DIR = path.resolve("./src/data/logs");
const ALLOWED_DIRS = new Set(["sd", "internal"]);

function send(reply, status, message, data) {
    const body = { status, message };
    if (data !== undefined) body.data = data;
    return reply.code(status).send(body);
}

export default async function appRoutes(fastify, opts) {
    const { broker } = opts;

    // GET /api/v1/getSoftwareVer
    fastify.get("/api/v1/softwareVer", async (req, reply) => {
        return send(reply, 200, "Success", "1.99.999");
    });

    // POST /api/v2/startTir
    fastify.post("/api/v2/startTir", async (req, reply) => {
        if (tirStatus) {
            return send(reply, 400, "ТИР уже запущен");
        }
        tirStatus = true;
        startDemoPublishers(broker);
        return send(reply, 200, "ТИР успешно запущен");
    });

    // POST /api/v2/stopTir
    fastify.post("/api/v2/stopTir", async (req, reply) => {
        if (!tirStatus) {
            return send(reply, 400, "ТИР не запущен");
        }
        tirStatus = false;

        stopDemoPublishers();
        return send(reply, 200, "ТИР успешно остановлен");
    });

    // POST /api/v2/restartTir
    fastify.post("/api/v2/restartTir", async (req, reply) => {
        return send(reply, 200, "ТИР успешно перезапущен");
    });

    // PUT /api/v2/uploadConfiguration (XML в теле запроса)
    fastify.put("/api/v2/configuration", async (req, reply) => {
        // Если пришла строка — используем её; на всякий случай поддержим и JSON { xml: "..." }
        const xml =
            typeof req.body === "string"
                ? req.body
                : typeof req.body?.xml === "string"
                ? req.body.xml
                : "";

        if (!xml || xml.trim() === "") {
            return send(reply, 400, "Bad request");
        }

        try {
            await fss.writeFile("./src/data/config.xml", xml);
            return send(reply, 200, "Конфигурация успешно сохранена");
        } catch (error) {
            return send(reply, 500, "Конфигурация не сохранена", error);
        }
    });

    // GET /api/v2/getConfiguration
    fastify.get("/api/v2/configuration", async (req, reply) => {
        try {
            const data = await fss.readFile("./src/data/config.xml", "utf-8");
            return send(reply, 200, "Конфигурация успешно получена", data);
        } catch (error) {
            return send(reply, 500, "Конфигурация не получена", error);
        }
    });

    // GET /api/v2/getLog
    fastify.get("/api/v2/log", async (req, reply) => {
        const { name, dir, format = "raw", limit } = req.query;

        let fullPath;
        try {
            fullPath = safeJoinLogPath(dir, name);
        } catch (error) {
            return send(reply, 403, "Forbidden");
        }

        const maxLimit = 5000;
        const take = Math.min(Number(limit) || 1000, maxLimit);

        try {
            await fss.access(fullPath);
        } catch (error) {
            return send(reply, 404, "Log not found");
        }

        if (format === "raw") {
            try {
                const lines = await tailLines(fullPath, take);
                const text = lines.join("\n");
                return send(reply, 200, "Лог успешно получен", text);
            } catch (error) {
                return send(reply, 500, "Лог не получен", error);
            }
        }

        if (format === "json") {
            try {
                const items = await tailLines(fullPath, take, (line) =>
                    parseLogLine(line)
                );
                return send(reply, 200, "Лог успешно получен", items);
            } catch (error) {
                return send(reply, 500, "Лог не получен", error);
            }
        }

        return send(reply, 400, "Bad request");
    });

    // GET /api/v2/getLogList
    fastify.get("/api/v2/loglist", async (req, reply) => {
        try {
            const [sd, internal] = await Promise.all([
                listOfFilesWithSize("./src/data/logs/sd"),
                listOfFilesWithSize("./src/data/logs/internal"),
            ]);

            return send(reply, 200, "Логи успешно получены", {
                sd,
                internal,
            });
        } catch (error) {
            return send(reply, 500, "Логи не получены", error);
        }
    });

    fastify.post("/api/v2/archive", {
        schema: {
            body: {
                type: "object",
                properties: {
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["name", "dir"],
                            properties: {
                                name: { type: "string" },
                                dir: { type: "string" }, // sd, internal
                            },
                        },
                    },
                },
                required: ["items"],
            },
        },
        handler: async (req, reply) => {
            const { items } = req.body;

            reply.raw.setTimeout(0);
            const filename = `archive-${new Date()
                .toISOString()
                .replace(/[:.]/g, "-")}.tar.gz`;
            reply
                .header("Content-Type", "application/gzip")
                .header(
                    "Content-Disposition",
                    `attachment; filename="${filename}"`
                );

            const pack = tar.pack();
            const gzip = zlib.createGzip({ level: 6 });

            pipeline(pack, gzip, reply.raw).catch((error) => {
                req.log.error({ error }, "pipeline error");
                reply.raw.destroy(error);
            });

            for (const item of items) {
                let fullPath;
                try {
                    fullPath = safeJoinLogPath(item.dir, item.name);
                } catch (error) {
                    req.log.warn({ err }, "Forbidden path");
                    continue;
                }

                const stat = await fss.stat(fullPath).catch(() => null);
                if (!stat || !stat.isFile()) {
                    req.log.warn({ path: fullPath }, "File not found");
                    continue;
                }

                await new Promise((resolve, reject) => {
                    const entry = pack.entry(
                        {
                            name: path.join(item.dir, item.name),
                            size: stat.size,
                            mode: stat.mode,
                            mtime: stat.mtime,
                        },
                        (err) => (err ? reject(err) : resolve())
                    );
                    fs.createReadStream(fullPath)
                        .pipe(entry)
                        .on("error", reject)
                        .on("finish", resolve);
                });
            }

            pack.finalize();
        },
    });
}

async function listOfFilesWithSize(dirPath) {
    const entries = await fss.readdir(dirPath, {
        withFileTypes: true,
    });

    const files = entries.filter((entry) => entry.isFile());

    const stats = await Promise.all(
        files.map(async (file) => {
            const fullPath = path.join(dirPath, file.name);
            const st = await fss.stat(fullPath);
            return {
                name: file.name,
                size: st.size,
                mtime: st.mtime,
            };
        })
    );

    stats.sort((a, b) => b.mtime - a.mtime);
    return stats;
}

function parseLogLine(line) {
    // [YYYY-MM-DD HH:mm:ss,SSS]  [LEVEL]  message...
    const re =
        /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),(\d{3})\]\s*\[(\w+)\]\s*(.*)$/;
    const m = line.match(re);
    if (!m) return null;

    const [, datePart, msPart, levelRaw, message] = m;
    const ts = new Date(`${datePart}.${msPart}Z`); // если локальное время — адаптируй

    const level = levelRaw.toLowerCase(); // ERROR -> error
    const levelNum = levelToNumber(level); // pino-like

    return {
        ts: ts.toISOString(),
        epochMs: ts.getTime(),
        level,
        levelNum,
        message,
    };
}

function levelToNumber(level) {
    switch (level) {
        case "fatal":
            return 60;
        case "error":
            return 50;
        case "warn":
            return 40;
        case "info":
            return 30;
        case "debug":
            return 20;
        case "trace":
            return 10;
        default:
            return 30;
    }
}

function safeJoinLogPath(dir, name) {
    if (!ALLOWED_DIRS.has(dir)) throw new Error("Forbidden dir");
    const full = path.resolve(BASE_DIR, dir, name);
    if (!full.startsWith(path.resolve(BASE_DIR, dir))) {
        throw new Error("Path traversal detected");
    }
    return full;
}

async function tailLines(filePath, limit, mapFn) {
    if (limit <= 0) return [];

    const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const buf = new Array(limit);
    let count = 0;
    let idx = 0;

    for await (const line of rl) {
        if (!line) continue;

        const value = mapFn ? mapFn(line) : line;
        if (mapFn && value == null) continue;

        buf[idx] = value;
        idx = (idx + 1) % limit;
        count++;
    }

    rl.close();

    const take = Math.min(count, limit);
    const start = count >= limit ? idx : 0;
    const out = new Array(take);
    for (let i = 0; i < take; i++) {
        out[i] = buf[(start + i) % limit];
    }
    return out;
}
