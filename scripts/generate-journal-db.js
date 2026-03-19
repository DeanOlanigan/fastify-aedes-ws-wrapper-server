#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { generateJournalMessage } from "../src/broker/demo/journal.new.js";

function randomTimestampBetween(fromMs, toMs) {
    return fromMs + Math.floor(Math.random() * (toMs - fromMs + 1));
}

function compareEventsAsc(a, b) {
    if (a.ts !== b.ts) return a.ts - b.ts;
    return String(a.id).localeCompare(String(b.id));
}

function compareEventsDesc(a, b) {
    if (b.ts !== a.ts) return b.ts - a.ts;
    return String(b.id).localeCompare(String(a.id));
}

function buildMockJournalDb({
    fromMs,
    toMs,
    count,
    sort = "asc",
}) {
    const items = Array.from({ length: count }, () => {
        const ts = randomTimestampBetween(fromMs, toMs);
        return generateJournalMessage(ts);
    });

    items.sort(sort === "desc" ? compareEventsDesc : compareEventsAsc);

    return items;
}

function parseArgs(argv) {
    const args = {
        out: "./mock-journal-db.json",
        count: 1000,
        days: 7,
        format: "json",
        sort: "asc",
        from: null,
        to: null,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === "--out") {
            args.out = argv[++i];
        } else if (arg === "--count") {
            args.count = Number(argv[++i]);
        } else if (arg === "--days") {
            args.days = Number(argv[++i]);
        } else if (arg === "--format") {
            args.format = argv[++i];
        } else if (arg === "--sort") {
            args.sort = argv[++i];
        } else if (arg === "--from") {
            args.from = argv[++i];
        } else if (arg === "--to") {
            args.to = argv[++i];
        }
    }

    return args;
}

function resolveRange({ from, to, days }) {
    const now = Date.now();

    const toMs = to ? new Date(to).getTime() : now;
    const fromMs = from
        ? new Date(from).getTime()
        : toMs - days * 24 * 60 * 60 * 1000;

    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
        throw new Error("Некорректные значения --from или --to");
    }

    if (fromMs > toMs) {
        throw new Error("--from не может быть больше --to");
    }

    return { fromMs, toMs };
}

async function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filePath, items, meta) {
    const payload = {
        schemaVersion: 1,
        generatedAt: Date.now(),
        meta,
        items,
    };

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function writeJsonl(filePath, items) {
    const content = items.map((item) => JSON.stringify(item)).join("\n") + "\n";
    await fs.writeFile(filePath, content, "utf8");
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const { fromMs, toMs } = resolveRange(args);

    const items = buildMockJournalDb({
        fromMs,
        toMs,
        count: args.count,
        sort: args.sort,
    });

    await ensureDir(args.out);

    const meta = {
        fromMs,
        toMs,
        count: items.length,
        format: args.format,
        sort: args.sort,
    };

    if (args.format === "jsonl") {
        await writeJsonl(args.out, items);
    } else {
        await writeJson(args.out, items, meta);
    }

    console.log(`Готово. Сгенерировано ${items.length} событий: ${args.out}`);
}

main().catch((error) => {
    console.error("Ошибка генерации mock journal db:");
    console.error(error);
    process.exit(1);
});