import fs from "fs";
import { parseXml } from "./parseXml.js";
import { metrics } from "./metrics.js";
import { tick } from "./monitoring.js";
import { log } from "./log.js";

let timers = [];

export function startDemoPublishers(broker) {
    stopDemoPublishers();

    const xmlString = fs.readFileSync("src/data/config.xml").toString();
    const uuids = parseXml(xmlString);
    const uniq = Array.from(new Set(uuids)).filter(Boolean);

    // metrics
    timers.push(
        setInterval(() => {
            metrics(broker);
        }, 1000)
    );

    // log
    timers.push(
        setInterval(() => {
            log(broker);
        }, 2000)
    );

    // monitoring
    /* timers.push(
        setInterval(() => {
            tick(uniq, broker);
        }, 3000)
    ); */
}

export function stopDemoPublishers() {
    for (const t of timers) clearInterval(t);
    timers = [];
}
