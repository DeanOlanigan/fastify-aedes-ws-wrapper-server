import {
    startDemoPublishers,
    stopDemoPublishers,
} from "../broker/demo/publishers.js";
import { promises as fs } from "fs";

let tirStatus = false;

function send(reply, status, message, data) {
    const body = { status, message };
    if (data !== undefined) body.data = data;
    return reply.code(status).send(body);
}

export default async function appRoutes(fastify, opts) {
    const { broker } = opts;

    // GET /api/v1/getSoftwareVer
    fastify.get("/api/v1/getSoftwareVer", async (req, reply) => {
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

    // PUT /api/v2/uploadConfiguration (XML в теле запроса)
    fastify.put("/api/v2/uploadConfiguration", async (req, reply) => {
        // Если пришла строка — используем её; на всякий случай поддержим и JSON { xml: "..." }
        const xml =
            typeof req.body === "string"
                ? req.body
                : typeof req.body?.xml === "string"
                ? req.body.xml
                : "";

        if (!xml || xml.trim() === "") {
            return send(reply, 400, "Bad request");
        }

        try {
            await fs.writeFile("config.xml", xml);
            return send(reply, 200, "Конфигурация успешно сохранена");
        } catch (error) {
            return send(reply, 500, "Конфигурация не сохранена", error);
        }
    });

    // GET /api/v2/getConfiguration
    fastify.get("/api/v2/getConfiguration", async (req, reply) => {
        try {
            const data = await fs.readFile("config.xml", "utf-8");
            return send(reply, 200, "Конфигурация успешно получена", data);
        } catch (error) {
            return send(reply, 500, "Конфигурация не получена", error);
        }
    });
}
