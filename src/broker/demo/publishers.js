import fs from "node:fs";
import path from "node:path";
import { graph } from "./graph.js";
import { journal } from "./journal.js";
import { log } from "./log.js";
import { metrics } from "./metrics.js";
import { tick } from "./monitoring.js";
import { parseXml } from "./parseXml.js";

const DATA_DIR = path.resolve("data");
const CONFIG_PATH = path.join(DATA_DIR, "configuration.xml");

let timers = [];

export function startDemoPublishers(broker) {
    stopDemoPublishers();

    const xmlString = fs.readFileSync(CONFIG_PATH).toString();
    const uuids = parseXml(xmlString);
    const uniq = Array.from(new Set(uuids)).filter(Boolean);

    // metrics
    timers.push(
        setInterval(() => {
            metrics(broker);
        }, 1000),
    );

    // log
    /* timers.push(
        setInterval(() => {
            log(broker);
        }, 1000)
    ); */

    // journal
    timers.push(
        setInterval(() => {
            journal(broker);
        }, 1000),
    );

    // graph
    /* timers.push(
        setInterval(() => {
            graph(broker);
        }, 1000)
    ); */

    // monitoring
    /* timers.push(
        setInterval(() => {
            tick(uniq, broker);
        }, 500)
    ); */
}

export function stopDemoPublishers() {
    for (const t of timers) clearInterval(t);
    timers = [];
}
