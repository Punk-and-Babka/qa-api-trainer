// Проверка ответа по JSON Schema. Проверяется на живом mock-сервере: схемы
// написаны по спецификации, поэтому часть вшитых дефектов они обязаны ловить,
// и если однажды перестанут — это регрессия либо в схемах, либо в сервере.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVALID,
  NO_ENDPOINT,
  NO_SCHEMA,
  VALID,
  checkResponse,
  findRoute,
  validateAgainst,
} from '../src/schema-check.js';
import { handle } from '../src/mock-api/server.js';
import { resetState } from '../src/mock-api/state.js';

function request(method, path, body = null, query = {}) {
  return handle({ method, path, query, headers: {}, body });
}

test('путь с параметром сопоставляется с шаблоном спецификации', () => {
  assert.equal(findRoute('GET', '/users/1'), 'GET /users/:id');
  assert.equal(findRoute('GET', '/users'), 'GET /users');
  assert.equal(findRoute('DELETE', '/users/42'), 'DELETE /users/:id');
  assert.equal(findRoute('GET', '/orders'), null);
  // Метод — часть совпадения: у одного пути разные методы это разные эндпоинты.
  assert.equal(findRoute('PATCH', '/users/1'), null);
});

test('неизвестный эндпоинт: сверять не с чем', () => {
  resetState();
  const response = request('GET', '/orders');
  const result = checkResponse('GET', '/orders', response);

  assert.equal(result.verdict, NO_ENDPOINT);
  assert.equal(result.route, null);
});

test('статус, не описанный спецификацией, даёт отдельный вердикт', () => {
  resetState();
  // B1: POST отвечает 200 вместо 201, поэтому схемы для ответа нет.
  const response = request('POST', '/users', { email: 'new@example.io', name: 'Новый' });
  const result = checkResponse('POST', '/users', response);

  assert.equal(result.verdict, NO_SCHEMA);
  assert.equal(result.route, 'POST /users');
  assert.deepEqual(result.expected, [201, 400, 409]);
  assert.deepEqual(result.errors, [], 'тело в этом случае не проверяется');
});

test('корректный ответ проходит схему', () => {
  resetState();
  const response = request('GET', '/users', null, { limit: '0abc' });
  const result = checkResponse('GET', '/users', response);

  // limit не число — сервер отвечает 400 с телом об ошибке, и это по спеке.
  assert.equal(response.status, 400);
  assert.equal(result.verdict, VALID);
});

test('схема ловит отсутствие поля role в элементах списка', () => {
  resetState();
  const response = request('GET', '/users');
  const result = checkResponse('GET', '/users', response);

  assert.equal(result.verdict, INVALID);
  assert.ok(
    result.errors.some((error) => error.path.startsWith('/items/0') && /role/.test(error.message)),
    'B10 должен ловиться схемой',
  );
});

test('схема ловит дату не по ISO 8601', () => {
  resetState();
  const response = request('GET', '/users/1');
  const result = checkResponse('GET', '/users/1', response);

  assert.equal(result.verdict, INVALID);
  assert.ok(
    result.errors.some((error) => error.path === '/createdAt' && /date-time/.test(error.message)),
    'B9 должен ловиться благодаря ajv-formats',
  );
});

test('схема ловит тело null вместо объекта', () => {
  resetState();
  // B8: несуществующий id даёт 200 и null вместо 404.
  const response = request('GET', '/users/99999');
  const result = checkResponse('GET', '/users/99999', response);

  assert.equal(result.verdict, INVALID);
  assert.ok(result.errors.some((error) => error.path === '/'));
});

test('лишнее поле в ответе не проходит additionalProperties', () => {
  // B3 через сам тренажёр схемой не ловится: у POST неописанный статус.
  // Но правило обязано работать — проверяем его напрямую.
  const { ok, errors } = validateAgainst(
    {
      type: 'object',
      required: ['id'],
      additionalProperties: false,
      properties: { id: { type: 'integer' } },
    },
    { id: 1, passwordHash: 'x' },
  );

  assert.equal(ok, false);
  assert.ok(errors.some((error) => /passwordHash/.test(error.message)), 'имя лишнего поля обязано быть в сообщении');
});

test('validateAgainst не спотыкается о повторную компиляцию схемы с $id', () => {
  // Отдельный экземпляр Ajv на вызов нужен именно для этого: общий бросил бы
  // «schema with key or id already exists» на втором вызове.
  const schema = { $id: 'https://example.io/user.json', type: 'object' };

  assert.equal(validateAgainst(schema, {}).ok, true);
  assert.equal(validateAgainst(schema, {}).ok, true);
});

test('ошибка в самой схеме заметна сразу, а не молча пропускается', () => {
  assert.throws(() => validateAgainst({ type: 'нетакоготипа' }, {}), Error);
});
