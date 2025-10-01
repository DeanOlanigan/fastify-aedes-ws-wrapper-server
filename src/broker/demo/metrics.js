function getRandomLoad() {
    return Math.round(5 + Math.random() * 30);
}

export function metrics(broker) {
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
}
