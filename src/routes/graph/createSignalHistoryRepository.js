import fs from "node:fs/promises";

function isValidPoint(item) {
    return (
        item &&
        typeof item === "object" &&
        Number.isFinite(item.ts) &&
        typeof item.variable === "string" &&
        item.variable.length > 0 &&
        Number.isFinite(item.value)
    );
}

export function createSignalHistoryRepository({ filePath }) {
    let cache = null;

    async function readFileItems() {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);

        const items = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.items)
              ? parsed.items
              : null;

        if (!items) {
            throw new Error("signal history file has invalid format");
        }

        const normalized = items.filter(isValidPoint);

        normalized.sort((a, b) => {
            if (a.ts !== b.ts) return a.ts - b.ts;
            return a.variable.localeCompare(b.variable);
        });

        return normalized;
    }

    return {
        async load() {
            if (cache) return cache;
            cache = await readFileItems();
            return cache;
        },

        async reload() {
            cache = await readFileItems();
            return cache;
        },

        clearCache() {
            cache = null;
        },
    };
}