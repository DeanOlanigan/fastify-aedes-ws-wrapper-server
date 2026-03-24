# Auth API — памятка по контракту

## Назначение домена

Auth API отвечает за:

* вход пользователя в систему,
* завершение сессии,
* получение актуального состояния сессии,
* повторное подтверждение личности для чувствительных действий.

Аутентификация основана на серверной сессии и cookie.

---

## Общая модель

После успешного логина сервер создает сессию и записывает в нее `session.user`.

Сессия считается валидной, если:

* в сессии есть `user`,
* пользователь существует,
* пользователь не отключен,
* версия авторизационных данных пользователя не изменилась.

Если пользователь удален, отключен или его `authzVersion` изменилась, сессия уничтожается.

---

## SessionUser

Структура session user:

```json
{
  "userId": "string",
  "login": "string",
  "surname": "string",
  "name": "string",
  "grandname": "string",
  "position": "string",
  "roles": ["string"],
  "roleNames": ["string"],
  "rights": ["string"],
  "authzVersion": 1,
  "mustChangePassword": false,
  "createdAt": 1712345678901,
  "lastActivityAt": 1712345678901,
  "stepUpUntil": 1712345678901
}
```

### Поля

* `userId` — идентификатор пользователя
* `login` — логин
* `surname`, `name`, `grandname`, `position` — пользовательские данные
* `roles` — список ID ролей
* `roleNames` — список имен ролей
* `rights` — итоговый набор прав пользователя
* `authzVersion` — версия авторизационных данных
* `mustChangePassword` — признак обязательной смены пароля
* `createdAt` — время создания session user
* `lastActivityAt` — время последнего обновления session user
* `stepUpUntil` — время, до которого действует step-up подтверждение

---

## Endpoint: `POST /auth/login`

### Назначение

Аутентифицирует пользователя по логину и паролю и создает новую сессию.

### Request body

```json
{
  "login": "string",
  "password": "string"
}
```

### Success response

`200 OK`

```json
{
  "ok": true,
  "user": {
    "userId": "string",
    "login": "string",
    "surname": "string",
    "name": "string",
    "grandname": "string",
    "position": "string",
    "roles": ["string"],
    "roleNames": ["string"],
    "rights": ["string"],
    "authzVersion": 1,
    "mustChangePassword": false,
    "createdAt": 1712345678901,
    "lastActivityAt": 1712345678901,
    "stepUpUntil": 0
  }
}
```

### Ошибки

`400 Bad Request`

```json
{
  "error": "LOGIN_REQUIRED"
}
```

`401 Unauthorized`

```json
{
  "error": "INVALID_CREDENTIALS"
}
```

`403 Forbidden`

```json
{
  "error": "USER_DISABLED"
}
```

### Поведение

* сервер проверяет логин и пароль,
* сервер регенерирует сессию,
* сервер формирует `session.user`,
* при успешном логине `stepUpUntil` обычно равен `0`.

---

## Endpoint: `POST /auth/logout`

### Назначение

Завершает текущую сессию пользователя.

### Request body

Не требуется.

### Success response

`200 OK`

```json
{
  "ok": true
}
```

### Поведение

* сессия уничтожается,
* cookie `sid` очищается.

---

## Endpoint: `GET /auth/session`

### Назначение

Возвращает текущее состояние сессии.

### Ответ для гостя

`200 OK`

```json
{
  "authenticated": false
}
```

### Ответ для авторизованного пользователя

`200 OK`

```json
{
  "authenticated": true,
  "user": {
    "userId": "string",
    "login": "string",
    "surname": "string",
    "name": "string",
    "grandname": "string",
    "position": "string",
    "roles": ["string"],
    "roleNames": ["string"],
    "rights": ["string"],
    "authzVersion": 1,
    "mustChangePassword": false,
    "createdAt": 1712345678901,
    "lastActivityAt": 1712345678901,
    "stepUpUntil": 1712345678901
  }
}
```

### Правила валидации сессии

Сессия считается невалидной, если:

* `request.session.user` отсутствует,
* пользователь отсутствует в `authStore`,
* пользователь отключен,
* `currentUser.authzVersion !== sessionUser.authzVersion`.

### Поведение при невалидной сессии

* сервер уничтожает сессию,
* сервер возвращает:

```json
{
  "authenticated": false
}
```

### Важная семантика

`GET /auth/session` не должен возвращать `401` для гостя.
Отсутствие авторизации — это нормальное состояние, не ошибка.

---

## Endpoint: `POST /auth/reauth`

### Назначение

Повторно подтверждает личность уже авторизованного пользователя по паролю и выдает временное step-up окно.

### Смысл

Это не повторный логин и не создание новой сессии.
Это кратковременное повышение доверия к уже существующей сессии для чувствительных операций.

### Request body

```json
{
  "password": "string"
}
```

### Success response

`200 OK`

```json
{
  "ok": true,
  "stepUpUntil": 1712345678901
}
```

### Ошибки

`401 Unauthorized`

```json
{
  "error": "UNAUTHORIZED"
}
```

`400 Bad Request`

```json
{
  "error": "PASSWORD_REQUIRED"
}
```

`401 Unauthorized`

```json
{
  "error": "INVALID_CREDENTIALS"
}
```

### Поведение

* endpoint доступен только для уже авторизованного пользователя,
* сервер проверяет пароль текущего пользователя,
* при успехе выставляет `request.session.user.stepUpUntil = Date.now() + 5 minutes`,
* окно действует 5 минут.

### Когда использовать

Подходит для операций повышенной чувствительности, например:

* смена пароля,
* удаление пользователя,
* изменение ролей и прав,
* применение критичной конфигурации,
* остановка/рестарт сервиса.

---

## Формат ошибок

Auth API использует машинные коды ошибок:

```json
{
  "error": "ERROR_CODE"
}
```

Подтвержденные значения:

* `LOGIN_REQUIRED`
* `INVALID_CREDENTIALS`
* `USER_DISABLED`
* `UNAUTHORIZED`
* `PASSWORD_REQUIRED`

Рекомендуется на фронте маппить эти коды в пользовательские сообщения отдельно от transport-слоя.

---

## Правила инвалидирования сессии

Сессия должна считаться недействительной, если:

* пользователь удален,
* пользователь заблокирован,
* изменилась `authzVersion`.

### Зачем нужен `authzVersion`

Это механизм принудительного сброса старых сессий при изменении ролей, прав или других authz-данных пользователя.

Если `authzVersion` в сессии не совпадает с актуальным значением пользователя:

* сессия уничтожается,
* пользователь должен войти заново.

---

## Step-up логика

### Поле `stepUpUntil`

* `0` или время в прошлом — step-up неактивен
* время в будущем — step-up активен до указанного момента

### Проверка на фронте

Простое правило:

```js
const hasFreshStepUp = user?.stepUpUntil > Date.now();
```

---

## Рекомендации для фронта

### `auth.api.js`

Файл должен содержать только HTTP-вызовы:

* `getSession`
* `login`
* `logout`
* `reauth`

### Не стоит класть в transport layer

* локализацию ошибок,
* работу со стором,
* редиректы,
* бизнес-логику UI.

### Полезно иметь отдельно

* `auth.mappers.js`
* `auth.queries.js`
* `auth.constants.js`
