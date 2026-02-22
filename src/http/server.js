import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyMultipart from "@fastify/multipart";

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

    await fastify.register(cors, { origin: true });
    await fastify.register(rateLimit, { max: 200, timeWindow: "1 minute" });
    await fastify.register(fastifyMultipart, {
        limits: {
            fileSize: 100 * 1024 * 1024,
        }
    })

    // Разбор текстовых/xml тел как строк
    fastify.addContentTypeParser(
        ["text/plain", "text/xml", "application/xml"],
        { parseAs: "string" },
        (req, body, done) => {
            done(null, body);
        }
    );

    return fastify;
}
