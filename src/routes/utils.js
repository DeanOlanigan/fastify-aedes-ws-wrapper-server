import path from "path";
import { Transform } from "node:stream";

export const BASE_DIR = path.resolve("./src/data/logs");
const ALLOWED_DIRS = new Set(["sd", "internal"]);

export function safeJoinLogPath(dir, name) {
    if (!ALLOWED_DIRS.has(dir)) throw new Error("Forbidden dir");
    const full = path.resolve(BASE_DIR, dir, name);
    if (!full.startsWith(path.resolve(BASE_DIR, dir))) {
        throw new Error("Path traversal detected");
    }
    return full;
}

export function send(reply, status, message, data) {
    const body = { status, message };
    if (data !== undefined) body.data = data;
    return reply.code(status).send(body);
}

export function slowDownStream(delayMs = 10, chunkSize = 256) {
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
