import fs from "node:fs";
import fss from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import archiver from "archiver";
import { ERROR_CODES } from "../errorCodes.js";
import { levelToNumber, listOfFilesWithSize } from "./utils.js";

export default async function logRoutes(fastify) {
    // GET /api/v2/logs/:name?limit=100
    fastify.get("/api/v2/logs/:name", async (req, reply) => {
        const { name } = req.params;
        const { limit } = req.query;

        const logPath = path.resolve("data/logs", name);

        const maxLimit = 5000;
        const take = Math.min(Number(limit) || 1000, maxLimit);

        try {
            await fss.access(logPath);
        } catch {
            return reply
                .code(404)
                .send({ error: { code: ERROR_CODES.NOT_FOUND } });
        }

        try {
            const items = await tailLines(logPath, take, (line) =>
                parseLogLine(line),
            );
            return reply.send({ items });
        } catch (error) {
            fastify.log.error(error);
            return reply
                .code(500)
                .send({ error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR } });
        }
    });

    // GET /api/v2/logs
    fastify.get("/api/v2/logs", async (_, reply) => {
        try {
            const [sd] = await Promise.all([listOfFilesWithSize()]);

            return reply.send({ items: sd });
        } catch (error) {
            fastify.log.error(error);
            return reply
                .code(500)
                .send({ error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR } });
        }
    });

    // POST /api/v2/logs/export
    fastify.post("/api/v2/logs/export", {
        schema: {
            body: {
                type: "object",
                properties: {
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["name"],
                            properties: {
                                name: { type: "string" },
                            },
                        },
                    },
                },
                required: ["items"],
            },
        },
        handler: async (req, reply) => {
            const { items } = req.body;

            const filename = `archive_${new Date()
                .toISOString()
                .replace(/:/g, "_")}.zip`;

            reply.raw.setTimeout(0);
            reply
                .header("Content-Type", "application/zip")
                .header(
                    "Content-Disposition",
                    `attachment; filename="${filename}"`,
                );

            const archive = archiver("zip", {
                zlib: { level: 6 },
            });

            archive.on("error", (err) => {
                req.log.error({ err }, "Archive error");
                if (!reply.raw.writableEnded) {
                    reply.raw.destroy(err);
                }
            });

            reply.send(archive);

            for (const item of items) {
                try {
                    const fullPath = path.resolve("data/logs", item.name);
                    const stat = await fss.stat(fullPath).catch(() => null);
                    if (stat?.isFile()) {
                        archive.file(fullPath, {
                            name: item.name,
                            date: stat.mtime,
                        });
                    }
                } catch (error) {
                    req.log.warn(
                        { error, item: item.name },
                        "Failed to archive file",
                    );
                }
            }

            await archive.finalize();
        },
    });
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
