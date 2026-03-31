import { v7 as uuidv7 } from "uuid";
import { overrideValue } from "../broker/demo/monitoring.js";

function buildAckJournalMessage({ targetEvent, actor }) {
    const actorName = actor?.name || actor?.login || "Пользователь";

    return `${actorName} квитировал событие ${targetEvent.id}`;
}

export function createCommandServices({ logger, broker }) {
    return {
        nodeCommands: {
            async writeValue({ nodeId, value }) {
                overrideValue(nodeId, value);
            },
        },

        journalCommands: {
            async ackEvent({ commandId, requestedBy, requestedAt, payload }) {
                const targetEvent = {
                    id: payload.eventId,
                };

                /*

                    Тут будет:
                    1) проверка event в journal store/db
                        - существует ли eventId
                        - совпадает ли payload.event с найденым
                        - был ли уже сделан ack
                        - нужно ли публиковать event.acknowledged или event.ack_ignored|event.ack_error
                        - обновления в journal store/db
                    2) audit log

                */

                logger?.info(
                    {
                        commandId,
                        eventId: targetEvent.id,
                        requestedBy,
                        requestedAt,
                    },
                    "journal ack stub executed",
                );

                const journalEvent = {
                    schemaVersion: 1,
                    id: uuidv7(),
                    ts: Date.now(),
                    severity: "info",
                    category: "event",
                    event: "event.acknowledged",
                    actor: requestedBy
                        ? {
                              type: "user",
                              id: requestedBy.userId,
                              login: requestedBy.login,
                              name: requestedBy.name,
                          }
                        : {
                              type: "user",
                          },
                    ack: null,
                    payload: {
                        targetEvent,
                    },
                    message: buildAckJournalMessage({
                        targetEvent,
                        actor: requestedBy,
                    }),
                };

                await new Promise((resolve, reject) => {
                    broker.publish(
                        {
                            topic: "journal",
                            payload: JSON.stringify(journalEvent),
                            qos: 0,
                            retain: false,
                        },
                        (err) => (err ? reject(err) : resolve()),
                    );
                });
            },

            async ackEventRange({ commandId, requestedBy, requestedAt, payload }) {
                /*

                    Тут будет:
                    1) проверка event в journal store/db
                        - существует ли eventId
                        - совпадает ли payload.event с найденым
                        - был ли уже сделан ack
                        - нужно ли публиковать event.acknowledged или event.ack_ignored|event.ack_error
                        - обновления в journal store/db
                    2) audit log

                */

                logger?.info(
                    {
                        commandId,
                        fromUTC: payload.fromUTC,
                        toUTC: payload.toUTC,
                        requestedBy,
                        requestedAt,
                    },
                    "journal ack stub executed",
                );

                const journalEvent = {
                    schemaVersion: 1,
                    id: uuidv7(),
                    ts: Date.now(),
                    severity: "info",
                    category: "event",
                    event: "event.acknowledged.range",
                    actor: requestedBy
                        ? {
                              type: "user",
                              id: requestedBy.userId,
                              login: requestedBy.login,
                              name: requestedBy.name,
                          }
                        : {
                              type: "user",
                          },
                    ack: null,
                    payload: {
                        fromUTC: payload.fromUTC,
                        toUTC: payload.toUTC,
                    },
                    message: `События от ${payload.fromUTC} до ${payload.toUTC} квитированы`,
                };

                await new Promise((resolve, reject) => {
                    broker.publish(
                        {
                            topic: "journal",
                            payload: JSON.stringify(journalEvent),
                            qos: 0,
                            retain: false,
                        },
                        (err) => (err ? reject(err) : resolve()),
                    );
                });
            },
        },
    };
}
