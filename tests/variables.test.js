// Переменные окружения: подстановка и слияние правок, сделанных скриптом.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyVariables,
  mergeVariables,
  nextId,
  toObject,
} from '../src/variables.js';

const list = [
  { id: 1, name: 'userId', value: '5' },
  { id: 2, name: '', value: '' },
  { id: 3, name: 'host', value: 'example.io' },
];

test('toObject пропускает незаполненные строки таблицы', () => {
  // Пустая строка появляется сразу после нажатия «Добавить переменную»
  // и не должна создавать переменную с пустым именем.
  assert.deepEqual(toObject(list), { userId: '5', host: 'example.io' });
});

test('toObject обрезает пробелы вокруг имени', () => {
  assert.deepEqual(toObject([{ id: 1, name: '  token  ', value: 'abc' }]), { token: 'abc' });
});

test('подстановка заменяет известные имена', () => {
  const result = applyVariables('/users/{{userId}}?ref={{host}}', toObject(list));

  assert.equal(result.text, '/users/5?ref=example.io');
  assert.deepEqual(result.unknown, []);
});

test('пробелы внутри скобок допускаются', () => {
  assert.equal(applyVariables('/users/{{ userId }}', toObject(list)).text, '/users/5');
});

test('неизвестное имя остаётся в тексте и попадает в список', () => {
  const result = applyVariables('/users/{{token}}/{{token}}', toObject(list));

  assert.equal(result.text, '/users/{{token}}/{{token}}');
  // Повтор одного имени перечисляется один раз: список идёт в предупреждение.
  assert.deepEqual(result.unknown, ['token']);
});

test('подстановка в тело делает JSON валидным', () => {
  // Ради этого подстановка и выполняется до разбора: до замены такой текст
  // невалиден как JSON.
  const result = applyVariables('{"id": {{userId}}}', toObject(list));

  assert.equal(result.text, '{"id": 5}');
  assert.deepEqual(JSON.parse(result.text), { id: 5 });
});

test('текст без переменных не меняется', () => {
  const result = applyVariables('/users?limit=10', toObject(list));

  assert.equal(result.text, '/users?limit=10');
  assert.deepEqual(result.unknown, []);
});

test('одиночные скобки за подстановку не считаются', () => {
  const result = applyVariables('{ "a": 1 }', toObject(list));

  assert.equal(result.text, '{ "a": 1 }');
});

test('nextId продолжает нумерацию, а не начинает заново', () => {
  assert.equal(nextId(list), 4);
  assert.equal(nextId([]), 1);
  assert.equal(nextId([{ id: 7 }, { id: 2 }]), 8);
});

test('слияние правит существующие на месте и дописывает новые в конец', () => {
  const merged = mergeVariables(list, { userId: '9', host: 'example.io', token: 'abc' });

  assert.deepEqual(merged, [
    { id: 1, name: 'userId', value: '9' },
    { id: 2, name: '', value: '' },
    { id: 3, name: 'host', value: 'example.io' },
    { id: 4, name: 'token', value: 'abc' },
  ]);
});

test('слияние убирает то, что скрипт снял через unset', () => {
  const merged = mergeVariables(list, { userId: '5' });

  assert.deepEqual(merged, [
    { id: 1, name: 'userId', value: '5' },
    // Незаполненный черновик — ввод пользователя, скрипт про него не знает.
    { id: 2, name: '', value: '' },
  ]);
});

test('слияние не трогает исходный список', () => {
  const before = JSON.stringify(list);
  mergeVariables(list, { userId: '42', added: '1' });

  assert.equal(JSON.stringify(list), before);
});

test('id новых переменных не конфликтуют с существующими', () => {
  const merged = mergeVariables(list, { userId: '5', host: 'example.io', a: '1', b: '2' });
  const ids = merged.map((item) => item.id);

  assert.equal(new Set(ids).size, ids.length, 'id должны быть уникальны — это React key');
});
