import { WebSocketServer, createWebSocketStream } from "ws";

export function attachMqttOverWs({ fastify, broker, path }) {
    const wss = new WebSocketServer({ server: fastify.server, path });

    wss.on("connection", (ws) => {
        const stream = createWebSocketStream(ws, { binary: true });
        broker.handle(stream);
        stream.on("error", (err) =>
            fastify.log.warn({ err }, "ws stream error")
        );
    });

    fastify.addHook("onClose", (_, done) => {
        wss.close();
        done();
    });

    fastify.log.info(`MQTT over WS: ws://<host>/${path}`);
}
