import {
    startDemoPublishers,
    stopDemoPublishers,
} from "../broker/demo/publishers.js";
import { requireAuth, requireRight } from "../services/auth-guards.js";

export default async function appRoutes(fastify) {
    // GET /api/v2/system/version
    fastify.get("/api/v2/system/version", async (_, reply) => {
        return reply.send({
            version: "1.99.999",
        });
    });
    // POST /api/v2/system/start
    fastify.post(
        "/api/v2/system/start",
        {
            preHandler: [requireAuth, requireRight("server.start")],
        },
        async (_, reply) => {
            startDemoPublishers(fastify.mqttBroker);
            return reply.code(204).send();
        },
    );
    // POST /api/v2/system/stop
    fastify.post(
        "/api/v2/system/stop",
        {
            preHandler: [requireAuth, requireRight("server.stop")],
        },
        async (_, reply) => {
            stopDemoPublishers();
            return reply.code(204).send();
        },
    );
    // POST /api/v2/system/restart
    fastify.post(
        "/api/v2/system/restart",
        {
            preHandler: [requireAuth, requireRight("server.restart")],
        },
        async (_, reply) => {
            return reply.code(204).send();
        },
    );
}
