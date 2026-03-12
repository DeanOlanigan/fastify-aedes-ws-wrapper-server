import fs from "node:fs";
import path from "node:path";

const LICENSE_DIR = path.resolve("data/settings");
const LICENSE_PATH = path.join(LICENSE_DIR, "license.json");

export default async function licenseRoutes(fastify) {

    await fs.promises.mkdir(LICENSE_DIR, { recursive: true });

    fastify.get("/api/v2/checkLecense", async (req, reply) => {
        const { uuid } = req.query;
        try {
            const data = await fs.promises.readFile(LICENSE_PATH, "utf-8");
            const dataJSON = JSON.parse(data);

            const isActivated = dataJSON.find((item) => item.uuid === uuid);

            if (!isActivated) {
                return reply.status(404).send({ error: "uuid not found" });
            }

            reply.type("application/json");
            reply.status(200);
            return {
                isActive: isActivated.isActive,
                endDate: isActivated.endDate,
            };
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.post("/api/v2/activateLec", async (req, reply) => {
        const { uuid, key } = req.body;
        try {
            const data = await fs.promises.readFile(LICENSE_PATH, "utf-8");
            const dataJSON = JSON.parse(data);

            const notreData = dataJSON.find((item) => item.uuid === uuid);

            if (!notreData) {
                return reply.status(404).send({ error: "uuid not found" });
            }

            if (notreData.key === key) {
                notreData.isActive = true;
                await fs.promises.writeFile(
                    LICENSE_PATH,
                    JSON.stringify(dataJSON, null, 2),
                );
                reply.type("application/json").status(200).send(true);
            }
            if (notreData.key !== key) {
                return reply.status(400).send({ error: "Invalid key" });
            }
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });
}
