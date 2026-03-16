import { v7 as uuidv7 } from "uuid";
import { generateJournalMessage } from "../broker/demo/journal.new.js";
import { requireAuth, requireRight } from "../services/auth-guards.js";

function normalizeOptionalString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function isValidIsoDate(value) {
    if (typeof value !== "string" || value.trim() === "") return false;

    const time = Date.parse(value);
    return Number.isFinite(time);
}

function parseCsvParam(value) {
    if (typeof value !== "string" || value.trim() === "") return [];

    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function randomTimestampBetween(fromMs, toMs) {
    return fromMs + Math.floor(Math.random() * (toMs - fromMs + 1));
}

function encodeCursor(payload) {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
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

function buildMockJournalItems({
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

export default async function journalRoutes(fastify) {
    fastify.post(
        "/api/v2/journal/ack/event",
        {
            preHandler: [requireAuth, requireRight("journal.ack")],
        },
        async (req, reply) => {
            const { eventId, event, message } = req.body ?? {};

            if (!eventId || typeof eventId !== "string") {
                return reply.code(400).send({ error: "eventId is required" });
            }

            if (!event || typeof event !== "string") {
                return reply.code(400).send({ error: "event is required" });
            }

            const user = req.session.user;

            const command = {
                commandId: uuidv7(),
                type: "journal.ack.event",
                requestedAt: Date.now(),
                requestedBy: user
                    ? {
                          userId: user.userId,
                          login: user.login,
                          name: user.name,
                      }
                    : null,
                payload: {
                    eventId,
                    event,
                    message: normalizeOptionalString(message),
                },
            };

            // Возможно стоит обрабатывать результат промиса и отправлять ответ в случае ошибки
            await fastify.commandBus.publishJournalAck(command);

            return reply.send({
                ok: true,
                commandId: command.commandId,
            });
        },
    );

    fastify.post(
        "/api/v2/journal/ack/range",
        {
            preHandler: [requireAuth, requireRight("journal.ack")],
        },
        async (req, reply) => {
            const { fromTs, toTs } = req.body ?? {};

            if (!fromTs || typeof fromTs !== "number") {
                return reply.code(400).send({ error: "fromTs is required" });
            }

            if (!toTs || typeof toTs !== "number") {
                return reply.code(400).send({ error: "toTs is required" });
            }

            const user = req.session.user;

            const command = {
                commandId: uuidv7(),
                type: "journal.ack.range",
                requestedAt: Date.now(),
                requestedBy: user
                    ? {
                          userId: user.userId,
                          login: user.login,
                          name: user.name,
                      }
                    : null,
                payload: {
                    fromTs,
                    toTs,
                },
            };

            // Возможно стоит обрабатывать результат промиса и отправлять ответ в случае ошибки
            await fastify.commandBus.publishJournalAckRange(command);

            return reply.send({
                ok: true,
                commandId: command.commandId,
            });
        },
    );

    fastify.post(
        "/api/v2/variable/telecontrol",
        {
            preHandler: [
                requireAuth,
                requireRight("monitoring.variables.telecontrol"),
            ],
        },
        async (req, reply) => {
            const { varId, data } = req.body ?? {};

            if (!varId || typeof varId !== "string") {
                return reply.code(400).send({ error: "varId is required" });
            }

            const user = req.session.user;

            const command = {
                commandId: uuidv7(),
                type: "variable.telecontrol",
                requestedAt: Date.now(),
                requestedBy: user
                    ? {
                          userId: user.userId,
                          login: user.login,
                          name: user.name,
                      }
                    : null,
                payload: {
                    varId,
                    data,
                },
            };

            await fastify.commandBus.publishTelecontrol(varId, command);

            return reply.send({
                ok: true,
                commandId: command.commandId,
            });
        },
    );

    fastify.get("/api/v2/journal", async (req, reply) => {
        const {
            from,
            to,
            limit: rawLimit,
            before,
            severity,
            category,
        } = req.query ?? {}; // ISO 8601 formatted string in UTC

        if (from && !isValidIsoDate(from)) {
            return reply
                .code(400)
                .send({ error: "from is not valid ISO date" });
        }

        if (to && !isValidIsoDate(to)) {
            return reply.code(400).send({ error: "to is not valid ISO date" });
        }

        const beforeCursor = before ? decodeCursor(before) : null;

        if (before && !beforeCursor) {
            return reply
                .code(400)
                .send({ error: "before is not valid cursor" });
        }

        const nowMs = Date.now();
        const fromMs = from ? Date.parse(from) : nowMs - DEFAULT_RANGE_MS;
        const toMs = to ? Date.parse(to) : nowMs;

        if (fromMs > toMs) {
            return reply.code(400).send({ error: "from > to" });
        }

        const parsedLimit = Number.parseInt(rawLimit, 10);
        const limit = clamp(
            Number.isFinite(parsedLimit) ? parsedLimit : DEFAULT_LIMIT,
            1,
            MAX_LIMIT,
        );

        const severityList = parseCsvParam(severity);
        const categoryList = parseCsvParam(category);

        const result = buildMockJournalItems({
            fromMs,
            toMs,
            limit,
            beforeCursor,
            severityList,
            categoryList,
        });

        return reply.send({
            items: result.items,
            page: {
                limit,
                hasMore: result.hasMore,
                nextBefore: result.nextBefore,
            },
            filters: {
                from: new Date(fromMs).toISOString(),
                to: new Date(toMs).toISOString(),
                severity: severityList,
                category: categoryList,
            },
        });
    });
}
