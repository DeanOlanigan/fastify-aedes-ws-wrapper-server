const USERS = [
    { login: "operator", name: "Иванов И.И.", role: "operator" },
    { login: "engineer", name: "Петров П.П.", role: "engineer" },
    { login: "admin", name: "Сидоров С.С.", role: "admin" },
    { login: "dispatcher", name: "Кузнецов А.А.", role: "dispatcher" },
];

const SCHEMES = [
    "Главная",
    "Насосная станция",
    "Котельная",
    "Очистные сооружения",
    "Подстанция 1",
];

const VARIABLES = [
    {
        key: "pump1.state",
        label: "Насос 1",
        group: "state",
        type: "boolean",
        value: false,
    },
    {
        key: "pump2.state",
        label: "Насос 2",
        group: "state",
        type: "boolean",
        value: true,
    },
    {
        key: "valve1.state",
        label: "Задвижка 1",
        group: "state",
        type: "boolean",
        value: true,
    },
    {
        key: "tank1.level",
        label: "Уровень в резервуаре 1",
        group: "noGroup",
        type: "analog",
        unit: "%",
        min: 15,
        max: 95,
        step: 8,
        value: 61.4,
    },
    {
        key: "line.pressure",
        label: "Давление в линии",
        group: "warn",
        type: "analog",
        unit: "бар",
        min: 1.2,
        max: 8.5,
        step: 0.8,
        value: 4.7,
    },
    {
        key: "boiler.temp",
        label: "Температура котла",
        group: "danger",
        type: "analog",
        unit: "°C",
        min: 45,
        max: 110,
        step: 6,
        value: 73.2,
    },
    {
        key: "energy.daily",
        label: "Суточное потребление энергии",
        group: "noGroup",
        type: "counter",
        unit: "кВт·ч",
        min: 1200,
        max: 2400,
        step: 120,
        value: 1680,
    },
];

const EVENT_WEIGHTS = [
    { kind: "auth_success", weight: 12 },
    { kind: "auth_fail", weight: 4 },
    { kind: "logout", weight: 8 },
    { kind: "variable_change", weight: 28 },
    { kind: "alarm_raise", weight: 14 },
    { kind: "alarm_ack", weight: 8 },
    { kind: "scheme_open", weight: 8 },
    { kind: "scheme_save", weight: 5 },
    { kind: "scheme_delete", weight: 1 },
    { kind: "config_change", weight: 6 },
    { kind: "server_stop", weight: 1 },
    { kind: "heartbeat", weight: 5 },
];

const state = {
    loggedUsers: new Set(["operator"]),
    activeAlarms: new Map(), // key -> { since, value, threshold, text }
};

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function roll(p) {
    return Math.random() < p;
}

function pickWeighted(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * total;

    for (const item of items) {
        r -= item.weight;
        if (r <= 0) return item.kind;
    }

    return items[items.length - 1].kind;
}

