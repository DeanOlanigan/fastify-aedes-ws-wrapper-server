import { v7 as uuidv7 } from "uuid";
import { ERROR_CODES } from "../../errorCodes.js";
import { requireAuth, requireRight } from "../../services/auth-guards.js";
import { createJournalService } from "./journalService.js";
import { parseJournalQuery } from "./parseJournalQuery.js";

export default async function journalRoutes(fastify) {
    fastify.post(
        "/api/v2/journal/ack/event",
        {
            preHandler: [requireAuth, requireRight("journal.ack")],
        },
        async (req, reply) => {
            const { eventId } = req.body ?? {};

            if (!eventId || typeof eventId !== "string") {
                return reply
                    .code(400)
                    .send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
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
                },
            };

            // Возможно стоит обрабатывать результат промиса и отправлять ответ в случае ошибки
            await fastify.commandBus.publishJournalAck(command);

            return reply.send({
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
            const { fromUTC, toUTC } = req.body ?? {};

            if (!fromUTC || typeof fromUTC !== "string") {
                return reply
                    .code(400)
                    .send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
            }

            if (!toUTC || typeof toUTC !== "string") {
                return reply
                    .code(400)
                    .send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
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
                    fromUTC,
                    toUTC,
                },
            };

            // Возможно стоит обрабатывать результат промиса и отправлять ответ в случае ошибки
            await fastify.commandBus.publishJournalAckRange(command);

            return reply.send({
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
                return reply
                    .code(400)
                    .send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
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
                    error: {
                        code: error.code || "ERROR",
                        message: error.message || "Error",
                    },
                });
            }

            fastify.log.error(error);
            return reply.code(500).send({
                error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR },
            });
        }
    });

    fastify.get("/api/v2/journal/export", async (req, reply) => {
        try {
            const query = parseJournalQuery(req.query ?? {});
            const format = req.query.format || "csv";

            const result = await journalService.query(query);

            const fileContent =
                format === "csv"
                    ? convertToCsv(result.items)
                    : JSON.stringify(result.items, null, 2);

            const fileName = `journal_export_${new Date().toISOString()}.${format === "csv" ? "csv" : "json"}`;

            return reply
                .type(format === "csv" ? "text/csv" : "application/json")
                .header(
                    "Content-Disposition",
                    `attachment; filename="${fileName}"`,
                )
                .send(fileContent);
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR },
            });
        }
    });
}

function convertToCsv(items) {
    if (!items || items.length === 0) return "";

    // Определяем заголовки.
    // Для простоты выберем основные плоские поля + развернутые вложенные.
    const headers = [
        "id",
        "ts",
        "severity",
        "category",
        "event",
        "message",
        "actor_type",
        "actor_name",
        "payload_info",
        "ack_by",
        "ack_at",
    ];

    const rows = items.map((item) => {
        return [
            item.id,
            new Date(item.ts).toISOString(),
            item.severity,
            item.category,
            item.event,
            // Экранируем кавычки в сообщении, чтобы не сломать CSV
            `"${(item.message || "").replace(/"/g, '""')}"`,
            item.actor?.type || "",
            item.actor?.name || "",
            // Payload может быть разным, приведем его к строке JSON
            `"${JSON.stringify(item.payload || {}).replace(/"/g, '""')}"`,
            item.ack?.actor?.name || "",
            item.ack?.ts ? new Date(item.ack.ts).toISOString() : "",
        ].join(",");
    });

    // Соединяем заголовки и строки с использованием BOM (для корректного открытия в Excel)
    return `\ufeff${[headers.join(","), ...rows].join("\n")}`;
}
