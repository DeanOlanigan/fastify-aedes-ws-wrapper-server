export async function graph(broker) {
    const msg = {
        ts: Date.now(),
        name: "Demo name",
        desc: "Demo description",
        value: Math.random() * 100,
        measurement: "V",
    };
}
