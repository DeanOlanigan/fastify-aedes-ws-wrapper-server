import fss from "node:fs/promises";
import { send } from "./utils.js";

export default async function configRoutes(fastify) {
    // PUT /api/v2/uploadConfiguration (XML в теле запроса)
    fastify.put("/api/v2/configuration", async (req, reply) => {
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
            await fss.writeFile("./src/data/config.xml", xml);
            return send(reply, 200, "Конфигурация успешно сохранена");
        } catch (error) {
            return send(reply, 500, "Конфигурация не сохранена", error);
        }
    });

    // GET /api/v2/getConfiguration
    fastify.get("/api/v2/configuration", async (_, reply) => {
        try {
            const data = await fss.readFile("./src/data/config.xml", "utf-8");
            return send(reply, 200, "Конфигурация успешно получена", data);
        } catch (error) {
            return send(reply, 500, "Конфигурация не получена", error);
        }
    });
}
