function randomTimestampBetween(fromMs, toMs) {
    return fromMs + Math.floor(Math.random() * (toMs - fromMs + 1));
}

function encodeCursor(payload) {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function toTimestampMs(value, fallbackMs = Date.now()) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Date.parse(value);

        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallbackMs;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
    fractionalSecondDigits: 3,
});

function formatJournalDate(value) {
    if (!value) return "";
    return dateFormatter.format(new Date(value));
}

function getActorText(actor) {
    if (!actor) return "";
    return actor.name || actor.login || actor.id || "";
}

function getAckByText(ack) {
    if (!ack?.by) return "";
    return ack.by.name || ack.by.login || ack.by.id || "";
}

function normalizeEvent(rawEvent, rts) {
    const ts = toTimestampMs(rawEvent?.ts, rts);

    return {
        id: typeof rawEvent?.id === "string" ? rawEvent.id : uuidv7(),
        event: rawEvent?.event ?? "unknown",
        category:
            rawEvent?.category ?? rawEvent?.event?.split(".")?.[0] ?? "system",
        severity: rawEvent?.severity ?? "info",
        message: rawEvent?.message ?? "",
        ...rawEvent,
        ts,
        tsText: formatJournalDate(ts),
        ackTimeText: rawEvent.ack?.at ? formatJournalDate(rawEvent.ack.at) : "",
        actorText: getActorText(rawEvent.actor),
        ackByText: getAckByText(rawEvent.ack),
    };
}

function compareEventsDesc(a, b) {
    if (a.ts !== b.ts) {
        return b.ts - a.ts;
    }

    return String(b.id).localeCompare(String(a.id));
}

function isBeforeCursor(event, cursor) {
    if (!cursor) return true;

    if (event.ts < cursor.ts) return true;
    if (event.ts > cursor.ts) return false;

    return String(event.id) < String(cursor.id);
}

function matchesFilters(event, severityList, categoryList) {
    const severityOk =
        severityList.length === 0 ||
        severityList.includes(String(event.severity));

    const categoryOk =
        categoryList.length === 0 ||
        categoryList.includes(String(event.category));

    return severityOk && categoryOk;
}

export function buildMockJournalItems({
    fromMs,
    toMs,
    limit,
    beforeCursor,
    severityList,
    categoryList,
}) {
    // Для мока генерируем с запасом, чтобы после фильтрации хватило элементов.
    const batchSize = Math.min(Math.max(limit * 5, 100), 2000);

    const generated = Array.from({ length: batchSize }, () => {
        const ts = randomTimestampBetween(fromMs, toMs);
        const rawEvent = generateJournalMessage();

        return normalizeEvent(rawEvent, ts);
    });

    const filtered = generated
        .filter((event) => matchesFilters(event, severityList, categoryList))
        .sort(compareEventsDesc)
        .filter((event) => isBeforeCursor(event, beforeCursor));

    const items = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    const lastItem = items[items.length - 1] ?? null;

    return {
        items,
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