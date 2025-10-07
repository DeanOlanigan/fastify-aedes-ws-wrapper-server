export async function graph(broker) {
    const msg = {
        ts: Date.now(),
        name: "IRZGPIO_BattLow",
        desc: "Demo description",
        value: Math.random() * 100,
        measurement: "V",
    };

    broker.publish({
        topic: "graph/IRZGPIO_BattLow",
        payload: JSON.stringify(msg),
        qos: 0,
        retain: false,
    });
}
