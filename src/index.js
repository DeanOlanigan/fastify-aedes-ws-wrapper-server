import {
    HTTP_PORT,
    MQTT_TCP_PORT,
    WS_PATH,
    LOG_LEVEL,
    DEMO,
} from "./config.js";
import { createBroker } from "./broker/broker.js";
import { createHttpServer } from "./http/server.js";
import { attachMqttOverWs } from "./http/ws.js";
import healthRoutes from "./routes/health.js";
import {
    startDemoPublishers,
    stopDemoPublishers,
} from "./broker/demo/publishers.js";
import mqttRoutes from "./routes/mqtt.js";
import appRoutes from "./routes/app.js";
import logRoutes from "./routes/log.js";
import configRoutes from "./routes/config.js";
import archiveRoutes from "./routes/archive.js";
import dbRoutes from "./routes/db.js";
import { sqlitePlugin } from "./db.js";
import settingsRoutes from "./routes/settings.js";
import updatesRoutes from "./routes/updates.js";
import lecenseRoutes from "./routes/lecense.js";
import usersRoutes from "./routes/users.js";
import rolesRoutes from "./routes/roles.js";

// --- create broker
const {
    broker,
    start: startBroker,
    stop: stopBroker,
} = await createBroker({ mqttPort: MQTT_TCP_PORT, logger: console });
await startBroker();

// --- create http
const fastify = await createHttpServer({ logLevel: LOG_LEVEL });
attachMqttOverWs({ fastify, broker, path: WS_PATH });

await fastify.register(sqlitePlugin, {
    filename: "./src/data/db/sd/test.db",
});

// routes
await fastify.register(healthRoutes);
await fastify.register(mqttRoutes, { broker });
await fastify.register(appRoutes, { broker });
await fastify.register(logRoutes);
await fastify.register(configRoutes);
await fastify.register(archiveRoutes);
await fastify.register(dbRoutes);
await fastify.register(settingsRoutes);
await fastify.register(updatesRoutes);
await fastify.register(lecenseRoutes);
await fastify.register(usersRoutes);
await fastify.register(rolesRoutes);

await fastify.listen({ port: HTTP_PORT });
fastify.log.info(`HTTP listening :${HTTP_PORT}`);

if (DEMO) {
    fastify.log.info("Starting demo publishers...");
    startDemoPublishers(broker);
}

async function shutdown() {
    try {
        fastify.log.info("Shutting down...");

        if (DEMO) {
            fastify.log.info("Stopping demo publishers...");
            stopDemoPublishers();
        }

        if (typeof fastify.closeWsWrapper === "function") {
            await fastify.closeWsWrapper();
        }

        fastify.log.info("Stopping MQTT broker...");
        await stopBroker();

        fastify.log.info("Stopping HTTP server...");
        await fastify.close();

        fastify.server.closeIdleConnections?.();
        fastify.server.closeAllConnections?.();

        fastify.log.info("Done.");
        process.exit(0);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        process.exit(1);
    }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
