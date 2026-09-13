// Mock-сервер: и правильное поведение, и намеренные дефекты.
//
// Дефекты закреплены тестами специально. Это выглядит непривычно — тесты
// требуют, чтобы сервер вёл себя неправильно, — но здесь неправильное
// поведение и есть содержание тренажёра: если B6 однажды «починится» при
// правке соседнего кода, задание перестанет решаться, а заметить это иначе
// будет нечем. Каждый такой тест назван по идентификатору дефекта.

import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/mock-api/server.js';
import { resetState } from '../src/mock-api/state.js';

function request(method, path, body = null, query = {}) {
  return handle({ method, path, query, headers: {}, body });
}

test('роутер: неизвестный путь даёт 404 с телом об ошибке', () => {
  resetState();
  const response = request('GET', '/orders');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'Not found' });
});

test('роутер: ответ всегда содержит заголовки и время', () => {
  resetState();
  const response = request('GET', '/users');

  assert.equal(response.headers['Content-Type'], 'application/json');
  assert.ok(response.time > 0, 'время нужно UI для имитации задержки');
});

test('сброс возвращает данные к исходным и не портит эталон', () => {
  resetState();
  const before = request('GET', '/users').body.items.length;

  request('DELETE', '/users/1');
  request('POST', '/users', { email: 'tmp@example.io', name: 'Временный' });
  resetState();

  const after = request('GET', '/users').body.items;
  assert.equal(after.length, before);
  // Второй сброс обязан дать тот же результат: если бы обработчики мутировали
  // SEED_USERS, разница вылезла бы именно здесь.
  resetState();
  assert.deepEqual(request('GET', '/users').body.items, after);
});

test('корректное поведение, которое ломать нельзя', () => {
  resetState();

  assert.equal(request('GET', '/users', null, { limit: '101' }).status, 400, 'верхняя граница limit');
  assert.equal(request('POST', '/users', { name: 'Без почты' }).status, 400, 'нет обязательного поля');
  assert.equal(
    request('POST', '/users', { email: 'anna@example.com', name: 'Дубль' }).status,
    409,
    'дубликат email',
  );
  assert.equal(request('PUT', '/users/99999', { name: 'Нет такого' }).status, 404);
  assert.equal(request('DELETE', '/users/99999').status, 404);
});

test('B1: POST отвечает 200 вместо 201', () => {
  resetState();
  const response = request('POST', '/users', { email: 'b1@example.io', name: 'B1' });

  assert.equal(response.status, 200);
});

test('B2: email не валидируется', () => {
  resetState();
  const response = request('POST', '/users', { email: 'abc', name: 'B2' });

  assert.notEqual(response.status, 400);
  assert.equal(response.body.email, 'abc');
});

test('B3: в ответе есть лишнее поле passwordHash', () => {
  resetState();
  const response = request('POST', '/users', { email: 'b3@example.io', name: 'B3' });

  assert.ok(Object.hasOwn(response.body, 'passwordHash'));
});

test('B4: total не связан с реальным количеством', () => {
  resetState();
  const before = request('GET', '/users').body;
  request('DELETE', '/users/2');
  const after = request('GET', '/users').body;

  assert.equal(before.total, after.total, 'total не меняется');
  assert.notEqual(after.total, after.items.length);
});

test('B5: limit=0 отдаёт список вместо 400', () => {
  resetState();
  const response = request('GET', '/users', null, { limit: '0' });

  assert.equal(response.status, 200);
  assert.ok(response.body.items.length > 0);
});

test('B6: PUT не сохраняет name, но отвечает 200', () => {
  resetState();
  const before = request('GET', '/users/1').body.name;

  const updated = request('PUT', '/users/1', { name: 'Совсем другое имя' });
  const after = request('GET', '/users/1').body.name;

  assert.equal(updated.status, 200);
  assert.equal(after, before, 'имя не должно сохраниться — в этом и дефект');
});

test('B7: DELETE отвечает 200 с телом вместо 204 без тела', () => {
  resetState();
  const response = request('DELETE', '/users/3');

  assert.equal(response.status, 200);
  assert.notEqual(response.body, null);
});

test('B8: несуществующий id даёт 200 и тело null', () => {
  resetState();
  const response = request('GET', '/users/99999');

  assert.equal(response.status, 200);
  assert.equal(response.body, null);
});

test('B9: createdAt не по ISO 8601 — без T и без таймзоны', () => {
  resetState();
  const createdAt = request('GET', '/users/1').body.createdAt;

  assert.ok(!createdAt.includes('T'), 'разделителя T быть не должно');
  assert.ok(!createdAt.endsWith('Z'), 'таймзоны быть не должно');
});

test('B10: в элементах списка нет поля role', () => {
  resetState();
  const item = request('GET', '/users').body.items[0];
  const single = request('GET', '/users/1').body;

  assert.ok(!Object.hasOwn(item, 'role'), 'в списке роли нет');
  assert.ok(Object.hasOwn(single, 'role'), 'а в одиночном ответе есть — на этом контрасте дефект и виден');
});
