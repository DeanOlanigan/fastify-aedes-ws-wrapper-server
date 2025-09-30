import {
    startDemoPublishers,
    stopDemoPublishers,
} from "../broker/demo/publishers.js";

export default async function mqttRoutes(fastify, opts) {
    const { broker } = opts;

    // GET /mqtt/demo
    fastify.put("/mqtt/demo", async () => {
        startDemoPublishers(broker);
        return { ok: true, ts: Date.now() };
    });

    // DELETE /mqtt/demo
    fastify.delete("/mqtt/demo", async () => {
        stopDemoPublishers();
        return { ok: true, ts: Date.now() };
    });

    // GET /mqtt/clients
    fastify.get("/mqtt/clients", async () => {
        const list = [];
        for (const c of Object.values(broker.clients)) {
            list.push({
                id: c.id,
                connected: !!c.connected,
                ip: c.conn?.remoteAddress,
                port: c.conn?.remotePort,
            });
        }
        return { count: list.length, clients: list };
    });

    // POST /mqtt/publish
    fastify.post("/mqtt/publish", async (req, reply) => {
        const { topic, payload, qos = 0, retain = false } = req.body ?? {};
        if (!topic || typeof topic !== "string")
            return reply.code(400).send({ error: "topic is required" });

        const data =
            typeof payload === "string" || Buffer.isBuffer(payload)
                ? payload
                : JSON.stringify(payload ?? {});
        await new Promise((resolve, reject) =>
            broker.publish({ topic, payload: data, qos, retain }, (err) =>
                err ? reject(err) : resolve()
            )
        );
        return { ok: true, topic, qos, retain };
    });

    // POST /mqtt/retain/clear
    fastify.post("/mqtt/retain/clear", async (req, reply) => {
        const { topic, qos = 1 } = req.body ?? {};
        if (!topic) return reply.code(400).send({ error: "topic is required" });
        await new Promise((resolve, reject) =>
            broker.publish(
                { topic, payload: Buffer.alloc(0), qos, retain: true },
                (e) => (e ? reject(e) : resolve())
            )
        );
        return { ok: true, topic };
    });
}
