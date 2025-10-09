import fss from "fs/promises";
import path from "path";
import { Transform } from "node:stream";
import { XMLParser } from "fast-xml-parser";
import crypto from "node:crypto";

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

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    allowBooleanAttributes: true,
    parseAttributeValue: true,
    parseTagValue: true,
    isArray: (tagName) => tagName === "DataObject" || tagName === "Variable",
});

export function parseConfigXml(xmlString) {
    const json = parser.parse(xmlString);

    const info = json?.Root?.ConfigInfo ?? {};
    const name = String(info.name) ?? "Unknown name";
    const editedAt = toUnixMs(info.date) ?? Date.now();
    const version = String(info.version) ?? "Unknown version";

    const variables = [];

    (function walk(node) {
        if (!node || typeof node !== "object") return;

        if (node.Variable) {
            const arr = Array.isArray(node.Variable)
                ? node.Variable
                : [node.Variable];
            for (const v of arr) {
                const id = String(v.id).trim();
                if (id && (v.Settings.archive || v.Settings.graph)) {
                    variables.push({
                        id,
                        name: String(v.name).trim(),
                        unit: String(v.Settings.measurement).trim(),
                        type: String(v.Settings.type).trim(),
                        group: String(v.Settings.group).trim(),
                    });
                }
            }
        }
        for (const val of Object.values(node)) {
            if (val && typeof val === "object") walk(val);
        }
    })(json);

    return { name, editedAt, version, variables };
}

function toUnixMs(s) {
    if (!s) return null;
    if (typeof s === "number") return s;
    const iso = String(s).replace(",", "");
    const m = iso.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (m) {
        const [, dd, MM, yyyy, hh, mm, ss] = m;
        const d = new Date(yyyy, MM - 1, dd, hh, mm, ss);
        return d.getTime();
    }
    const t = Date.parse(String(s));
    return Number.isFinite(t) ? t : null;
}

export async function applyConfig(db, cfg, appliedAt) {
    const hash = crypto
        .createHash("sha256")
        .update(JSON.stringify(cfg))
        .digest("hex");

    try {
        const dbHash = await db.get(
            "SELECT hash FROM config WHERE hash=? LIMIT 1",
            [hash]
        );
        if (dbHash?.hash) return;
    } catch (err) {
        throw err;
    }

    await db.exec("BEGIN IMMEDIATE");

    try {
        await db.run(
            `INSERT INTO config(name, edited_at, schema_version, applied_at, hash)
            VALUES (?, ?, ?, ?, ?)`,
            [cfg.name, cfg.editedAt, cfg.version, appliedAt, hash]
        );

        const { id: configId } = await db.get(
            "SELECT last_insert_rowid() AS id"
        );

        const stmtInsVar = await db.prepare(
            `INSERT INTO variable(id) VALUES (?) ON CONFLICT(id) DO NOTHING`
        );

        const stmtOpenVer = await db.prepare(
            `SELECT id, var_name, unit_code, 'group'
            FROM variable_version
            WHERE variable_id=? AND valid_to IS NULL`
        );

        const stmtCloseVer = await db.prepare(
            `UPDATE variable_version SET valid_to=? WHERE id=?`
        );

        const stmtInsVer = await db.prepare(
            `INSERT INTO variable_version(variable_id, config_id, var_name, unit_code, 'group', valid_from, valid_to)
            VALUES (?, ?, ?, ?, ?, ?, NULL)`
        );

        const stmtCurrVerId = await db.prepare(
            `SELECT id FROM variable_version WHERE variable_id=? AND valid_to IS NULL`
        );

        let insertedVars = 0,
            newVersions = 0,
            closedVersions = 0;

        for (const v of cfg.variables) {
            const r = await stmtInsVar.run(v.id);
            if (r.changes) insertedVars++;

            const open = await stmtOpenVer.get(v.id);

            const same =
                open &&
                open.var_name === v.name &&
                (open.unit_code ?? null) === (v.unit ?? null) &&
                (open.group ?? null) === (v.group ?? null);

            if (!same && open?.id) {
                await stmtCloseVer.run(appliedAt - 1, open.id);
                closedVersions += stmtCloseVer.stmt.changes ?? 0;
            }

            if (!open || !same) {
                await stmtInsVer.run(
                    v.id,
                    configId,
                    v.name,
                    v.unit ?? null,
                    v.group ?? null,
                    appliedAt
                );
                newVersions += stmtInsVer.stmt.changes ?? 0;
            }
        }

        const varVerMap = new Map();

        for (const v of cfg.variables) {
            const r = await stmtCurrVerId.get(v.id);
            if (!r) continue;
            varVerMap.set(v.id, r.id);
        }

        await stmtInsVar.finalize();
        await stmtOpenVer.finalize();
        await stmtCloseVer.finalize();
        await stmtInsVer.finalize();
        await stmtCurrVerId.finalize();

        await db.exec("COMMIT");

        return {
            configId,
            varVerMap,
            insertedVars,
            newVersions,
            closedVersions,
        };
    } catch (error) {
        await db.exec("ROLLBACK");
        throw error;
    }
}
