import { createBroker } from "./broker/broker.js";
import {
    startDemoPublishers,
    stopDemoPublishers,
} from "./broker/demo/publishers.js";
import {
    DEMO,
    HTTP_PORT,
    LOG_LEVEL,
    MQTT_TCP_PORT,
    WS_PATH,
} from "./config.js";
import { createHttpServer } from "./http/server.js";
import { attachMqttOverWs } from "./http/ws.js";
import appRoutes from "./routes/app.js";
import archiveRoutes from "./routes/archive.js";
import configRoutes from "./routes/config.js";
import dbRoutes from "./routes/db.js";
import healthRoutes from "./routes/health.js";
import hmiRoutes from "./routes/hmi.js";
import journalRoutes from "./routes/journal/journal.js";
import licenseRoutes from "./routes/license.js";
import logRoutes from "./routes/log.js";
import { authRoutes } from "./routes/login.js";
import mqttRoutes from "./routes/mqtt.js";
import rolesRoutes from "./routes/roles.js";
import settingsRoutes from "./routes/settings.js";
import updatesRoutes from "./routes/updates.js";
import usersRoutes from "./routes/users.js";
import { createCommandBus } from "./services/command-bus.js";

// --- create broker
const {
    broker,
    start: startBroker,
    stop: stopBroker,
    topics,
} = await createBroker({ mqttPort: MQTT_TCP_PORT, logger: console });
await startBroker();

// --- create http
const fastify = await createHttpServer({ logLevel: LOG_LEVEL });
fastify.decorate("mqttBroker", broker);
fastify.decorate("mqttTopics", topics);
fastify.decorate("commandBus", createCommandBus({ broker, topics }));
attachMqttOverWs({ fastify, broker, path: WS_PATH });

// routes
await fastify.register(healthRoutes);
await fastify.register(mqttRoutes);
await fastify.register(appRoutes);
await fastify.register(hmiRoutes);
await fastify.register(logRoutes);
await fastify.register(configRoutes);
await fastify.register(archiveRoutes);
await fastify.register(dbRoutes);
await fastify.register(settingsRoutes);
await fastify.register(updatesRoutes);
await fastify.register(licenseRoutes);
await fastify.register(usersRoutes);
await fastify.register(rolesRoutes);
await fastify.register(authRoutes, { prefix: "/api/v2/auth" });
await fastify.register(journalRoutes);

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