function randomBetween(min, max, digits = 1) {
    const n = min + Math.random() * (max - min);
    return Number(n.toFixed(digits));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function chooseUser(preferLogged = false) {
    const logged = USERS.filter((u) => state.loggedUsers.has(u.login));
    if (preferLogged && logged.length) return pick(logged);
    return pick(USERS);
}

function chooseVariable(filterFn = () => true) {
    const list = VARIABLES.filter(filterFn);
    return pick(list.length ? list : VARIABLES);
}

function formatValue(variable, value) {
    if (variable.type === "boolean") {
        return value ? "ВКЛ" : "ВЫКЛ";
    }
    return `${value} ${variable.unit || ""}`.trim();
}

function updateVariable(variable) {
    const oldValue = variable.value;
    let newValue = oldValue;

    if (variable.type === "boolean") {
        newValue = !oldValue;
    } else if (variable.type === "analog" || variable.type === "counter") {
        const delta = (Math.random() * 2 - 1) * variable.step;
        newValue = clamp(oldValue + delta, variable.min, variable.max);

        const digits = variable.step < 1 ? 2 : 1;
        newValue = Number(newValue.toFixed(digits));
    }

    variable.value = newValue;
    return { oldValue, newValue };
}

function makeBase(type, user) {
    return {
        type,
        ts: Date.now(),
        user: user?.login || null,
        who_ack: null,
        ack_time: null,
        needAck: true,
    };
}

function genAuthSuccess() {
    const user = chooseUser(false);
    state.loggedUsers.add(user.login);

    return {
        ...makeBase("info", user),
        event: "Авторизация пользователя",
        group: "noGroup",
        variable: null,
        info: `Пользователь ${user.name} (${user.login}) успешно вошёл в систему`,
    };
}

function genAuthFail() {
    const user = pick(USERS);

    return {
        ...makeBase("warn", user),
        event: "Неудачная попытка авторизации",
        group: "warn",
        variable: null,
        info: `Неудачная попытка входа для пользователя ${user.login}`,
    };
}

function genLogout() {
    const user = chooseUser(true);
    state.loggedUsers.delete(user.login);

    return {
        ...makeBase("info", user),
        event: "Выход пользователя",
        group: "noGroup",
        variable: null,
        info: `Пользователь ${user.name} (${user.login}) вышел из системы`,
    };
}

function genVariableChange() {
    const variable = chooseVariable((v) => !state.activeAlarms.has(v.key));
    const user = chooseUser(true);
    const { oldValue, newValue } = updateVariable(variable);

    return {
        ...makeBase("info", user),
        event: "Изменение переменной",
        group: variable.group,
        variable: variable.key,
        info: `${variable.label}: ${formatValue(variable, oldValue)} → ${formatValue(variable, newValue)}`,
        old_value: oldValue,
        new_value: newValue,
    };
}

function genAlarmRaise() {
    const variable = chooseVariable((v) => v.type === "analog" && !state.activeAlarms.has(v.key));
    const user = chooseUser(true);

    let threshold;
    let newValue;
    let text;

    if (variable.key === "boiler.temp") {
        threshold = 95;
        newValue = randomBetween(96, 108, 1);
        text = "Превышение температуры";
    } else if (variable.key === "line.pressure") {
        threshold = 7.5;
        newValue = randomBetween(7.6, 8.4, 1);
        text = "Высокое давление";
    } else {
        threshold = 90;
        newValue = randomBetween(91, 97, 1);
        text = "Превышение уставки";
    }

    variable.value = newValue;
    state.activeAlarms.set(variable.key, {
        since: Date.now(),
        value: newValue,
        threshold,
        text,
    });

    return {
        ...makeBase("error", user),
        event: "Аварийное состояние",
        group: variable.group,
        variable: variable.key,
        info: `${text}: ${variable.label} = ${formatValue(variable, newValue)} (порог ${threshold}${variable.unit || ""})`,
    };
}

function genAlarmAck() {
    const activeEntries = [...state.activeAlarms.entries()];

    if (!activeEntries.length) {
        return genVariableChange();
    }

    const [key, alarm] = pick(activeEntries);
    const variable = VARIABLES.find((v) => v.key === key);
    const user = chooseUser(true);
    const ackTime = Date.now();

    state.activeAlarms.delete(key);

    return {
        ...makeBase("warn", user),
        event: "Квитирование",
        group: variable.group,
        variable: variable.key,
        info: `Квитировано событие: ${alarm.text} (${variable.label})`,
        who_ack: user.login,
        ack_time: ackTime,
        needAck: false,
    };
}

function genSchemeOpen() {
    const scheme = pick(SCHEMES);
    const user = chooseUser(true);

    return {
        ...makeBase("info", user),
        event: "Открытие мнемосхемы",
        group: "noGroup",
        variable: null,
        info: `Открыта мнемосхема "${scheme}"`,
    };
}

function genSchemeSave() {
    const scheme = pick(SCHEMES);
    const user = chooseUser(true);

    return {
        ...makeBase("info", user),
        event: "Сохранение мнемосхемы",
        group: "noGroup",
        variable: null,
        info: `Сохранена мнемосхема "${scheme}"`,
    };
}

function genSchemeDelete() {
    const scheme = pick(SCHEMES);
    const user = chooseUser(true);

    return {
        ...makeBase("warn", user),
        event: "Удаление мнемосхемы",
        group: "warn",
        variable: null,
        info: `Удалена мнемосхема "${scheme}"`,
    };
}

function genConfigChange() {
    const user = chooseUser(true);
    const sections = [
        "сетевые настройки",
        "MQTT-клиент",
        "IEC 61850",
        "журналирование",
        "права доступа",
        "архивация",
    ];
    const section = pick(sections);

    return {
        ...makeBase("info", user),
        event: "Изменение конфигурации",
        group: "noGroup",
        variable: null,
        info: `Изменён раздел конфигурации: ${section}`,
    };
}

function genServerStop() {
    const user = chooseUser(true);

    return {
        ...makeBase("error", user),
        event: "Остановка сервера",
        group: "danger",
        variable: null,
        info: "Сервер остановлен по команде пользователя",
    };
}

function genHeartbeat() {
    const variable = chooseVariable((v) => v.type === "analog" || v.type === "counter");
    const user = chooseUser(true);

    return {
        ...makeBase("info", user),
        event: "Периодическое сообщение",
        group: variable.group,
        variable: variable.key,
        info: `${variable.label}: текущее значение ${formatValue(variable, variable.value)}`,
    };
}

function generateJournalMessage() {
    const kind = pickWeighted(EVENT_WEIGHTS);

    switch (kind) {
        case "auth_success":
            return genAuthSuccess();
        case "auth_fail":
            return genAuthFail();
        case "logout":
            return genLogout();
        case "variable_change":
            return genVariableChange();
        case "alarm_raise":
            return genAlarmRaise();
        case "alarm_ack":
            return genAlarmAck();
        case "scheme_open":
            return genSchemeOpen();
        case "scheme_save":
            return genSchemeSave();
        case "scheme_delete":
            return genSchemeDelete();
        case "config_change":
            return genConfigChange();
        case "server_stop":
            return genServerStop();
        case "heartbeat":
        default:
            return genHeartbeat();
    }
}

export async function journal(broker) {
    const msg = generateJournalMessage();

    broker.publish({
        topic: "journal",
        payload: JSON.stringify(msg),
        qos: 0,
        retain: false,
    });
}
