import fss from "fs/promises";
import path from "path";
import { Transform } from "node:stream";

export const BASE_DIR = path.resolve("./src/data/logs");

const ALLOWED_DIRS = new Set(["sd", "internal"]);
const dateFileRegex = /\.\d{8}T\d{6}\./;

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

export async function listOfFilesWithSize(type) {
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

export function levelToNumber(level) {
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
