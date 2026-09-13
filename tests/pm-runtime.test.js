// Исполнение тестового скрипта: объект pm, сбор результатов и обработка
// падений. Ключевое здесь — отличие упавшего теста от упавшего скрипта: это
// разные вещи, и путать их нельзя ни в отчёте, ни в коде.

import test from 'node:test';
import assert from 'node:assert/strict';
import { runTests } from '../src/pm-runtime.js';

const response = {
  status: 201,
  headers: { 'Content-Type': 'application/json' },
  body: { id: 5, email: 'a@b.io', createdAt: '2026-01-14 10:00:00' },
  time: 42,
};

test('прошедший и упавший тесты попадают в отчёт по отдельности', () => {
  const run = runTests(
    `pm.test('первый', function () { pm.expect(1).to.equal(1); });
     pm.test('второй', function () { pm.expect(1).to.equal(2); });
     pm.test('третий', function () { pm.expect(2).to.equal(2); });`,
    response,
  );

  assert.equal(run.error, null);
  assert.equal(run.tests.length, 3);
  assert.deepEqual(
    run.tests.map((item) => item.passed),
    [true, false, true],
    'упавший тест не должен прерывать остальные',
  );
  assert.match(run.tests[1].message, /1/);
});

test('синтаксическая ошибка — это падение скрипта, а не ноль тестов', () => {
  const run = runTests('pm.test(', response);

  assert.match(run.error, /SyntaxError/);
  assert.deepEqual(run.tests, []);
});

test('исключение вне pm.test роняет скрипт, но сохраняет успевшее', () => {
  const run = runTests(
    `pm.test('успел', function () { pm.expect(1).to.equal(1); });
     undefinedThing.boom();`,
    response,
  );

  assert.match(run.error, /ReferenceError/);
  assert.equal(run.tests.length, 1);
  assert.equal(run.tests[0].passed, true);
});

test('pm.response отдаёт статус, тело, время и заголовки', () => {
  const run = runTests(
    `pm.test('всё на месте', function () {
       pm.expect(pm.response.code).to.equal(201);
       pm.expect(pm.response.responseTime).to.equal(42);
       pm.expect(pm.response.json()).to.have.property('id', 5);
       pm.expect(pm.response.text()).to.include('a@b.io');
       pm.expect(pm.response.headers.get('content-type')).to.equal('application/json');
     });`,
    response,
  );

  assert.equal(run.tests[0].passed, true, run.tests[0].message ?? run.error);
});

test('pm.response.to.have.status и header бросают при несовпадении', () => {
  const run = runTests(
    `pm.test('статус верный', function () { pm.response.to.have.status(201); });
     pm.test('статус неверный', function () { pm.response.to.have.status(200); });
     pm.test('заголовок есть', function () { pm.response.to.have.header('Content-Type'); });
     pm.test('заголовка нет', function () { pm.response.to.have.header('X-Request-Id'); });`,
    response,
  );

  assert.deepEqual(
    run.tests.map((item) => item.passed),
    [true, false, true, false],
  );
  assert.match(run.tests[1].message, /201/);
});

test('jsonSchema проверяет тело и называет расхождение', () => {
  const run = runTests(
    `pm.test('дата по ISO', function () {
       pm.response.to.have.jsonSchema({
         type: 'object',
         properties: { createdAt: { type: 'string', format: 'date-time' } },
       });
     });`,
    response,
  );

  assert.equal(run.tests[0].passed, false, 'дата в ответе намеренно не по ISO 8601');
  assert.match(run.tests[0].message, /createdAt/);
});

test('пустое тело отдаётся как null, а не роняет json()', () => {
  const run = runTests(
    `pm.test('тела нет', function () { pm.expect(pm.response.json()).to.be.null; });`,
    { status: 204, headers: {}, body: null, time: 5 },
  );

  assert.equal(run.tests[0].passed, true);
});

test('pm.environment читает, пишет, удаляет и проверяет наличие', () => {
  const run = runTests(
    `pm.test('работа с переменными', function () {
       pm.expect(pm.environment.get('host')).to.equal('example.io');
       pm.environment.set('userId', pm.response.json().id);
       pm.expect(pm.environment.has('userId')).to.be.true;
       pm.environment.unset('host');
       pm.expect(pm.environment.has('host')).to.be.false;
     });`,
    response,
    { host: 'example.io' },
  );

  assert.equal(run.tests[0].passed, true, run.tests[0].message);
  assert.deepEqual(run.variables, { userId: '5' });
});

test('значения переменных приводятся к строке', () => {
  // В таблице лежат строки, и подстановка {{id}} даёт строку — get не должен
  // возвращать число там, где в запрос уедет текст.
  const run = runTests("pm.environment.set('id', 5);", response, {});

  assert.equal(run.variables.id, '5');
  assert.equal(typeof run.variables.id, 'string');
});

test('скрипт получает копию переменных, а не исходный объект', () => {
  const source = { host: 'example.io' };
  runTests("pm.environment.set('host', 'изменено');", response, source);

  assert.deepEqual(source, { host: 'example.io' });
});

test('изменения переменных сохраняются даже при падении скрипта', () => {
  const run = runTests("pm.environment.set('a', '1'); boom();", response, {});

  assert.match(run.error, /ReferenceError/);
  assert.deepEqual(run.variables, { a: '1' });
});

test('скрипт исполняется в строгом режиме', () => {
  // Без 'use strict' присваивание необъявленной переменной молча создало бы
  // глобальную, и опечатка не нашлась бы никогда.
  const run = runTests('забытыйVar = 1;', response);

  assert.match(run.error, /ReferenceError/);
});

test('скрипт без единого pm.test отрабатывает без ошибки', () => {
  const run = runTests('const x = 1;', response);

  assert.equal(run.error, null);
  assert.deepEqual(run.tests, []);
});
