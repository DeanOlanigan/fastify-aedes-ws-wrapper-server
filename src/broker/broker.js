import Aedes from "aedes";
import { createServer as createTcpServer } from "node:net";

export async function createBroker({ mqttPort, logger }) {
    const broker = await Aedes();

    broker.on("client", (client) =>
        logger?.info({ id: client?.id }, "mqtt client connected")
    );
    broker.on("clientDisconnect", (client) =>
        logger?.info({ id: client?.id }, "mqtt client disconnected")
    );
    broker.on("publish", (packet, client) => {
        logger?.debug(
            {
                topic: packet?.topic,
                qos: packet?.qos,
                retain: packet?.retain,
                by: client?.id ?? "server",
            },
            "mqtt publish"
        );
    });

    const tcpServer = createTcpServer(broker.handle);

    function start() {
        return new Promise((resolve) => {
            tcpServer.listen(mqttPort, () => {
                logger?.info(
                    `Aedes MQTT broker (TCP) listening on :${mqttPort}`
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
                    broker.close((e) => (e ? reject(e) : resolve()))
                )
        );
    }

    return { broker, start, stop };
}
