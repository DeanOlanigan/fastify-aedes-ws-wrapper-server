const DEFAULTS = {
    periodMs: 1000,
    jitter: 0.25,
    topicBase: "test",
    retain: false,
    source: "mixed",
};

const values = new Map();
const kinds = new Map();

export function tick(uniq, broker) {
    const batchSize = Math.max(1, Math.floor(uniq.length * 0.2));
    for (let i = 0; i < batchSize; i++) {
        const uuid = uniq[Math.floor(Math.random() * uniq.length)];
        const { v } = nextValue(uuid);
        const payload = {
            v,
            q: qualityOk(),
            src: pickSource(DEFAULTS),
            st: Date.now(),
            ver: 1,
        };
        const topic = `${DEFAULTS.topicBase}/node/${uuid}`;
        broker.publish({
            topic,
            payload: JSON.stringify(payload),
            qos: 0,
            retain: DEFAULTS.retain,
        });
    }
}

function roll(p) {
    return Math.random() < p;
}

function pickSource(opt) {
    if (opt.source === "mixed") {
        const arr = ["modbus", "iec104", "iec61850"];
        return arr[Math.floor(Math.random() * arr.length)];
    }
    return opt.source;
}

function qualityOk() {
    const attrs = [];
    if (roll(0.5)) attrs.push("additionalCalc");
    if (roll(0.7)) attrs.push("used");
    if (roll(0.15)) attrs.push("blocked");
    if (roll(0.2)) attrs.push("overflow");
    if (roll(0.25)) attrs.push("unknown");
    if (roll(0.6)) attrs.push("manual");
    if (roll(0.4)) attrs.push("substituted");
    if (roll(0.35)) attrs.push("notTopical");
    if (roll(0.2)) attrs.push("invalid");

    const good = !attrs.some((a) =>
        [
            "blocked",
            "overflow",
            "unknown",
            "manual",
            "substituted",
            "notTopical",
            "invalid",
        ].includes(a)
    );

    return { good, attrs };
}

function nextValue(uuid) {
    let kind = kinds.get(uuid);
    if (!kind) {
        kind = roll(0.3) ? "bool" : "float";
        kinds.set(uuid, kind);
    }
    if (kind === "bool") {
        return { v: roll(0.5), kind };
    }
    const prev = values.get(uuid) ?? 20 + Math.random() * 10;
    const step = (Math.random() - 0.5) * 4;
    let next = prev + step;
    if (next < 0) next = 0;
    if (next > 100) next = 100;
    values.set(uuid, next);
    return { v: next, kind };
}
