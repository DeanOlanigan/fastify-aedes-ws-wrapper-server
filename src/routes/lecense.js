import path from "path";
import fs from "fs"
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function lecenseRoutes(fastify) {

    fastify.get("/api/v2/checkLecense", async (req, reply) => {
        const filepath = path.join(__dirname,  "../data/settings/lecense.json")
        const {uuid} = req.query;
        try {
            const data = await fs.promises.readFile(filepath, "utf-8")
            const dataJSON = JSON.parse(data);

            const isActivated = dataJSON.find(item => item.uuid === uuid);

            if (!isActivated) {
                return reply.status(404).send({ error: "uuid not found" })
            }

            reply.type("application/json");
            reply.status(200);
            return ({isActive: isActivated.isActive, endDate: isActivated.endDate});
        } catch (err) {
            reply.status(500).send({ error: err.message })
        }
    })

    fastify.post("/api/v2/activateLec", async (req, reply) => {
        const filepath = path.join(__dirname,  "../data/settings/lecense.json")
        const {uuid, key} = req.body;
        try {
            const data = await fs.promises.readFile(filepath, "utf-8")
            const dataJSON = JSON.parse(data);

            const notreData = dataJSON.find(item => item.uuid === uuid);

            if (!notreData) {
                return reply.status(404).send({ error: "uuid not found" })
            }

            if (notreData.key === key) {
                notreData.isActive = true;
                await fs.promises.writeFile(filepath, JSON.stringify(dataJSON, null, 2));
                reply.type("application/json").status(200).send(true);
            }
            if (notreData.key !== key) {
                return reply.status(400).send({ error: "Invalid key" });
            }


        } catch (err) {
            reply.status(500).send({ error: err.message })
        }
    })

}