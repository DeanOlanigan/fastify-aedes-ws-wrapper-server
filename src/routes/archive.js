import fss from "node:fs/promises";
import { PassThrough } from "node:stream";
import archiver from "archiver";
import { safeJoinLogPath, slowDownStream } from "./utils.js";

export default async function archiveRoutes(fastify) {
    // POST /api/v2/archive
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

            archive.on("error", (err) => reply.raw.destroy(err));
            archive.pipe(reply.raw);

            for (const item of items) {
                try {
                    const fullPath = safeJoinLogPath(item.dir, item.name);
                    const stat = await fss.stat(fullPath).catch(() => null);
                    if (stat?.isFile()) {
                        archive.file(fullPath, { name: item.name });
                    }
                } catch (error) {
                    req.log.warn({ error }, "Failed to archive file");
                }
            }

            archive.finalize();
        },
    });

    // GET /api/v2/archive
    fastify.get("/api/v2/archive", async (req, reply) =>
        getArchive(false, req, reply),
    );

    // GET /api/v2/archiveThrottled
    fastify.get("/api/v2/archiveThrottled", async (req, reply) =>
        getArchive(true, req, reply),
    );
}

async function getArchive(isThrottled, req, reply) {
    const q = req.query.items;
    const items = Array.isArray(q) ? q : [q];

    const filename = `archive_${new Date()
        .toISOString()
        .replace(/:/g, "_")}.zip`;

    reply
        .type("application/zip")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .header("Cache-Control", "no-store")
        .header("Transfer-Encoding", "chunked")
        .header("X-Content-Type-Options", "nosniff");

    reply.raw.setTimeout(0);

    const out = new PassThrough();
    reply.send(out);

    const archive = archiver("zip", {
        zlib: { level: 6 },
    });
    archive.on("error", (err) => out.destroy(err));

    if (isThrottled) {
        const slow = slowDownStream(10, 1024 * 10);
        archive.pipe(slow).pipe(out);
    } else {
        archive.pipe(out);
    }

    for (const item of items) {
        try {
            const [dir, name] = item.split("/");
            const fullPath = safeJoinLogPath(dir, name);
            const stat = await fss.stat(fullPath).catch(() => null);
            if (stat?.isFile()) {
                archive.file(fullPath, {
                    name: name,
                    date: stat.mtime,
                    mode: stat.mode,
                });
            }
        } catch (error) {
            req.log.warn({ error }, "Failed to archive file");
        }
    }

    await archive.finalize();
}
