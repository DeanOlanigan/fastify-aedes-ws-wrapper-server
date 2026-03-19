import { clamp, createHttpError, isValidIsoDate } from "../utils.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;

function parseCsvParam(value) {
    if (typeof value !== "string" || value.trim() === "") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function decodeCursor(cursor) {
    try {
        const raw = Buffer.from(cursor, "base64url").toString("utf8");
        const parsed = JSON.parse(raw);

        if (
            !parsed ||
            typeof parsed !== "object" ||
            typeof parsed.ts !== "number" ||
            !Number.isFinite(parsed.ts) ||
            typeof parsed.id !== "string"
        ) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}



export function parseJournalQuery(rawQuery) {
    const {
        from,
        to,
        limit: rawLimit,
        before,
        severity,
        category,
    } = rawQuery;

    if (from && !isValidIsoDate(from)) {
        throw createHttpError(400, "from is not valid ISO date");
    }

    if (to && !isValidIsoDate(to)) {
        throw createHttpError(400, "to is not valid ISO date");
    }

    const beforeCursor = before ? decodeCursor(before) : null;

    if (before && !beforeCursor) {
        throw createHttpError(400, "before is not valid cursor");
    }

    const nowMs = Date.now();
    const fromMs = from ? Date.parse(from) : nowMs - DEFAULT_RANGE_MS;
    const toMs = to ? Date.parse(to) : nowMs;

    if (fromMs > toMs) {
        throw createHttpError(400, "from > to");
    }

    const parsedLimit = Number.parseInt(rawLimit, 10);
    const limit = clamp(
        Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_LIMIT,
        1,
        MAX_LIMIT,
    );

    return {
        fromMs,
        toMs,
        limit,
        beforeCursor,
        severityList: parseCsvParam(severity),
        categoryList: parseCsvParam(category),
    };
}