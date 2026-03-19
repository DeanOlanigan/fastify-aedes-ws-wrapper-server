import { v7 as uuidv7 } from "uuid";
import { requireAuth, requireRight } from "../../services/auth-guards.js";
import { createJournalService } from "./journalService.js";
import { parseJournalQuery } from "./parseJournalQuery.js";

function normalizeOptionalString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
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

    const journalService = createJournalService({
        filePath: "./data/db/journal_mock.json",
    });

    fastify.get("/api/v2/journal", async (req, reply) => {

        try {
            const query = parseJournalQuery(req.query ?? {});
            const result = await journalService.query(query);

            return reply.send({
                items: result.items,
                page: {
                    limit: query.limit,
                    hasMore: result.hasMore,
                    nextBefore: result.nextBefore,
                },
                filters: {
                    from: new Date(query.fromMs).toISOString(),
                    to: new Date(query.toMs).toISOString(),
                    severity: query.severityList,
                    category: query.categoryList,
                },
            });
        } catch (error) {
            if (error?.statusCode) {
                return reply.code(error.statusCode).send({
                    error: error.message,
                });
            }

            req.log.error(error);
            return reply.code(500).send({
                error: "internal error",
            });
        }
    });
}
