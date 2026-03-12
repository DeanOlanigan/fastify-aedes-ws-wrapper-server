import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "../services/auth.js";
import { saveUsers } from "../services/auth-store.js";

const USERS_DIR = path.resolve("data/users");

export default async function usersRoutes(fastify) {

    await fs.promises.mkdir(USERS_DIR, { recursive: true });

    fastify.get("/api/v2/users", async () => {
        return fastify.authStore.users;
    });

    fastify.post("/api/v2/users", async (req, reply) => {
        try {
            const { id, userData } = req.body;

            if (!id || !userData.login || !userData.password) {
                return reply.status(400).send({ error: "Invalid payload" });
            }

            const users = structuredClone(fastify.authStore.users);

            if (users[id]) {
                return reply.status(400).send({ error: "User exists" });
            }

            const passwordHash = await hashPassword(userData.password);

            users[id] = {
                ...userData,
                passwordHash,
            };

            await saveUsers(users);
            await fastify.reloadAuthStore();

            return reply.status(200).send({ added: id });
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.put("/api/v2/users", async (req, reply) => {
        try {
            const { ids, newData } = req.body;

            if (!Array.isArray(ids) || ids.length === 0) {
                return reply.status(400).send({ error: "No IDs provided" });
            }

            const users = structuredClone(fastify.authStore.users);

            if (ids.length === 1) {
                const id = ids[0];
                if (!users[id]) {
                    return reply.status(404).send({ error: "User not found" });
                }

                users[id] = { ...users[id], ...newData, passwordHash: users[id].passwordHash };
            } else {
                const { role } = newData;

                if (!role)
                    return reply
                        .status(400)
                        .send({ error: "Role is required" });

                for (const id of ids) {
                    if (users[id]) {
                        users[id] = { ...users[id], ...newData, passwordHash: users[id].passwordHash };
                    }
                }
            }

            await saveUsers(users);
            await fastify.reloadAuthStore();

            return reply.status(200).send({ updated: ids });
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.delete("/api/v2/users", async (req, reply) => {
        try {
            const idsQuery = req.query.ids || "";
            const ids = idsQuery.split(",").filter(Boolean);

            if (!ids.length) {
                return reply.status(400).send({ error: "No IDs provided" });
            }

            const users = structuredClone(fastify.authStore.users);

            for (const id of ids) {
                delete users[id];
            }

            await saveUsers(users);
            await fastify.reloadAuthStore();

            return reply.status(200).send({ deleted: ids });
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.put("/api/v2/users/password", async (req, reply) => {
        try {
            const { userId, editedPassword } = req.body;

            if (!userId || !editedPassword) {
                return reply.status(400).send({ error: "Invalid payload" });
            }

            const users = structuredClone(fastify.authStore.users);

            if (!users[userId]) {
                return reply
                    .status(404)
                    .send({ error: "Пользователь не найден" });
            }

            const passwordHash = await hashPassword(editedPassword);

            users[userId].passwordHash = passwordHash;

            await saveUsers(users);
            await fastify.reloadAuthStore();

            return reply.status(201).send({ message: "success" });
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });
}
