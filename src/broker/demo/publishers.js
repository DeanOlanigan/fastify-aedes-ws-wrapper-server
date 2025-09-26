let timers = [];

export function startDemoPublishers(broker) {
    stopDemoPublishers();

    // metrics
    timers.push(
        setInterval(() => {
            broker.publish({
                topic: "srv/metrics/time",
                payload: JSON.stringify({ iso: new Date().toISOString() }),
                qos: 1,
                retain: true,
            });
            broker.publish({
                topic: "srv/metrics/cpu",
                payload: JSON.stringify({
                    pct: Math.round(Math.random() * 100),
                }),
                qos: 1,
                retain: true,
            });
            broker.publish({
                topic: "srv/metrics/ram",
                payload: JSON.stringify({
                    mb: 400 + Math.round(Math.random() * 1000),
                }),
                qos: 1,
                retain: true,
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
