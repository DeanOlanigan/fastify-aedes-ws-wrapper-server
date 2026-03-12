import { createServer as createTcpServer } from "node:net";
import Aedes from "aedes";
import { overrideValue } from "./demo/monitoring.js";

const COMMAND_TOPIC_PATTERN = /^commands\/node\/(.+)$/;

export async function createBroker({ mqttPort, logger }) {
    const broker = await Aedes();

    broker.on("client", (client) =>
        logger?.info({ id: client?.id }, "mqtt client connected"),
    );
    broker.on("clientDisconnect", (client) =>
        logger?.info({ id: client?.id }, "mqtt client disconnected"),
    );
    broker.on("publish", (packet, client) => {
        // Игнорируем системные сообщения и то, что публикует сам сервер (если client=null)
        // Хотя для команд от HMI client всегда будет присутствовать.
        if (!packet.topic) return;

        logger?.debug(
            {
                topic: packet?.topic,
                qos: packet?.qos,
                retain: packet?.retain,
                by: client?.id ?? "server",
            },
            "mqtt publish",
        );

        const match = packet.topic.match(COMMAND_TOPIC_PATTERN);
        if (match) {
            const uuid = match[1]; // id из топика: commands/node/{uuid}
            const payloadStr = packet.payload.toString();

            try {
                // Ожидаем, что HMI шлет JSON, например: { "v": 55.5, "user": "admin" }
                // Или просто значение. Давай поддержим JSON для гибкости.
                const data = JSON.parse(payloadStr);
                // Извлекаем значение (предположим формат { v: ... })
                const valueToSet = data.v !== undefined ? data.v : data;

                console.log(
                    `[CMD] Received command for ${uuid}:`,
                    valueToSet,
                    `from client ${client?.id}`,
                );

                // Применяем изменение к "физической модели"
                overrideValue(uuid, valueToSet);
            } catch (e) {
                console.error(
                    `[CMD] Failed to process command for ${uuid}:`,
                    e.message,
                );
            }
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

    function stop() {
        return new Promise((resolve, reject) => {
            tcpServer.close((e) => (e ? reject(e) : resolve()));
        }).then(
            () =>
                new Promise((resolve, reject) =>
                    broker.close((e) => (e ? reject(e) : resolve())),
                ),
        );
    }

    return { broker, start, stop };
}
