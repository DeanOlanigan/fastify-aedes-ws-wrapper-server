// journal-generator.js
import { v7 as uuidv7 } from "uuid";

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, precision = 2) {
    const value = Math.random() * (max - min) + min;
    return Number(value.toFixed(precision));
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function chance(probability) {
    return Math.random() < probability;
}

function weightedPick(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;

    for (const item of items) {
        roll -= item.weight;
        if (roll <= 0) return item.value;
    }

    return items[items.length - 1].value;
}

function hashLike() {
    return Math.random().toString(16).slice(2, 10);
}

const USERS = [
    { id: "u_admin", login: "admin", name: "Administrator" },
    { id: "u_operator", login: "operator", name: "Main Operator" },
    { id: "u_engineer", login: "engineer", name: "Service Engineer" },
    { id: "u_viewer", login: "viewer", name: "Viewer" },
];

const VARIABLES = [
    {
        id: "var_tank_level",
        name: "TankLevel",
        desc: "Уровень в резервуаре",
        dataType: "float",
        unit: "%",
        group: "state",
        limits: { low: 20, high: 85 },
        valueRange: { min: 0, max: 100 },
    },
    {
        id: "var_temp_reactor",
        name: "ReactorTemp",
        desc: "Температура реактора",
        dataType: "float",
        unit: "°C",
        group: "danger",
        limits: { low: 40, high: 95 },
        valueRange: { min: 20, max: 120 },
    },
    {
        id: "var_line_pressure",
        name: "LinePressure",
        desc: "Давление в линии",
        dataType: "float",
        unit: "bar",
        group: "warn",
        limits: { low: 1.5, high: 6.5 },
        valueRange: { min: 0, max: 10 },
    },
    {
        id: "var_pump_state",
        name: "PumpState",
        desc: "Состояние насоса",
        dataType: "boolean",
        group: "state",
    },
    {
        id: "var_valve_mode",
        name: "ValveMode",
        desc: "Режим клапана",
        dataType: "string",
        group: "state",
    },
    {
        id: "var_power_kw",
        name: "DrivePower",
        desc: "Мощность привода",
        dataType: "float",
        unit: "kW",
        group: "warn",
        limits: { low: 2, high: 18 },
        valueRange: { min: 0, max: 22 },
    },
];

const PROJECTS = [
    "MainStation",
    "BoilerRoom",
    "WaterTreatment",
    "PackagingLine",
    "TestBench",
];

const HMI_FILES = [
    "main-station.rim",
    "boiler-room.rim",
    "water-treatment.rim",
    "packaging-line.rim",
    "backup-project.rimzip",
];

const SERVER_SCOPES = [
    "mqtt-broker",
    "http-server",
    "modbus-service",
    "iec104-service",
    "journal-service",
    "auth-service",
];

const SOFTWARE_PACKAGES = [
    "firmware-2.3.1.pkg",
    "runtime-2.3.1.pkg",
    "server-core-2.3.1.pkg",
];

const QUALITY = ["good", "uncertain", "bad"];
const BOOL_VALUES = [true, false];
const STRING_STATES = ["manual", "auto", "remote", "local"];

function getActor(type = "user") {
    if (type === "system") {
        return {
            type: "system",
            id: "system",
            login: "system",
            name: "System",
        };
    }

    const user = pick(USERS);
    return {
        type: "user",
        id: user.id,
        login: user.login,
        name: user.name,
    };
}

function getAckPending() {
    return {
        state: "pending",
        by: null,
        at: null,
    };
}

function getAckDone() {
    const user = pick(USERS);
    return {
        state: "acknowledged",
        by: {
            id: user.id,
            login: user.login,
            name: user.name,
        },
        at: Date.now() - randomInt(5_000, 300_000),
    };
}

function buildVariableRef(variable) {
    const ref = {
        id: variable.id,
        name: variable.name,
        dataType: variable.dataType,
        group: variable.group,
    };

    if (variable.desc) ref.desc = variable.desc;
    if (variable.unit) ref.unit = variable.unit;

    return ref;
}

function generateValueForVariable(variable) {
    if (variable.dataType === "boolean") {
        return pick(BOOL_VALUES);
    }

    if (variable.dataType === "string") {
        return pick(STRING_STATES);
    }

    return randomFloat(
        variable.valueRange?.min ?? 0,
        variable.valueRange?.max ?? 100,
        2,
    );
}

function generateDifferentValue(variable, oldValue) {
    let next = generateValueForVariable(variable);

    for (let i = 0; i < 5; i += 1) {
        if (next !== oldValue) return next;
        next = generateValueForVariable(variable);
    }

    if (typeof oldValue === "number") {
        return Number((oldValue + randomFloat(0.1, 3, 2)).toFixed(2));
    }

    if (typeof oldValue === "boolean") {
        return !oldValue;
    }

    return `${oldValue}-changed`;
}

function generateVariableValueChanged() {
    const variable = pick(VARIABLES);
    const oldValue = generateValueForVariable(variable);
    const newValue = generateDifferentValue(variable, oldValue);

    const payload = {
        variable: buildVariableRef(variable),
        change: {
            oldValue,
            newValue,
        },
    };

    if (
        typeof oldValue === "number" &&
        typeof newValue === "number"
    ) {
        payload.change.delta = Number((newValue - oldValue).toFixed(2));
    }

    if (variable.limits) {
        payload.limits = variable.limits;
    }

    return {
        category: "variable",
        event: "variable.value_changed",
        severity: "info",
        message: `Изменено значение переменной ${variable.name}: ${oldValue} → ${newValue}${
            variable.unit ? ` ${variable.unit}` : ""
        }`,
        ack: null,
        actor: chance(0.85) ? getActor("system") : getActor("user"),
        payload,
    };
}

function generateVariableStateChanged() {
    const variable = pick(
        VARIABLES.filter((v) => v.dataType === "boolean" || v.dataType === "string"),
    );

    const oldValue = generateValueForVariable(variable);
    const newValue = generateDifferentValue(variable, oldValue);

    return {
        category: "variable",
        event: "variable.state_changed",
        severity: "info",
        message: `Изменено состояние переменной ${variable.name}: ${oldValue} → ${newValue}`,
        ack: null,
        actor: chance(0.9) ? getActor("system") : getActor("user"),
        payload: {
            variable: buildVariableRef(variable),
            change: {
                oldValue,
                newValue,
            },
        },
    };
}

function generateVariableQualityChanged() {
    const variable = pick(VARIABLES);
    const oldValue = pick(QUALITY);
    const newValue = pick(QUALITY.filter((v) => v !== oldValue));

    return {
        category: "variable",
        event: "variable.quality_changed",
        severity: newValue === "bad" ? "warning" : "info",
        message: `Изменилось качество данных переменной ${variable.name}: ${oldValue} → ${newValue}`,
        ack: newValue === "bad" ? getAckPending() : null,
        actor: getActor("system"),
        payload: {
            variable: buildVariableRef(variable),
            change: {
                oldValue,
                newValue,
            },
            quality: newValue,
        },
    };
}

function generateVariableThreshold(kind) {
    const variable = pick(
        VARIABLES.filter(
            (v) => v.dataType === "float" && v.limits && typeof v.limits[kind] === "number",
        ),
    );

    const thresholdValue = variable.limits[kind];
    const overshoot = kind === "high"
        ? randomFloat(0.2, 10, 2)
        : randomFloat(0.2, 8, 2);

    const value =
        kind === "high"
            ? Number((thresholdValue + overshoot).toFixed(2))
            : Number((thresholdValue - overshoot).toFixed(2));

    const event = kind === "high"
        ? "variable.threshold_high"
        : "variable.threshold_low";

    return {
        category: "variable",
        event,
        severity: variable.group === "danger" ? "critical" : "warning",
        message:
            kind === "high"
                ? `Превышен верхний порог ${variable.name}: ${value}${variable.unit ? ` ${variable.unit}` : ""}`
                : `Превышен нижний порог ${variable.name}: ${value}${variable.unit ? ` ${variable.unit}` : ""}`,
        ack: getAckPending(),
        actor: getActor("system"),
        payload: {
            variable: buildVariableRef(variable),
            value,
            threshold: {
                kind,
                value: thresholdValue,
            },
            limits: variable.limits,
            quality: chance(0.9) ? "good" : "uncertain",
        },
    };
}

function generateUserSession(event) {
    const user = pick(USERS);

    const payload = {
        user: {
            id: user.id,
            login: user.login,
            name: user.name,
        },
    };

    if (event !== "user.login") {
        if (chance(0.8)) {
            payload.session = {
                id: uuidv7(),
                ip: `192.168.1.${randomInt(10, 220)}`,
            };
        }
    } else {
        payload.session = {
            id: uuidv7(),
            ip: `192.168.1.${randomInt(10, 220)}`,
        };
    }

    if (event === "user.login_failed") {
        payload.reason = pick([
            "Неверный пароль",
            "Пользователь заблокирован",
            "Истек срок действия пароля",
            "Учетная запись отключена",
        ]);
    }

    if (event === "user.session_expired") {
        payload.reason = pick([
            "Истек таймаут бездействия",
            "Сессия завершена администратором",
            "Повторный вход с другого устройства",
        ]);
    }

    const messageMap = {
        "user.login": `Пользователь ${user.login} выполнил вход`,
        "user.logout": `Пользователь ${user.login} вышел из системы`,
        "user.login_failed": `Неудачная попытка входа пользователя ${user.login}`,
        "user.session_expired": `Сессия пользователя ${user.login} завершена`,
    };

    const severityMap = {
        "user.login": "info",
        "user.logout": "info",
        "user.login_failed": "warning",
        "user.session_expired": "warning",
    };

    return {
        category: "user",
        event,
        severity: severityMap[event],
        message: messageMap[event],
        ack: null,
        actor: event === "user.login_failed" ? getActor("system") : getActor("user"),
        payload,
    };
}

function generateEventAcknowledged() {
    const target = weightedPick([
        { value: generateVariableThreshold("high"), weight: 3 },
        { value: generateVariableThreshold("low"), weight: 2 },
        {
            value: {
                event: "server.error",
                message: "Ошибка сервиса journal-service",
            },
            weight: 1,
        },
    ]);

    const targetEvent =
        target.event && target.message
            ? {
                  id: uuidv7(),
                  event: target.event,
                  message: target.message,
              }
            : {
                  id: uuidv7(),
                  event: "server.error",
                  message: "Ошибка сервиса",
              };

    const actor = getActor("user");

    return {
        category: "event",
        event: "event.acknowledged",
        severity: "info",
        message: `Событие ${targetEvent.event} квитировано пользователем ${actor.login}`,
        ack: getAckDone(),
        actor,
        payload: {
            targetEvent,
        },
    };
}

function generateConfigUpdated() {
    const fromName = pick([
        "config-v1.xml",
        "config-prod.xml",
        "baseline.xml",
    ]);
    const toName = pick([
        "config-v2.xml",
        "config-prod-new.xml",
        "updated-config.xml",
    ]);

    return {
        category: "config",
        event: "config.updated",
        severity: "info",
        message: `Конфигурация обновлена: ${fromName} → ${toName}`,
        ack: null,
        actor: chance(0.6) ? getActor("user") : getActor("system"),
        payload: {
            fromName,
            fromHash: hashLike(),
            toName,
            toHash: hashLike(),
        },
    };
}

function generateHmiProjectEvent(event) {
    const project = pick(PROJECTS);

    const messageMap = {
        "hmi.opened": `Открыт HMI-проект ${project}`,
        "hmi.saved": `Сохранен HMI-проект ${project}`,
    };

    return {
        category: "hmi",
        event,
        severity: "info",
        message: messageMap[event],
        ack: null,
        actor: getActor("user"),
        payload: {
            project: {
                name: project,
            },
        },
    };
}

function generateHmiFileEvent(event) {
    const file = pick(HMI_FILES);
    const size = randomInt(25_000, 8_000_000);

    const messageMap = {
        "hmi.uploaded": `Загружен файл проекта ${file}`,
        "hmi.deleted": `Удален файл проекта ${file}`,
    };

    return {
        category: "hmi",
        event,
        severity: event === "hmi.deleted" ? "warning" : "info",
        message: messageMap[event],
        ack: null,
        actor: getActor("user"),
        payload: {
            file: {
                name: file,
                size,
            },
        },
    };
}

function generateServerEvent(event) {
    const scope = pick(SERVER_SCOPES);

    const reasonMap = {
        "server.started": "Сервис успешно запущен",
        "server.stopped": "Сервис остановлен",
        "server.restarted": "Сервис перезапущен",
        "server.error": pick([
            "Ошибка подключения к брокеру",
            "Ошибка чтения конфигурации",
            "Порт уже занят",
            "Нарушение связи с внешним устройством",
        ]),
        "server.warning": pick([
            "Высокая задержка ответа",
            "Очередь сообщений растет",
            "Повышенное время записи журнала",
            "Недостаточно свободной памяти",
        ]),
    };

    const severityMap = {
        "server.started": "info",
        "server.stopped": "warning",
        "server.restarted": "info",
        "server.error": "error",
        "server.warning": "warning",
    };

    return {
        category: "server",
        event,
        severity: severityMap[event],
        message: `[${scope}] ${reasonMap[event]}`,
        ack: event === "server.error" || event === "server.warning" ? getAckPending() : null,
        actor: getActor("system"),
        payload: {
            scope,
            reason: reasonMap[event],
            details: chance(0.7)
                ? pick([
                      "operation timed out",
                      "connection refused",
                      "service restarted by watchdog",
                      "using fallback configuration",
                  ])
                : undefined,
        },
    };
}

function generateSettingsChanged(event) {
    const section =
        event === "settings.webserver.changed" ? "webserver" : "retention";

    const changePool =
        section === "webserver"
            ? [
                  {
                      field: "port",
                      oldValue: 8080,
                      newValue: 8081,
                  },
                  {
                      field: "httpsEnabled",
                      oldValue: false,
                      newValue: true,
                  },
                  {
                      field: "sessionTimeoutSec",
                      oldValue: 900,
                      newValue: 1800,
                  },
              ]
            : [
                  {
                      field: "journalDays",
                      oldValue: 30,
                      newValue: 60,
                  },
                  {
                      field: "maxRecords",
                      oldValue: 100000,
                      newValue: 250000,
                  },
                  {
                      field: "cleanupIntervalMin",
                      oldValue: 60,
                      newValue: 30,
                  },
              ];

    const count = randomInt(1, 2);
    const changes = [...changePool].sort(() => Math.random() - 0.5).slice(0, count);

    return {
        category: "settings",
        event,
        severity: "info",
        message:
            section === "webserver"
                ? "Изменены настройки веб-сервера"
                : "Изменены настройки хранения данных",
        ack: null,
        actor: getActor("user"),
        payload: {
            settings: {
                section,
            },
            changes,
        },
    };
}

function generateSecurityUsers(event) {
    const user = pick(USERS);

    const payload = {
        user: {
            id: user.id,
            login: user.login,
            name: user.name,
        },
    };

    if (event === "security.users.changed") {
        payload.changes = [
            pick([
                {
                    field: "name",
                    oldValue: user.name,
                    newValue: `${user.name} Updated`,
                },
                {
                    field: "role",
                    oldValue: "viewer",
                    newValue: "operator",
                },
                {
                    field: "enabled",
                    oldValue: false,
                    newValue: true,
                },
            ]),
        ];
    }

    return {
        category: "security",
        event,
        severity: event === "security.users.deleted" ? "warning" : "info",
        message:
            event === "security.users.deleted"
                ? `Удален пользователь ${user.login}`
                : `Изменен пользователь ${user.login}`,
        ack: null,
        actor: getActor("user"),
        payload,
    };
}

function generateSecurityRoles(event) {
    const role = pick([
        { id: "admin", name: "Administrator" },
        { id: "operator", name: "Operator" },
        { id: "viewer", name: "Viewer" },
        { id: "engineer", name: "Engineer" },
    ]);

    const payload = {
        role,
    };

    if (event === "security.roles.changed") {
        payload.changes = [
            pick([
                {
                    field: "name",
                    oldValue: role.name,
                    newValue: `${role.name} Updated`,
                },
                {
                    field: "rights.monitoring.view",
                    oldValue: false,
                    newValue: true,
                },
                {
                    field: "rights.settings.edit",
                    oldValue: false,
                    newValue: true,
                },
            ]),
        ];
    }

    return {
        category: "security",
        event,
        severity: event === "security.roles.deleted" ? "warning" : "info",
        message:
            event === "security.roles.deleted"
                ? `Удалена роль ${role.name}`
                : `Изменена роль ${role.name}`,
        ack: null,
        actor: getActor("user"),
        payload,
    };
}

function generateSecurityLicense(event) {
    const key = `LIC-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`;

    return {
        category: "security",
        event,
        severity: event === "security.license.expired" ? "critical" : "info",
        message:
            event === "security.license.expired"
                ? "Срок действия лицензии истек"
                : "Лицензия обновлена",
        ack: event === "security.license.expired" ? getAckPending() : null,
        actor: event === "security.license.expired" ? getActor("system") : getActor("user"),
        payload: {
            key,
            status: event === "security.license.expired" ? "expired" : "updated",
        },
    };
}

function generateSoftwareUpdate(event) {
    const fromVersion = pick(["2.2.0", "2.2.5", "2.3.0"]);
    const toVersion = pick(["2.3.1", "2.4.0", "2.4.1"]);
    const packageName = pick(SOFTWARE_PACKAGES);

    const messageMap = {
        "system.software_update.started": `Начато обновление ПО до версии ${toVersion}`,
        "system.software_update.finished": `Обновление ПО завершено, установлена версия ${toVersion}`,
        "system.software_update.failed": `Ошибка обновления ПО до версии ${toVersion}`,
        "system.software_update.canceled": `Обновление ПО отменено`,
    };

    const severityMap = {
        "system.software_update.started": "info",
        "system.software_update.finished": "info",
        "system.software_update.failed": "error",
        "system.software_update.canceled": "warning",
    };

    const detailsMap = {
        "system.software_update.started": "download and verification started",
        "system.software_update.finished": "package installed successfully",
        "system.software_update.failed": pick([
            "checksum mismatch",
            "not enough free space",
            "package signature invalid",
            "reboot required but unavailable",
        ]),
        "system.software_update.canceled": "operation canceled by user",
    };

    return {
        category: "system",
        event,
        severity: severityMap[event],
        message: messageMap[event],
        ack:
            event === "system.software_update.failed"
                ? getAckPending()
                : null,
        actor:
            event === "system.software_update.canceled"
                ? getActor("user")
                : getActor("system"),
        payload: {
            update: {
                fromVersion,
                toVersion,
                packageName,
            },
            details: detailsMap[event],
        },
    };
}

function stripUndefined(obj) {
    if (Array.isArray(obj)) {
        return obj.map(stripUndefined);
    }

    if (obj && typeof obj === "object") {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                result[key] = stripUndefined(value);
            }
        }
        return result;
    }

    return obj;
}

