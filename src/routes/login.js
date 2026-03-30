import { ERROR_CODES } from "../errorCodes.js";
import { findUserByLogin, verifyPassword } from "../services/auth.js";
import { buildSessionUser } from "../services/session-user.js";
import { validateSessionUser } from "../services/validateSessionUser.js";

export const authRoutes = async (fastify) => {
    fastify.post(
        "/login",
        {
            config: {
                rateLimit: {
                    max: 10,
                    timeWindow: "1 minute",
                },
            },
        },
        async (request, reply) => {
            const { login, password } = request.body ?? {};

            if (!login || !password) {
                return reply
                    .code(400)
                    .send({ error: { code: ERROR_CODES.VALIDATION_ERROR } });
            }

            const { users, roles } = fastify.authStore;
            const found = findUserByLogin(users, login);

            if (!found) {
                return reply
                    .code(401)
                    .send({ error: { code: ERROR_CODES.INVALID_CREDENTIALS } });
            }

            const [userId, user] = found;

            if (user.isDisabled) {
                return reply
                    .code(403)
                    .send({ error: { code: ERROR_CODES.USER_DISABLED } });
            }

            const ok = await verifyPassword(user.passwordHash, password);
            if (!ok) {
                return reply
                    .code(401)
                    .send({ error: { code: ERROR_CODES.INVALID_CREDENTIALS } });
            }

            // важно: заново пересоздать сессию после логина
            await request.session.regenerate();

            const sessionUser = buildSessionUser(userId, user, roles);
            request.session.user = sessionUser;

            return reply.send({
                ok: true,
                user: sessionUser,
            });
        },
    );

    fastify.post("/logout", async (request, reply) => {
        await request.session.destroy();
        reply.clearCookie("sid", { path: "/" });
        return reply.send({ ok: true });
    });

    fastify.get("/session", async (request, reply) => {
        const { authenticated, currentUser } =
            await validateSessionUser(request);
        if (!authenticated) {
            return reply.send({ authenticated });
        }

        const nextSessionUser = buildSessionUser(
            request.session.user.userId,
            currentUser,
            fastify.authStore.roles,
        );

        return reply.send({
            authenticated,
            user: nextSessionUser,
        });
    });

    fastify.post("/confirm", async (request, reply) => {
        const sessionUser = request.session.user;
        if (!sessionUser) {
            return reply
                .code(401)
                .send({ error: { code: ERROR_CODES.UNAUTHORIZED } });
        }

        const { password } = request.body ?? {};
        if (!password) {
            return reply
                .code(400)
                .send({ error: { code: ERROR_CODES.INVALID_PAYLOAD } });
        }

        const user = fastify.authStore.users[sessionUser.userId];
        if (!user || user.isDisabled) {
            await request.session.destroy();
            return reply
                .code(401)
                .send({ error: { code: ERROR_CODES.UNAUTHORIZED } });
        }

        const ok = await verifyPassword(user.passwordHash, password);
        if (!ok) {
            return reply
                .code(401)
                .send({ error: { code: ERROR_CODES.INVALID_CREDENTIALS } });
        }

        request.session.user.stepUpUntil = Date.now() + 5 * 60 * 1000; // 5 минут
        return reply.send({
            ok: true,
            stepUpUntil: request.session.user.stepUpUntil,
        });
    });
};
