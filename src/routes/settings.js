import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function settingsRoutes(fastify) {
    fastify.get("/api/v2/settings", async (_, reply) => {
        const filepath = path.join(__dirname, "../data/settings/settings.json");
        try {
            const data = await fs.promises.readFile(filepath, "utf-8");
            reply.type("application/json");
            reply.status(200);
            return JSON.parse(data);
        } catch (err) {
            reply.status(500).send({ error: err });
        }
    });

    fastify.put("/api/v2/setsettings", async (req, reply) => {
        const filepath = path.join(__dirname, "../data/settings/settings.json");
        try {
            await fs.promises.writeFile(filepath, JSON.stringify(req.body));
            reply.status(200);
            return reply.send(req.body);
        } catch (err) {
            reply.status(500).send({ error: err });
        }
    });
}