export function generateJournalMessage() {
    const event = weightedPick([
        { value: "variable.value_changed", weight: 24 },
        { value: "variable.state_changed", weight: 10 },
        { value: "variable.quality_changed", weight: 5 },
        { value: "variable.threshold_high", weight: 6 },
        { value: "variable.threshold_low", weight: 4 },

        { value: "user.login", weight: 4 },
        { value: "user.logout", weight: 3 },
        { value: "user.login_failed", weight: 2 },
        { value: "user.session_expired", weight: 2 },

        { value: "event.acknowledged", weight: 2 },
        { value: "config.updated", weight: 2 },

        { value: "hmi.opened", weight: 3 },
        { value: "hmi.uploaded", weight: 2 },
        { value: "hmi.saved", weight: 3 },
        { value: "hmi.deleted", weight: 1 },

        { value: "server.started", weight: 1 },
        { value: "server.stopped", weight: 1 },
        { value: "server.restarted", weight: 1 },
        { value: "server.error", weight: 2 },
        { value: "server.warning", weight: 2 },

        { value: "settings.webserver.changed", weight: 2 },
        { value: "settings.retention.changed", weight: 2 },

        { value: "security.users.changed", weight: 2 },
        { value: "security.users.deleted", weight: 1 },
        { value: "security.roles.changed", weight: 2 },
        { value: "security.roles.deleted", weight: 1 },
        { value: "security.license.changed", weight: 1 },
        { value: "security.license.expired", weight: 1 },

        { value: "system.software_update.started", weight: 1 },
        { value: "system.software_update.finished", weight: 1 },
        { value: "system.software_update.failed", weight: 1 },
        { value: "system.software_update.canceled", weight: 1 },
    ]);

    let base;

    switch (event) {
        case "variable.value_changed":
            base = generateVariableValueChanged();
            break;
        case "variable.state_changed":
            base = generateVariableStateChanged();
            break;
        case "variable.quality_changed":
            base = generateVariableQualityChanged();
            break;
        case "variable.threshold_high":
            base = generateVariableThreshold("high");
            break;
        case "variable.threshold_low":
            base = generateVariableThreshold("low");
            break;

        case "user.login":
        case "user.logout":
        case "user.login_failed":
        case "user.session_expired":
            base = generateUserSession(event);
            break;

        case "event.acknowledged":
            base = generateEventAcknowledged();
            break;

        case "config.updated":
            base = generateConfigUpdated();
            break;

        case "hmi.opened":
        case "hmi.saved":
            base = generateHmiProjectEvent(event);
            break;

        case "hmi.uploaded":
        case "hmi.deleted":
            base = generateHmiFileEvent(event);
            break;

        case "server.started":
        case "server.stopped":
        case "server.restarted":
        case "server.error":
        case "server.warning":
            base = generateServerEvent(event);
            break;

        case "settings.webserver.changed":
        case "settings.retention.changed":
            base = generateSettingsChanged(event);
            break;

        case "security.users.changed":
        case "security.users.deleted":
            base = generateSecurityUsers(event);
            break;

        case "security.roles.changed":
        case "security.roles.deleted":
            base = generateSecurityRoles(event);
            break;

        case "security.license.changed":
        case "security.license.expired":
            base = generateSecurityLicense(event);
            break;

        case "system.software_update.started":
        case "system.software_update.finished":
        case "system.software_update.failed":
        case "system.software_update.canceled":
            base = generateSoftwareUpdate(event);
            break;

        default:
            base = generateVariableValueChanged();
            break;
    }

    return stripUndefined({
        schemaVersion: 1,
        id: uuidv7(),
        ts: Date.now(),
        category: base.category,
        event: base.event,
        severity: base.severity,
        message: base.message,
        ack: base.ack,
        actor: base.actor,
        payload: base.payload,
    });
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
