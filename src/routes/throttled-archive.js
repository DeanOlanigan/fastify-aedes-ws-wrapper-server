import { Transform } from "node:stream";
import { promises as fs } from "fs";
import archiver from "archiver";
import path from "path";

const BASE_PATH = path.resolve("./src/data");

export default async function throttledArchiveRoutes(fastify) {
    fastify.get("/api/v2/archive", async (req, reply) => {
        const q = req.query.items;
        const items = Array.isArray(q) ? q : [q];

        const filename = `archive_${new Date()
            .toISOString()
            .replace(/:/g, "_")}.zip`;

        reply.raw.setTimeout(0);
        reply
            .header("Content-Type", "application/zip")
            .header(
                "Content-Disposition",
                `attachment; filename="${filename}"`
            );

        const archive = archiver("zip", {
            zlib: { level: 6 },
        });

        const slow = slowDownStream(10, 1024 * 100);
        archive.on("error", (err) => reply.raw.destroy(err));
        archive.pipe(slow).pipe(reply.raw);

        for (const item of items) {
            try {
                const fullPath = path.resolve(BASE_PATH, item);
                const stat = await fs.stat(fullPath).catch(() => null);
                if (stat?.isFile()) {
                    archive.file(fullPath, {
                        name: item,
                    });
                }
            } catch (err) {
                req.log.warn({ err }, "Can't add file to archive");
            }
        }

        await archive.finalize();
    });
}

function slowDownStream(delayMs = 10, chunkSize = 256) {
    return new Transform({
        transform(chunk, encoding, callback) {
            const buffer = Buffer.from(chunk);
            let offset = 0;

            const pushNext = () => {
                if (offset >= buffer.length) return callback();
                const end = Math.min(offset + chunkSize, buffer.length);
                this.push(buffer.slice(offset, end));
                offset = end;
                setTimeout(pushNext, delayMs);
            };

            pushNext();
        },
    });
}
