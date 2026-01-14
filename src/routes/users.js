import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_PATH = path.join(__dirname, "../data/users/users.json");

export default async function usersRoutes(fastify) {
    fastify.get("/api/v2/users", async (_, reply) => {
        try {
            const data = await fs.promises.readFile(USERS_PATH, "utf-8");
            reply.type("application/json");
            return JSON.parse(data);
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.put("/api/v2/editUsers", async (req, reply) => {
        try {
            const { ids, newData } = req.body;

            if (!Array.isArray(ids) || ids.length === 0) {
                return reply.status(400).send({ error: "No IDs provided" });
            }

            const data = JSON.parse(
                await fs.promises.readFile(USERS_PATH, "utf-8")
            );

            if (ids.length === 1) {
                const id = ids[0];
                if (!data[id])
                    return reply.status(404).send({ error: "User not found" });
                data[id] = { ...newData };
            } else {
                const { role } = newData;
                if (!role)
                    return reply
                        .status(400)
                        .send({ error: "Role is required" });
                ids.forEach((id) => {
                    if (data[id]) data[id].role = role;
                });
            }

            await fs.promises.writeFile(
                USERS_PATH,
                JSON.stringify(data, null, 4)
            );

            return reply.status(200).send({ updated: ids });
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.delete("/api/v2/deleteUsers", async (req, reply) => {
        try {
            const idsQuery = req.query.ids || "";
            const ids = idsQuery.split(",").filter(Boolean);

            if (!ids.length) {
                return reply.status(400).send({ error: "No IDs provided" });
            }

            const data = JSON.parse(
                await fs.promises.readFile(USERS_PATH, "utf-8")
            );

            ids.forEach((id) => delete data[id]);

            await fs.promises.writeFile(
                USERS_PATH,
                JSON.stringify(data, null, 4)
            );

            return reply.status(200).send({ deleted: ids });
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.post("/api/v2/addUser", async (req, reply) => {
        try {
            let data = JSON.parse(
                await fs.promises.readFile(USERS_PATH, "utf-8")
            );

            const { id, userData } = req.body;

            data[id] = { ...userData };
            await fs.promises.writeFile(
                USERS_PATH,
                JSON.stringify(data, null, 4)
            );
            return reply.status(200).send({ added: id });
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });
}
