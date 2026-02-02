const DEFAULTS = {
    periodMs: 1000,
    jitter: 0.25,
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
        const topic = `monitoring/node/${uuid}`;
        broker.publish({
            topic,
            payload: JSON.stringify(payload),
            qos: 0,
            retain: DEFAULTS.retain,
        });
    }
}

export function overrideValue(uuid, val) {
    // Простейшая валидация или преобразование типов
    let numericVal = parseFloat(val);

    // Если переменная была булевой (по твоей логике kind='bool')
    if (kinds.get(uuid) === 'bool') {
        // Приводим к булеву, если пришло true/false или 1/0
        // Но так как map хранит значения, можно упростить:
        values.set(uuid, !!val);
        return;
    }

    if (!isNaN(numericVal)) {
        // Ограничиваем, как в nextValue (0..100)
        if (numericVal < 0) numericVal = 0;
        if (numericVal > 100) numericVal = 100;
        values.set(uuid, numericVal);
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
        kind = roll(0.2) ? "bool" : "float";
        kinds.set(uuid, kind);
    }

    if (kind === "bool") {
        return { v: roll(0.5), kind };
    }

    const prev = values.get(uuid) ?? 20 + Math.random() * 10;

    let delta = (Math.random() - 0.5) * 2;

    if (Math.random() < 0.02) {
        delta += (Math.random() - 0.5) * 20; // кратковременный скачок
    }

    // Реалистичный дрейф к "среднему уровню" (затухающие колебания)
    const mean = 25;
    const drift = (mean - prev) * 0.05; // постепенное возвращение
    let next = prev + delta + drift;

    // Ограничиваем физически возможные пределы
    if (next < 0) next = 0;
    if (next > 100) next = 100;

    // Добавляем небольшой случайный шум
    next += (Math.random() - 0.5) * 0.3;

    // Сохраняем новое значение
    values.set(uuid, next);

    return { v: parseFloat(next.toFixed(3)), kind };
}
