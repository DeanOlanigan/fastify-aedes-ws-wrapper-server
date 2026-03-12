import fs from "node:fs";
import path from "node:path";

const SETTINGS_DIR = path.resolve("data/settings");
const SETTINGS_PATH = path.join(SETTINGS_DIR, "settings.json");

export default async function settingsRoutes(fastify) {

    await fs.promises.mkdir(SETTINGS_DIR, { recursive: true });

    fastify.get("/api/v2/settings", async (_, reply) => {
        try {
            const data = await fs.promises.readFile(SETTINGS_PATH, "utf-8");
            reply.type("application/json");
            reply.status(200);
            return JSON.parse(data);
        } catch (err) {
            reply.status(500).send({ error: err });
        }
    });

    fastify.put("/api/v2/settings", async (req, reply) => {
        try {
            await fs.promises.writeFile(SETTINGS_PATH, JSON.stringify(req.body));
            reply.status(200);
            return reply.send(req.body);
        } catch (err) {
            reply.status(500).send({ error: err });
        }
    });
}
