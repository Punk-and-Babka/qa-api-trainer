// JSON Schema ответов Users API — машиночитаемая половина спецификации.
//
// Схемы описывают то, что обязан вернуть сервер по контракту, и намеренно
// ничего не знают о фактическом поведении обработчиков. Поэтому часть вшитых
// багов проверка ловит сама: лишнее поле passwordHash (B3) не проходит
// additionalProperties, дата без "T" (B9) — format, отсутствие role в списке
// (B10) — required.
//
// Переиспользование сделано обычными ссылками на объекты JavaScript, а не
// через $ref и $defs: результат тот же, а читать проще. $ref понадобится, если
// схемы когда-нибудь начнут отдаваться наружу как отдельные документы.

const user = {
  type: 'object',
  required: ['id', 'email', 'name', 'role', 'createdAt'],
  // false, а не умолчание true: спецификация перечисляет поля модели
  // исчерпывающе, и лишнее поле в ответе — нарушение контракта, а не мелочь.
  additionalProperties: false,
  properties: {
    id: { type: 'integer', minimum: 1 },
    email: { type: 'string', format: 'email' },
    name: { type: 'string', minLength: 1 },
    role: { type: 'string', enum: ['user', 'admin', 'moderator'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const userList = {
  type: 'object',
  required: ['items', 'total', 'page', 'limit'],
  additionalProperties: false,
  properties: {
    items: { type: 'array', items: user },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
  },
};

const errorBody = {
  type: 'object',
  required: ['error'],
  additionalProperties: false,
  properties: {
    error: { type: 'string', minLength: 1 },
  },
};

// 204 No Content: тела нет. Пустое тело приходит в UI как null — контракт
// mock-сервера подставляет null вместо undefined, чтобы поле всегда было.
const noBody = { type: 'null' };

// Ключ — "метод путь" ровно в том виде, в каком эндпоинт записан в контракте,
// с шаблоном ":id". Внутри — схема на каждый статус, предусмотренный спекой.
// Статуса, которого здесь нет, спецификация не обещает вовсе: это находка сама
// по себе, и проверка сообщает об этом отдельно, а не молча пропускает.
export const responseSchemas = {
  'GET /users': { 200: userList, 400: errorBody },
  'GET /users/:id': { 200: user, 404: errorBody },
  'POST /users': { 201: user, 400: errorBody, 409: errorBody },
  'PUT /users/:id': { 200: user, 404: errorBody },
  'DELETE /users/:id': { 204: noBody, 404: errorBody },
};
