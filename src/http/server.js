import fastifyCookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifySession from "@fastify/session";
import Fastify from "fastify";
import { SESSION_SECRET } from "../config.js";
import { loadRoles, loadUsers } from "../services/auth-store.js";

export async function createHttpServer({ logLevel }) {
    const fastify = Fastify({
        logger: {
            level: logLevel,
            transport:
                process.env.NODE_ENV !== "production"
                    ? {
                        target: "pino-pretty",
                        options: { translateTime: "HH:MM:ss.l" },
                    }
                    : undefined,
        },
    });

    await fastify.register(fastifyCookie);
    await fastify.register(fastifySession, {
        secret: SESSION_SECRET,
        cookieName: "sid",
        cookie: {
            path: "/",
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 1000 * 60 * 30,
        },
        rolling: true,
        saveUninitialized: false,
    });
    await fastify.register(cors, {
        origin: ["http://localhost:5173", "http://localhost:4173"],
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    });
    await fastify.register(rateLimit, { max: 200, timeWindow: "1 minute" });
    await fastify.register(fastifyMultipart, {
        limits: {
            fileSize: 100 * 1024 * 1024,
        },
    });

    fastify.decorate("authStore", {
        users: await loadUsers(),
        roles: await loadRoles(),
    });

    fastify.decorate("reloadAuthStore", async function () {
        this.authStore.users = await loadUsers();
        this.authStore.roles = await loadRoles();
    });

    // Разбор текстовых/xml тел как строк
    fastify.addContentTypeParser(
        ["text/plain", "text/xml", "application/xml"],
        { parseAs: "string" },
        (_, body, done) => {
            done(null, body);
        },
    );

    return fastify;
}
