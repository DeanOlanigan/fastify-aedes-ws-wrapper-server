import {
    startDemoPublishers,
    stopDemoPublishers,
} from "../broker/demo/publishers.js";
import { send } from "./utils.js";

let tirStatus = false;

export default async function appRoutes(fastify, opts) {
    const { broker } = opts;

    // GET /api/v1/getSoftwareVer
    fastify.get("/api/v1/softwareVer", async (req, reply) => {
        return send(reply, 200, "Success", "1.99.999");
    });

    // POST /api/v2/startTir
    fastify.post("/api/v2/startTir", async (req, reply) => {
        if (tirStatus) {
            return send(reply, 400, "ТИР уже запущен");
        }
        tirStatus = true;
        startDemoPublishers(broker);
        return send(reply, 200, "ТИР успешно запущен");
    });

    // POST /api/v2/stopTir
    fastify.post("/api/v2/stopTir", async (req, reply) => {
        if (!tirStatus) {
            return send(reply, 400, "ТИР не запущен");
        }
        tirStatus = false;

        stopDemoPublishers();
        return send(reply, 200, "ТИР успешно остановлен");
    });

    // POST /api/v2/restartTir
    fastify.post("/api/v2/restartTir", async (req, reply) => {
        return send(reply, 200, "ТИР успешно перезапущен");
    });
}
