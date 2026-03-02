export async function requireAuth(request, reply) {
    const sessionUser = request.session.user;
    if (!sessionUser) {
        return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
}

export function requireRight(right) {
    return async function (request, reply) {
        const sessionUser = request.session.user;
        if (!sessionUser) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }

        if (!sessionUser.rights?.includes(right)) {
            return reply.code(403).send({ error: "FORBIDDEN", right });
        }
    };
}

export function requireStepUp() {
    return async function (request, reply) {
        const sessionUser = request.session.user;
        if (!sessionUser) {
            return reply.code(401).send({ error: "UNAUTHORIZED" });
        }

        if (!sessionUser.stepUpUntil || sessionUser.stepUpUntil < Date.now()) {
            return reply.code(403).send({ error: "STEP_UP_REQUIRED" });
        }
    };
}