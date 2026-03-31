import fs from "node:fs/promises";
import path from "node:path";
import { ERROR_CODES } from "../errorCodes.js";
import { requireAuth, requireRight } from "../services/auth-guards.js";

const DATA_DIR = path.resolve("data");
const CONFIG_PATH = path.join(DATA_DIR, "configuration.json");

const MAX_CONFIG_SIZE = 1024 * 1024 * 2; // 2MB

export default async function configRoutes(fastify) {
    await fs.mkdir(DATA_DIR, { recursive: true });

    // PUT /api/v2/configuration
    fastify.put(
        "/api/v2/configuration",
        {
            preHandler: [requireAuth, requireRight("config.upload")],
        },
        async (req, reply) => {
            const { config } = req.body;

            if (
                !config ||
                typeof config !== "object" ||
                Array.isArray(config)
            ) {
                return reply.code(400).send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
            }

            let json;
            try {
                json = JSON.stringify(config, null, 2);
            } catch {
                return reply
                    .code(400)
                    .send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
            }

            if (Buffer.byteLength(json, "utf8") > MAX_CONFIG_SIZE) {
                return reply
                    .code(413)
                    .send({ error: { code: ERROR_CODES.PAYLOAD_TOO_LARGE } });
            }

            try {
                const tmp = `${CONFIG_PATH}.tmp`;
                await fs.writeFile(tmp, json, "utf8");
                await fs.rename(tmp, CONFIG_PATH);

                return reply.code(201).send();
            } catch (error) {
                fastify.log.error(error);
                return reply
                    .code(500)
                    .send({ error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR } });
            }
        },
    );

    // GET /api/v2/configuration
    fastify.get("/api/v2/configuration", async (_, reply) => {
        try {
            const data = await fs.readFile(CONFIG_PATH, "utf8");
            const config = JSON.parse(data);
            return reply.code(200).send({ config });
        } catch (error) {
            if (error.code === "ENOENT") {
                return reply.code(404).send({ error: { code: ERROR_CODES.NOT_FOUND } });
            }
            return reply
                .code(500)
                .send({ error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR } });
        }
    });

    // GET /api/v2/configuration/variables
    fastify.get("/api/v2/configuration/variables", async (_, reply) => {
        try {
            const data = await fs.readFile(CONFIG_PATH, "utf8");
            const config = JSON.parse(data);
            const variables = getVariables(config);
            return reply.code(200).send({ variables });
        } catch (error) {
            if (error.code === "ENOENT") {
                return reply.code(404).send({ error: { code: ERROR_CODES.NOT_FOUND } });
            }
            return reply
                .code(500)
                .send({ error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR } });
        }
    });

    // GET /api/v2/configuration/variables/graph
    fastify.get("/api/v2/configuration/variables/graph", async (_, reply) => {
        try {
            const data = await fs.readFile(CONFIG_PATH, "utf8");
            const config = JSON.parse(data);
            const graphVariables = getGraphVariables(config);
            return reply.code(200).send({ variables: graphVariables });
        } catch (error) {
            if (error.code === "ENOENT") {
                return reply.code(404).send({ error: { code: ERROR_CODES.NOT_FOUND } });
            }
            return reply
                .code(500)
                .send({ error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR } });
        }
    });
}

function getGraphVariables(config) {
    if (!config.settings) return [];
    const variables = [];
    for (const value of Object.values(config.settings)) {
        if (value.type === "variable" && value.setting.graph) {
            variables.push(buildVariable(value));
        }
    }
    return variables;
}

function buildVariable(variable) {
    return {
        id: variable.id,
        type: variable.type,
        name: variable.name,
        isSpecial: variable.setting.isSpecial,
        specialCycleDelay: variable.setting.specialCycleDelay,
        graph: variable.setting.graph,
        measurement: variable.setting.measurement,
        aperture: variable.setting.aperture,
        cmd: variable.setting.cmd,
        archive: variable.setting.archive,
        group: variable.setting.group,
    };
}

function getVariables(config) {
    if (!config.settings) return [];
    const variables = [];
    for (const value of Object.values(config.settings)) {
        if (value.type === "variable") {
            variables.push(buildVariable(value));
        }
    }
    return variables;
}
