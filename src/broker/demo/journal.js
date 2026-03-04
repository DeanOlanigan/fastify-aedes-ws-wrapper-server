const TYPES = ["ts", "tu"];
const GROUP = ["noGroup", "warn", "danger", "state"];
const VARS = ["var1", "var2", "var3", "var4", "var5"];

export async function journal(broker) {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const group = GROUP[Math.floor(Math.random() * GROUP.length)];
    const variable = VARS[Math.floor(Math.random() * VARS.length)];

    const msg = {
        ts: Date.now(),
        type,
        var: variable,
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
