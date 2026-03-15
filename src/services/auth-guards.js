import { validateSessionUser } from "./validateSessionUser.js";

export async function requireAuth(request, reply) {
    const res = await validateSessionUser(request);

    if (!res.authenticated) {
        return reply.code(401).send({ error: "UNAUTHORIZED" });
    }

    request.user = res.currentUser;
}

export function requireRight(right) {
    return async (request, reply) => {
        const sessionUser = request.session.user;
        if (!sessionUser) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }

        const currentUser = request.server.authStore.users[sessionUser.userId];
        if (!currentUser || currentUser.isDisabled) {
            await request.session.destroy();
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }

        const currentVersion = currentUser.authzVersion ?? 1;
        if (currentVersion !== sessionUser.authzVersion) {
            await request.session.destroy();
            return reply.code(401).send({ error: "SESSION_EXPIRED" });
        }

        if (!sessionUser.rights?.includes(right)) {
            return reply.code(403).send({ error: "FORBIDDEN", right });
        }
    };
}

export function requireStepUp() {
    return async (request, reply) => {
        const sessionUser = request.session.user;
        if (!sessionUser) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }

        const currentUser = request.server.authStore.users[sessionUser.userId];
        if (!currentUser || currentUser.isDisabled) {
            await request.session.destroy();
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }

        const currentVersion = currentUser.authzVersion ?? 1;
        if (currentVersion !== sessionUser.authzVersion) {
            await request.session.destroy();
            return reply.code(401).send({ error: "SESSION_EXPIRED" });
        }

        if (!sessionUser.stepUpUntil || sessionUser.stepUpUntil < Date.now()) {
            return reply.code(403).send({ error: "STEP_UP_REQUIRED" });
        }
    };
}
