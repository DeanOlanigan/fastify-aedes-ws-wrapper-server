import fs from "node:fs";
import path from "node:path";
import { saveRoles } from "../services/auth-store.js";

const ROLES_DIR = path.resolve("data/roles");

export default async function rolesRoutes(fastify) {

    await fs.promises.mkdir(ROLES_DIR, { recursive: true });

    fastify.get("/api/v2/roles", async () => {
        return fastify.authStore.roles;
    });

    fastify.post("/api/v2/roles", async (req, reply) => {
        try {
            const { id, name, rights } = req.body;

            if (!id || !name) {
                return reply.status(400).send({ error: "Invalid payload" });
            }

            const roles = structuredClone(fastify.authStore.roles);

            if (roles[id]) {
                return reply.status(400).send({ error: "Role already exists" });
            }

            roles[id] = { name, rights: Array.isArray(rights) ? rights : [] };

            await saveRoles(roles);
            await fastify.reloadAuthStore();

            return reply.status(201).send(roles[id]);
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.put("/api/v2/roles/:id", async (req, reply) => {
        try {
            const {id} = req.params;
            const { name, rights } = req.body;

            const roles = structuredClone(fastify.authStore.roles);

            roles[id] = {
                name: name ?? roles[id].name,
                rights: rights ?? roles[id].rights,
            };

            await saveRoles(roles);
            await fastify.reloadAuthStore();

            return reply.status(200).send({ edited: id });
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });

    fastify.delete("/api/v2/roles/:id", async (req, reply) => {
        try {
            const { id } = req.params;

            const roles = structuredClone(fastify.authStore.roles);

            delete roles[id];

            await saveRoles(roles);
            await fastify.reloadAuthStore();

            return reply.status(200).send({ deleted: id });
        } catch (err) {
            reply.status(500).send({ error: err.message });
        }
    });
}
