import fs from "fs";
import fss from "fs/promises";
import readline from "readline";
import path from "path";
import { send } from "./utils.js";
import { BASE_DIR } from "./utils.js";
import { safeJoinLogPath } from "./utils.js";

const dateFileRegex = /\.\d{8}T\d{6}\./;

export default async function logRoutes(fastify) {
    // GET /api/v2/log
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

    // GET /api/v2/logList
    fastify.get("/api/v2/loglist", async (req, reply) => {
        try {
            const [sd, internal] = await Promise.all([
                listOfFilesWithSize("sd"),
                listOfFilesWithSize("internal"),
            ]);

            return send(reply, 200, "Логи успешно получены", [
                ...sd,
                ...internal,
            ]);
        } catch (error) {
            return send(reply, 500, "Логи не получены", error);
        }
    });
}

async function listOfFilesWithSize(type) {
    const dirPath = path.resolve(BASE_DIR, type);

    const entries = await fss.readdir(dirPath, {
        withFileTypes: true,
    });

    const files = entries.filter((entry) => entry.isFile());

    const stats = await Promise.all(
        files.map(async (file) => {
            const fullPath = path.join(dirPath, file.name);
            const st = await fss.stat(fullPath);
            return {
                label: file.name,
                value: `${type}/${file.name}`,
                size: st.size,
                mtime: st.mtime,
                category: type,
            };
        })
    );

    const filtered = stats.filter((f) => !dateFileRegex.test(f.label));

    filtered.sort((a, b) => b.mtime - a.mtime);
    return filtered;
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
