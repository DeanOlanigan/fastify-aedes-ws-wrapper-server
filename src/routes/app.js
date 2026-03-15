import {
    startDemoPublishers,
    stopDemoPublishers,
} from "../broker/demo/publishers.js";
import { requireAuth, requireRight } from "../services/auth-guards.js";
import { send } from "./utils.js";

let tirStatus = false;

export default async function appRoutes(fastify) {
    // GET /api/v1/getSoftwareVer
    fastify.get("/api/v1/softwareVer", async (_, reply) => {
        return send(reply, 200, "Success", "1.99.999");
    });
    // POST /api/v2/startTir
    fastify.post(
        "/api/v2/startTir",
        {
            preHandler: [requireAuth, requireRight("server.start")],
        },
        async (_, reply) => {
            if (tirStatus) {
                return send(reply, 400, "ТИР уже запущен");
            }
            tirStatus = true;
            startDemoPublishers(fastify.mqttBroker);
            return send(reply, 200, "ТИР успешно запущен");
        },
    );
    // POST /api/v2/stopTir
    fastify.post(
        "/api/v2/stopTir",
        {
            preHandler: [requireAuth, requireRight("server.stop")],
        },
        async (_, reply) => {
            if (!tirStatus) {
                return send(reply, 400, "ТИР не запущен");
            }
            tirStatus = false;
            stopDemoPublishers();
            return send(reply, 200, "ТИР успешно остановлен");
        },
    );
    // POST /api/v2/restartTir
    fastify.post(
        "/api/v2/restartTir",
        {
            preHandler: [requireAuth, requireRight("server.restart")],
        },
        async (_, reply) => {
            return send(reply, 200, "ТИР успешно перезапущен");
        },
    );
}
