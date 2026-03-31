import { levelToNumber } from "../../routes/utils.js";

const LEVELS = ["info", "warn", "error"];

export async function log(broker) {
    /* const [sd, internal] = await Promise.all([
        listOfFilesWithSize("sd"),
        listOfFilesWithSize("internal"),
    ]);

    const logs = [...sd, ...internal];

    const log = logs[Math.floor(Math.random() * logs.length)]; */

    const level = LEVELS[Math.floor(Math.random() * LEVELS.length)];
    const ts = Date.now();

    const msg = {
        ts: new Date(ts).toISOString(),
        epochMs: ts,
        level,
        levelNum: levelToNumber(level),
        message: `Demo log from Modbus_BEMP.log`,
    };

    broker.publish({
        topic: `log/Modbus_BEMP.log`,
        payload: JSON.stringify(msg),
        qos: 0,
        retain: false,
    });
}
