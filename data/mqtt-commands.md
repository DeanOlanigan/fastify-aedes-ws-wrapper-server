# EVENT.ACK
```js
    const command = {
        schemaVersion: 1,
        commandId: uuidv7(),
        type: "event.ack",
        requestedAt: Date.now(),
        requestedBy: user
            ? {
                    userId: user.userId,
                    login: user.login,
                    name: user.name,
                }
            : null,
        payload: {
            eventId,
        },
    };
```
# EVENT.ACK.RANGE
```js
    const command = {
        schemaVersion: 1,
        commandId: uuidv7(),
        type: "event.ack.range",
        requestedAt: Date.now(),
        requestedBy: user
            ? {
                    userId: user.userId,
                    login: user.login,
                    name: user.name,
                }
            : null,
        payload: {
            fromUTC,
            toUTC,
        },
    };
```
# SIGNAL.overwrite
```js
    const command = {
        schemaVersion: 1,
        commandId: uuidv7(),
        type: "signal.overwrite",
        requestedAt: Date.now(),
        requestedBy: user
            ? {
                    userId: user.userId,
                    login: user.login,
                    name: user.name,
                }
            : null,
        payload: {
            signalId,
            value,
            qualityFlags
        },
    };
```
# SIGNAL.WRITE
```js
    const command = {
        schemaVersion: 1,
        commandId: uuidv7(),
        type: "signal.write",
        requestedAt: Date.now(),
        requestedBy: user
            ? {
                    userId: user.userId,
                    login: user.login,
                    name: user.name,
                }
            : null,
        payload: {
            signalId,
            value,
        },
    };
```
# SIGNAL.BIT.TOGGLE
```js
    const command = {
        schemaVersion: 1,
        commandId: uuidv7(),
        type: "signal.bit.toggle",
        requestedAt: Date.now(),
        requestedBy: user
            ? {
                    userId: user.userId,
                    login: user.login,
                    name: user.name,
                }
            : null,
        payload: {
            signalId
        },
    };
```
# SIGNAL.UNBLOCK
```js
    const command = {
        schemaVersion: 1,
        commandId: uuidv7(),
        type: "signal.unblock",
        requestedAt: Date.now(),
        requestedBy: user
            ? {
                    userId: user.userId,
                    login: user.login,
                    name: user.name,
                }
            : null,
        payload: {
            signalId,
        },
    };
```
# EVENT.APPEND
### Возможно лишний, т.к. запись в бд журнала/отображение в интерфейсе будет через общий топик journal
```js
    const command = {
        schemaVersion: 1,
        commandId: uuidv7(),
        type: "event.append",
        requestedAt: Date.now(),
        requestedBy: user
            ? {
                    userId: user.userId,
                    login: user.login,
                    name: user.name,
                }
            : null,
        payload: {
            // Пока что думаю как быть...
        },
    };
```

# Контракт

```
POST /signals/:id/overwrite
POST /signals/:id/write
POST /signals/:id/bit-toggle
POST /signals/:id/unblock

POST /events/:eventId/ack
POST /events/ack

signal.overwrite
signal.write
signal.bit.toggle
signal.unblock

event.ack
event.ack.range

// пока на этапе концептуальной проработки
event.append
```

# Топики

```
command                 // Команды работы с сигналами/квитированием
signals/live/by-id/:id  // Получение данных в реальном времени в интерфейсе
journal                 // Получение событий в реальном времени в интерфейсе/запись в БД
log/:name               // Получение конкретных логов в интерфейсе
stats/cpu               // Получение загрузки cpu в интерфейсе
stats/ram               // Получение загрузки ram в интерфейсе
stats/time              // Получение времени сервера в интерфейсе
```

### command

Топик доменных команд.
Публиковать могут только доверенные инициаторы действий.
Потребляют сервисы, которые выполняют команды.

### journal

Топик канонических событий системы.
Публиковать могут только доверенные backend-сервисы, являющиеся источниками фактов.
Потребляют journal service и live UI.