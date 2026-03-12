import { createWebSocketStream, WebSocketServer } from "ws";

export function attachMqttOverWs({ fastify, broker, path }) {
    // path должен начинаться с "/", иначе апгрейд может не матчиться
    const wss = new WebSocketServer({
        server: fastify.server,
        path: path.startsWith("/") ? path : `/${path}`,
    });

    // Храним соответствие ws -> stream, чтобы гарантированно его разрушать
    const wsToStream = new Map();

    wss.on("connection", (ws) => {
        const stream = createWebSocketStream(ws, { binary: true });
        wsToStream.set(ws, stream);

        broker.handle(stream);

        const cleanup = () => {
            try {
                stream.destroy();
            } catch {}
            wsToStream.delete(ws);
        };

        ws.on("close", cleanup);
        ws.on("error", (err) => {
            fastify.log.warn({ err }, "ws error");
            cleanup();
        });

        stream.on("error", (err) => {
            fastify.log.warn({ err }, "ws stream error");
            // при ошибке тоже гасим всё
            try {
                ws.terminate();
            } catch {}
            cleanup();
        });
    });

    async function closeWsWrapper() {
        fastify.log.info("Closing MQTT over WS clients...");

        // 1) Пытаемся закрыть КАЖДОГО клиента цивильно (CloseFrame 1001),
        //    ждём 'close' с таймаутом, иначе terminate().
        const closePromises = [];
        for (const ws of wss.clients) {
            closePromises.push(
                new Promise((resolve) => {
                    let done = false;

                    const finish = () => {
                        if (done) return;
                        done = true;
                        // Всегда уничтожаем stream после закрытия/терминации
                        const stream = wsToStream.get(ws);
                        if (stream) {
                            try {
                                stream.destroy();
                            } catch {}
                            wsToStream.delete(ws);
                        }
                        resolve(null);
                    };

                    const timer = setTimeout(() => {
                        // не дождались — жёстко рубим
                        try {
                            ws.terminate();
                        } catch {}
                        finish();
                    }, 1000); // таймаут на graceful close клиента

                    ws.once("close", () => {
                        clearTimeout(timer);
                        finish();
                    });

                    try {
                        // Code 1001 "Going away" — стандартный для shutdown
                        ws.close(1001, "Server shutting down");
                    } catch {
                        try {
                            ws.terminate();
                        } catch {}
                    }
                }),
            );
        }

        await Promise.all(closePromises);

        // 2) Закрываем сам WSS (перестаём принимать апгрейды)
        fastify.log.info("Closing WSS...");
        await new Promise((resolve) => wss.close(() => resolve()));

        // 3) На всякий пожарный добиваем оставшихся (их быть не должно)
        for (const ws of wss.clients) {
            try {
                ws.terminate();
            } catch {}
            const stream = wsToStream.get(ws);
            if (stream) {
                try {
                    stream.destroy();
                } catch {}
                wsToStream.delete(ws);
            }
        }

        fastify.log.info("MQTT over WS closed.");
    }

    fastify.decorate("closeWsWrapper", closeWsWrapper);

    fastify.log.info(
        `MQTT over WS: ws://<host>${path.startsWith("/") ? "" : "/"}${path}`,
    );
    return { wss, closeWsWrapper };
}
