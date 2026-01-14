import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROLES_PATH = path.join(__dirname, "../data/roles/roles.json");

export default async function rolesRoutes(fastify) {
    fastify.get("/api/v2/roles", async (_, reply) => {
        try {
            const data = await fs.promises.readFile(ROLES_PATH, "utf-8");
            return JSON.parse(data);
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.post("/api/v2/roles", async (req, reply) => {
        try {
            const data = JSON.parse(
                await fs.promises.readFile(ROLES_PATH, "utf-8")
            );

            const { id, name, rights } = req.body;

            if (data[id]) {
                return reply.status(400).send({ error: "Role exists" });
            }

            data[id] = { name, rights };

            await fs.promises.writeFile(
                ROLES_PATH,
                JSON.stringify(data, null, 4)
            );

            return reply.status(201).send(data[id]);
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.delete("/api/v2/roles/:id", async (req, reply) => {
        try {
            const { id } = req.params;
            const data = JSON.parse(
                await fs.promises.readFile(ROLES_PATH, "utf-8")
            );

            delete data[id];

            await fs.promises.writeFile(
                ROLES_PATH,
                JSON.stringify(data, null, 4)
            );

            return reply.status(200).send({ deleted: id });
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.put("/api/v2/editRoles", async (req, reply) => {
        try {
            const { id, name, rights } = req.body;
            let data = JSON.parse(
                await fs.promises.readFile(ROLES_PATH, "utf-8")
            );

            data[id] = { name: name, rights: rights };

            await fs.promises.writeFile(
                ROLES_PATH,
                JSON.stringify(data, null, 4)
            );

            return reply.status(200).send({ edited: id });
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });
}
