const NAMES = ["IRZGPIO_BattLow", "IRZGPIO_DoorOpen", "IRZGPIO_ACOk"];

export async function graph(broker) {
    for (const n of NAMES) {
        const msg = {
            ts: Date.now(),
            name: n,
            desc: "Demo description",
            value: Math.random() * 100,
            measurement: "V",
        };

        broker.publish({
            topic: `graph/${n}`,
            payload: JSON.stringify(msg),
            qos: 0,
            retain: false,
        });
    }
}
