const signalState = new Map();

const DEFAULTS = {
    retain: false,
    version: 1,
    now: () => Date.now(),
};

export function initLiveSignals(ids) {
    signalState.clear();
    for (const id of ids) {
        signalState.set(id, createSignalState(id));
    }
}

export function publishDueLiveSignals(ids, broker, options = {}) {
    const opt = { ...DEFAULTS, ...options };
    const now = opt.now();

    for (const id of ids) {
        const state = signalState.get(id);
        if (!state) continue;
        if (state.nextDueAt > now) continue;

        const next = advanceSignal(state, now);

        broker.publish({
            topic: `signals/live/by-id/${id}`,
            payload: JSON.stringify({
                ts: now,
                id,
                value: next.value,
                valueType: next.valueType,
                quality: next.quality,
                ...(next.unit ? { unit: next.unit } : {}),
                version: opt.version,
            }),
            qos: 0,
            retain: opt.retain,
        });
    }
}

function createSignalState(id) {
    const valueType = Math.random() < 0.2 ? "bool" : "float";
    const cadence = pickCadence();
    const behavior =
        valueType === "bool" ? pickOne(["stable", "bursty"]) : pickAnalogBehavior();

    const unit =
        valueType === "float"
            ? pickOne(["V", "A", "°C", "bar", "%", "Hz"])
            : undefined;

    const initialValue =
        valueType === "bool"
            ? Math.random() < 0.5
            : Number((20 + Math.random() * 10).toFixed(3));

    const now = Date.now();

    return {
        id,
        valueType,
        unit,
        cadence,
        behavior,
        value: initialValue,
        nextDueAt: now + nextIntervalMs(cadence),
    };
}

function advanceSignal(state, now) {
    const quality = qualityOk();

    if (state.valueType === "bool") {
        state.value = nextBoolValue(state.value, state.behavior);
    } else {
        state.value = nextFloatValue(state.value, state.behavior);
    }

    state.nextDueAt = now + nextIntervalMs(state.cadence);

    return {
        value: state.value,
        valueType: state.valueType,
        quality,
        unit: state.unit,
    };
}

function nextBoolValue(prev, behavior) {
    if (behavior === "stable") {
        return Math.random() < 0.1 ? !prev : prev;
    }

    // bursty
    if (Math.random() < 0.3) return !prev;
    return prev;
}

function nextFloatValue(prev, behavior) {
    let next = prev;

    if (behavior === "stable") {
        next += (Math.random() - 0.5) * 0.4;
    } else if (behavior === "noisy") {
        next += (Math.random() - 0.5) * 3.0;
    } else if (behavior === "drifting") {
        const mean = 25;
        const drift = (mean - prev) * 0.03;
        next += drift + (Math.random() - 0.5) * 1.0;
    } else if (behavior === "bursty") {
        next += (Math.random() - 0.5) * 1.0;
        if (Math.random() < 0.08) {
            next += (Math.random() - 0.5) * 15;
        }
    }

    if (next < 0) next = 0;
    if (next > 100) next = 100;

    return Number(next.toFixed(3));
}

function pickCadence() {
    const r = Math.random();
    if (r < 0.1) return "fast";
    if (r < 0.55) return "normal";
    if (r < 0.85) return "slow";
    return "rare";
}

function pickAnalogBehavior() {
    return pickOne(["stable", "noisy", "drifting", "bursty"]);
}

function nextIntervalMs(cadence) {
    switch (cadence) {
        case "fast":
            return randInt(100, 300);
        case "normal":
            return randInt(700, 1500);
        case "slow":
            return randInt(3000, 7000);
        case "rare":
            return randInt(15000, 60000);
        default:
            return 1000;
    }
}

function qualityOk() {
    const attributes = [];
    if (roll(0.5)) attributes.push("test");
    if (roll(0.7)) attributes.push("inaccurate");
    if (roll(0.15)) attributes.push("inconsistent");
    if (roll(0.3)) attributes.push("failure");
    if (roll(0.3)) attributes.push("oscillatory");
    if (roll(0.3)) attributes.push("badReference");
    if (roll(0.3)) attributes.push("outOfRange");
    if (roll(0.15)) attributes.push("blocked");
    if (roll(0.2)) attributes.push("overflowed");
    if (roll(0.2)) attributes.push("invalid");
    if (roll(0.35)) attributes.push("outdated");
    if (roll(0.4)) attributes.push("substituted");

    const bad = new Set([
        "blocked",
        "overflowed",
        "blocked",
        "substituted",
        "outdated",
        "invalid",
    ]);

    const good = !attributes.some((a) => bad.has(a));
    return { good, attributes };
}

function roll(p) {
    return Math.random() < p;
}

function randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
