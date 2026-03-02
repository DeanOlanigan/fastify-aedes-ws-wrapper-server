import { findUserByLogin, verifyPassword, collectRights } from "../services/auth.js";

export const authRoutes = async function (fastify) {
    fastify.post("/login", async (request, reply) => {
        const { login, password } = request.body ?? {};

        if (!login || !password) {
            return reply.code(400).send({ error: "LOGIN_REQUIRED" });
        }

        const { users, roles } = fastify.authStore;
        const found = findUserByLogin(users, login);

        if (!found) {
            return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
        }

        const [userId, user] = found;

        if (user.isDisabled) {
            return reply.code(403).send({ error: "USER_DISABLED" });
        }

        const ok = await verifyPassword(user.passwordHash, password);
        if (!ok) {
            return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
        }

        // важно: заново пересоздать сессию после логина
        await request.session.regenerate();

        const rights = collectRights(user, roles);

        request.session.user = {
            userId,
            login: user.login,
            roles: user.roles ?? [],
            rights,
            authzVersion: user.authzVersion ?? 1,
            mustChangePassword: !!user.mustChangePassword,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
            stepUpUntil: 0,
        };

        return reply.send({
            ok: true,
            user: {
                id: userId,
                login: user.login,
                surname: user.surname,
                name: user.name,
                grandname: user.grandname,
                position: user.position,
                roles: user.roles ?? [],
                rights,
                mustChangePassword: !!user.mustChangePassword,
            },
        });
    });

    fastify.post("/logout", async (request, reply) => {
        await request.session.destroy();
        reply.clearCookie("sid", { path: "/" });
        return reply.send({ ok: true });
    });

    fastify.get("/session", async (request, reply) => {
        const sessionUser = request.session.user;
        if (!sessionUser) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }

        return reply.send({
            authenticated: true,
            user: sessionUser,
        });
    });

    fastify.post("/reauth", async (request, reply) => {
        const sessionUser = request.session.user;
            if (!sessionUser) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }

        const { password } = request.body ?? {};
            if (!password) {
            return reply.code(400).send({ error: "PASSWORD_REQUIRED" });
        }

        const user = fastify.authStore.users[sessionUser.userId];
            if (!user || user.isDisabled) {
            await request.session.destroy();
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }

        const ok = await verifyPassword(user.passwordHash, password);
        if (!ok) {
            return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
        }

        request.session.user.stepUpUntil = Date.now() + 5 * 60 * 1000; // 5 минут
        return reply.send({ ok: true, stepUpUntil: request.session.user.stepUpUntil });
    });
};