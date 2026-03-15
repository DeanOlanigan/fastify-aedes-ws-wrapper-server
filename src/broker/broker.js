import { createServer as createTcpServer } from "node:net";
import Aedes from "aedes";
import { createCommandServices } from "../services/createCommandServices.js";

const TOPICS = {
    COMMAND_NODE_WRITE: /^commands\/node\/write\/(.+)$/,
    COMMAND_JOURNAL_ACK: "commands/journal/ack",
};

function safeJsonParse(payload) {
    try {
        return JSON.parse(payload.toString());
    } catch {
        return undefined;
    }
}

function createCommandDispatcher({ logger, services }) {
    async function dispatch(packet, client) {
        if (!packet?.topic) return;

        const writeMatch = packet.topic.match(TOPICS.COMMAND_NODE_WRITE);
        if (writeMatch) {
            const varId = writeMatch[1];
            const data = safeJsonParse(packet.payload);

            if (!data || typeof data !== "object") {
                logger?.warn(
                    { topic: packet.topic, by: client?.id ?? "server" },
                    "invalid JSON payload for telecontrol command",
                );
                return;
            }

            if (
                !data.commandId ||
                data.type !== "variable.telecontrol" ||
                !data.payload?.varId
            ) {
                logger?.warn(
                    {
                        topic: packet.topic,
                        by: client?.id ?? "server",
                        commandId: data.commandId,
                    },
                    "invalid telecontrol command",
                );
            }

            logger?.info(
                {
                    topic: packet.topic,
                    by: client?.id ?? "server",
                    commandId: data.commandId,
                    varId: data.payload.varId,
                },
                "received telecontrol command",
            );

            const valueToSet =
                data.payload.data.v !== undefined ? data.payload.data.v : data;

            logger?.info(
                {
                    topic: packet.topic,
                    varId,
                    by: client?.id ?? "server",
                },
                "processing node write command",
            );

            await services.nodeCommands.writeValue({
                nodeId: varId,
                value: valueToSet,
            });
            return;
        }

        if (packet.topic === TOPICS.COMMAND_JOURNAL_ACK) {
            const data = safeJsonParse(packet.payload);

            if (!data || typeof data !== "object") {
                logger?.warn(
                    { topic: packet.topic, by: client?.id ?? "server" },
                    "invalid JSON payload for journal ack command",
                );
                return;
            }

            if (
                !data.commandId ||
                data.type !== "journal.ack" ||
                !data.payload?.eventId
            ) {
                logger?.warn(
                    {
                        topic: packet.topic,
                        by: client?.id ?? "server",
                        commandId: data.commandId,
                    },
                    "invalid journal ack command",
                );
            }

            logger?.info(
                {
                    topic: packet.topic,
                    by: client?.id ?? "server",
                    commandId: data.commandId,
                    eventId: data.payload.eventId,
                },
                "received journal ack command",
            );

            await services.journalCommands.ackEvent({
                commandId: data.commandId,
                requestedAt: data.requestedAt ?? null,
                requestedBy: data.requestedBy ?? null,
                payload: {
                    eventId: data.payload.eventId,
                    event: data.payload.event,
                    message: data.payload.message,
                },
                requestedByClientId: client?.id ?? "server",
                raw: data,
            });
            return;
        }
    }

    return { dispatch };
}

export async function createBroker({ mqttPort, logger }) {
    const broker = await Aedes();

    const services = createCommandServices({ logger, broker });
    const dispatcher = createCommandDispatcher({ logger, services });

    broker.on("client", (client) =>
        logger?.info({ id: client?.id }, "mqtt client connected"),
    );
    broker.on("clientDisconnect", (client) =>
        logger?.info({ id: client?.id }, "mqtt client disconnected"),
    );
    broker.on("publish", async (packet, client) => {
        // Игнорируем системные сообщения и то, что публикует сам сервер (если client=null)
        // Хотя для команд от HMI client всегда будет присутствовать.
        if (!packet?.topic) return;

        logger?.debug(
            {
                topic: packet?.topic,
                qos: packet?.qos,
                retain: packet?.retain,
                by: client?.id ?? "server",
            },
            "mqtt publish",
        );

        try {
            await dispatcher.dispatch(packet, client);
        } catch (error) {
            logger?.error(
                {
                    error,
                    topic: packet?.topic,
                    by: client?.id ?? "server",
                },
                "failed to dispatch command",
            );
        }
    });

    const tcpServer = createTcpServer(broker.handle);

    function start() {
        return new Promise((resolve) => {
            tcpServer.listen(mqttPort, () => {
                logger?.info(
                    `Aedes MQTT broker (TCP) listening on :${mqttPort}`,
                );
                resolve();
            });
        });
    }

    async function stop() {
        return new Promise((resolve, reject) => {
            tcpServer.close((e) => (e ? reject(e) : resolve()));
        }).then(
            () =>
                new Promise((resolve, reject) =>
                    broker.close((e) => (e ? reject(e) : resolve())),
                ),
        );
    }

    return {
        broker,
        start,
        stop,
        topics: {
            COMMAND_JOURNAL_ACK: TOPICS.COMMAND_JOURNAL_ACK,
            commandNodeWrite: (uuid) => `commands/node/write/${uuid}`,
        },
    };
}
