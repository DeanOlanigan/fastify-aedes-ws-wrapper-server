let timers = [];
function getRandomLoad() {
    // eslint-disable-next-line
    return Math.round(5 + Math.random() * 30);
}

export function startDemoPublishers(broker) {
    stopDemoPublishers();

    // metrics
    timers.push(
        setInterval(() => {
            broker.publish({
                topic: "stats/time",
                payload: JSON.stringify(Date.now()),
                qos: 0,
                retain: false,
            });
            broker.publish({
                topic: "stats/cpu",
                payload: JSON.stringify(getRandomLoad()),
                qos: 0,
                retain: false,
            });
            broker.publish({
                topic: "stats/ram",
                payload: JSON.stringify(getRandomLoad()),
                qos: 0,
                retain: false,
            });
        }, 1000)
    );

    // device snapshot + delta
    timers.push(
        setInterval(() => {
            broker.publish({
                topic: "vars/deviceA/delta",
                payload: JSON.stringify({ temp: 20 + Math.random() * 5 }),
                qos: 1,
                retain: false,
            });
        }, 3000)
    );

    // logs
    timers.push(
        setInterval(() => {
            const levels = ["info", "warn", "error"];
            const lvl = levels[Math.floor(Math.random() * levels.length)];
            broker.publish({
                topic: `logs/${lvl}`,
                payload: JSON.stringify({
                    ts: Date.now(),
                    msg: `Example ${lvl}`,
                }),
                qos: 1,
            });
        }, 5000)
    );
}

export function stopDemoPublishers() {
    for (const t of timers) clearInterval(t);
    timers = [];
}
