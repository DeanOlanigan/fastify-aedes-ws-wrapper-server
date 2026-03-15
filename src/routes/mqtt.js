import {
    startDemoPublishers,
    stopDemoPublishers,
} from "../broker/demo/publishers.js";
import { requireAuth } from "../services/auth-guards.js";

export default async function mqttRoutes(fastify) {
    // GET /mqtt/demo
    fastify.put(
        "/mqtt/demo",
        {
            preHandler: [requireAuth],
        },
        async () => {
            startDemoPublishers(fastify.mqttBroker);
            return { ok: true, ts: Date.now() };
        },
    );

    // DELETE /mqtt/demo
    fastify.delete(
        "/mqtt/demo",
        {
            preHandler: [requireAuth],
        },
        async () => {
            stopDemoPublishers();
            return { ok: true, ts: Date.now() };
        },
    );

    // GET /mqtt/clients
    fastify.get(
        "/mqtt/clients",
        {
            preHandler: [requireAuth],
        },
        async () => {
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
            return { count: list.length, clients: list };
        },
    );
}
