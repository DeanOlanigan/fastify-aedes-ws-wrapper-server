const TYPES = ["ts", "tu"];
const GROUP = ["noGroup", "warn", "danger", "state"];

export async function journal(broker) {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const group = GROUP[Math.floor(Math.random() * GROUP.length)];

    const msg = {
        ts: Date.now(),
        type,
        name: "Demo name",
        desc: "Demo description",
        value: Math.random() * 100,
        group,
    };

    broker.publish({
        topic: "journal",
        payload: JSON.stringify(msg),
        qos: 0,
        retain: false,
    });
}
