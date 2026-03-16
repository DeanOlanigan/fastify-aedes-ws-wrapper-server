export function createCommandBus({ broker, topics }) {
    return {
        async publishJournalAck(command) {
            return new Promise((resolve, reject) => {
                broker.publish(
                    {
                        topic: topics.COMMAND_JOURNAL_ACK,
                        payload: JSON.stringify(command),
                        qos: 1,
                        retain: false,
                    },
                    (err) => (err ? reject(err) : resolve()),
                );
            });
        },
        async publishJournalAckRange(command) {
            return new Promise((resolve, reject) => {
                broker.publish(
                    {
                        topic: topics.COMMAND_JOURNAL_ACK_RANGE,
                        payload: JSON.stringify(command),
                        qos: 1,
                        retain: false,
                    },
                    (err) => (err ? reject(err) : resolve()),
                );
            });
        },
        async publishTelecontrol(varId, payload) {
            return new Promise((resolve, reject) => {
                broker.publish(
                    {
                        topic: topics.commandNodeWrite(varId),
                        payload: JSON.stringify(payload),
                        qos: 1,
                        retain: false,
                    },
                    (err) => (err ? reject(err) : resolve()),
                );
            });
        },
    };
}
