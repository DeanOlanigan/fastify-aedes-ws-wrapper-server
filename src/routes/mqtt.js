import {
    startDemoPublishers,
    stopDemoPublishers,
} from "../broker/demo/publishers.js";
import { requireAuth } from "../services/auth-guards.js";

export default async function mqttRoutes(fastify) {
    // GET /mqtt/demo
    fastify.put(
        "/api/v2/mqtt/demo",
        {
            preHandler: [requireAuth],
        },
        async (_, reply) => {
            startDemoPublishers(fastify.mqttBroker);
            return reply.code(204).send();
        },
    );

    // DELETE /mqtt/demo
    fastify.delete(
        "/api/v2/mqtt/demo",
        {
            preHandler: [requireAuth],
        },
        async (_, reply) => {
            stopDemoPublishers();
            return reply.code(204).send();
        },
    );

    // GET /mqtt/clients
    fastify.get(
        "/api/v2/mqtt/clients",
        {
            preHandler: [requireAuth],
        },
        async (_, reply) => {
            const list = [];
            for (const c of Object.values(fastify.mqttBroker.clients)) {
                list.push({
                    id: c.id,
                    connected: !!c.connected,
                    ip: c.conn?.remoteAddress,
                    port: c.conn?.remotePort,
                    subscriptions: c.subscriptions,
                });
            }

            return reply.send({ count: list.length, clients: list });
        },
    );
}
