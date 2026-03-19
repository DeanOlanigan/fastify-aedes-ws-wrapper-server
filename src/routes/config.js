import fs from "node:fs/promises";
import path from "node:path";
import { parseConfigXml, send } from "./utils.js";

const DATA_DIR = path.resolve("data");
const CONFIG_PATH = path.join(DATA_DIR, "configuration.xml");

const MAX_XML_SIZE = 1024 * 1024 * 2; // 2MB

export default async function configRoutes(fastify) {

    await fs.mkdir(DATA_DIR, { recursive: true });

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

        // ограничение размера
        if (Buffer.byteLength(xml, "utf8") > MAX_XML_SIZE) {
            return send(reply, 413, "Configuration too large");
        }

        // простая sanity-проверка
        if (!xml.trim().startsWith("<")) {
            return send(reply, 400, "Invalid XML");
        }

        try {

            // атомарная запись
            const tmp = `${CONFIG_PATH}.tmp`;
            await fs.writeFile(tmp, xml, "utf8");
            await fs.rename(tmp, CONFIG_PATH);

            return send(reply, 200, "Конфигурация успешно сохранена");
        } catch (error) {
            return send(reply, 500, "Конфигурация не сохранена", error);
        }
    });

    // GET /api/v2/getConfiguration
    fastify.get("/api/v2/configuration", async (_, reply) => {
        try {
            const data = await fs.readFile(CONFIG_PATH, "utf8");
            return send(reply, 200, "Конфигурация успешно получена", data);
        } catch (error) {
            if (error.code === "ENOENT") {
                return send(reply, 404, "Configuration not found");
            }
            return send(reply, 500, "Конфигурация не получена", error);
        }
    });

    fastify.get("/api/v2/configuration/variables", async (_, reply) => {
        try {
            const data = await fs.readFile(CONFIG_PATH, "utf8");
            const { variables } = parseConfigXml(data);
            return send(reply, 200, "Переменные успешно получены", variables);
        } catch (error) {
            if (error.code === "ENOENT") {
                return send(reply, 404, "Variables not found");
            }
            return send(reply, 500, "Переменные не получены", error);
        }
    });

    fastify.get("/api/v2/configuration/variables/graph", async (_, reply) => {
        try {
            const data = await fs.readFile(CONFIG_PATH, "utf8");
            const { variables } = parseConfigXml(data);
            const graphVariables = variables.filter((v) => v.graph);
            return send(reply, 200, "Переменные успешно получены", graphVariables);
        } catch (error) {
            if (error.code === "ENOENT") {
                return send(reply, 404, "Variables not found");
            }
            return send(reply, 500, "Переменные не получены", error);
        }
    });
}
