export const CAPABILITIES = new Set(
    [
        "feature.protocol.gpio",
        "feature.protocol.modbus_tcp",
        "feature.protocol.modbus_rtu",
        "feature.protocol.iec104",
        "feature.protocol.goose",
        "feature.logs",
        "feature.journal",
        "feature.graphs",
        "feature.hmi",
        "feature.user_management",
        "feature.software_update",
        "feature.licensing",
    ]
)

export const PERMISSIONS = new Map([
    ["config.view", { requiredCapabilities: [] }],
    ["config.upload", { requiredCapabilities: [] }],
    ["config.create", { requiredCapabilities: [] }],
    ["config.open", { requiredCapabilities: [] }],
    ["config.edit", { requiredCapabilities: [] }],
    // подумать
    ["config.editor", { requiredCapabilities: [] }],

    ["server.start", { requiredCapabilities: [] }],
    ["server.stop", { requiredCapabilities: [] }],
    ["server.restart", { requiredCapabilities: [] }],

    ["monitoring.view", { requiredCapabilities: [] }],
    ["monitoring.variables.manual_input", { requiredCapabilities: [] }],
    ["monitoring.variables.signal_editor", { requiredCapabilities: [] }],
    ["monitoring.variables.telecontrol", { requiredCapabilities: [] }], // для cmd

    ["logs.view", { requiredCapabilities: ["feature.logs"] }],
    ["logs.download", { requiredCapabilities: ["feature.logs"] }],

    ["journal.view", { requiredCapabilities: ["feature.journal"] }],
    ["journal.download", { requiredCapabilities: ["feature.journal"] }],

    ["graphs.view", { requiredCapabilities: ["feature.graphs"] }],

    ["hmi.view", { requiredCapabilities: ["feature.hmi"] }],
    ["hmi.editor", { requiredCapabilities: ["feature.hmi"] }],
    ["hmi.upload", { requiredCapabilities: ["feature.hmi"] }],

    ["settings.view", { requiredCapabilities: [] }],
    ["settings.web_server.edit", { requiredCapabilities: [] }],
    ["settings.logs.edit", { requiredCapabilities: ["feature.logs"] }],
    ["settings.journal.edit", { requiredCapabilities: ["feature.journal"] }],
    ["security.users.edit", { requiredCapabilities: ["feature.user_management"] }],
    ["security.roles.edit", { requiredCapabilities: ["feature.user_management"] }],
    ["system.software_update", { requiredCapabilities: ["feature.software_update"] }],
    ["security.licensing.manage", { requiredCapabilities: ["feature.licensing"] }],
]);
