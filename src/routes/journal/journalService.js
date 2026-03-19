import fs from "node:fs/promises";

function compareEventsDesc(a, b) {
    if (a.ts !== b.ts) {
        return b.ts - a.ts;
    }

    return String(b.id).localeCompare(String(a.id));
}

function matchesFilters(event, severityList, categoryList) {
    const severityOk =
        !severityList?.length || severityList.includes(event.severity);

    const categoryOk =
        !categoryList?.length || categoryList.includes(event.category);

    return categoryOk && severityOk;
}

function isBeforeCursor(event, beforeCursor) {
    if (!beforeCursor) return true;

    if (event.ts < beforeCursor.ts) return true;
    if (event.ts > beforeCursor.ts) return false;

    return String(event.id) < String(beforeCursor.id);
}

function encodeCursor({ ts, id }) {
    return Buffer.from(JSON.stringify({ ts, id })).toString("base64url");
}

async function readJournalFile(filePath) {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.items)) return parsed.items;

    throw new Error("journal file has invalid format");
}

function queryJournalItems(items, query) {
    const filtered = items
        .filter((event) => event.ts >= query.fromMs && event.ts <= query.toMs)
        .filter((event) =>
            matchesFilters(event, query.severityList, query.categoryList),
        )
        .sort(compareEventsDesc)
        .filter((event) => isBeforeCursor(event, query.beforeCursor));

    const pageItems = filtered.slice(0, query.limit);
    const hasMore = filtered.length > query.limit;
    const lastItem = pageItems[pageItems.length - 1] ?? null;

    return {
        items: pageItems,
        hasMore,
        nextBefore:
            hasMore && lastItem
                ? encodeCursor({
                      ts: lastItem.ts,
                      id: lastItem.id,
                  })
                : null,
    };
}

export function createJournalService({ filePath }) {
    let cache = null;

    return {

        async load() {
            if (cache) return cache;
            cache = await readJournalFile(filePath);
            return cache;
        },

        async reload() {
            cache = await readJournalFile(filePath);
            return cache;
        },

        async query(query) {
            const items = await this.load();
            return queryJournalItems(items, query);
        },
    };
}