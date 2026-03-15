import { v7 as uuidv7 } from "uuid";
import { requireAuth, requireRight } from "../services/auth-guards.js";

function normalizeOptionalString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

export default async function journalRoutes(fastify) {
    fastify.post(
        "/api/v2/journal/ack",
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
                type: "journal.ack",
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
}
