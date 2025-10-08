import {
    startDemoPublishers,
    stopDemoPublishers,
} from "../broker/demo/publishers.js";
import { applyConfig, parseConfigXml, send } from "./utils.js";
import fs from "fs";

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

        const xmlString = fs.readFileSync("src/data/config.xml").toString();
        const parsed = parseConfigXml(xmlString);
        const appliedAt = Date.now();

        const res = await applyConfig(fastify.db, parsed, appliedAt);

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
