// Сверка баг-репортов. Здесь проверяется не только «совпало — не совпало»,
// но и приоритет точного совпадения над общим `*`: если бы порядок был
// обратным, общий дефект перехватывал бы репорты по конкретным эндпоинтам, и
// студенту засчитывался бы не тот баг, который он нашёл.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCEPTED,
  DUPLICATE,
  REJECTED,
  checkReport,
  endpointOptions,
  foundBugIds,
} from '../src/bug-check.js';
import { usersContract } from '../src/mock-api/scenarios/users.contract.js';

// Свой маленький каталог: тесты сверки не должны зависеть от того, какие
// именно дефекты сейчас вшиты в сценарий Users.
const catalog = [
  { id: 'X1', endpoint: 'GET /items', types: ['status-code'], title: 'первый' },
  { id: 'X2', endpoint: 'GET /items', types: ['contract', 'security'], title: 'второй' },
  { id: 'X3', endpoint: 'POST /items', types: ['validation'], title: 'третий' },
  { id: 'X9', endpoint: '*', types: ['format'], title: 'общий' },
];

test('точное совпадение по паре «эндпоинт + тип»', () => {
  const result = checkReport({ endpoint: 'GET /items', type: 'status-code' }, catalog, []);

  assert.equal(result.verdict, ACCEPTED);
  assert.equal(result.bugId, 'X1');
  assert.equal(result.nearMiss, false);
});

test('баг засчитывается по любому из своих типов', () => {
  const asContract = checkReport({ endpoint: 'GET /items', type: 'contract' }, catalog, []);
  const asSecurity = checkReport({ endpoint: 'GET /items', type: 'security' }, catalog, []);

  assert.equal(asContract.bugId, 'X2');
  assert.equal(asSecurity.bugId, 'X2');
});

test('общий дефект засчитывается на конкретном эндпоинте', () => {
  // Студент видит формат даты в ответе конкретного запроса и репортит туда —
  // это и должно работать.
  const onEndpoint = checkReport({ endpoint: 'POST /items', type: 'format' }, catalog, []);
  const explicit = checkReport({ endpoint: '*', type: 'format' }, catalog, []);

  assert.equal(onEndpoint.bugId, 'X9');
  assert.equal(explicit.bugId, 'X9');
});

test('точное совпадение важнее общего', () => {
  // Общий баг с типом status-code перехватил бы X1, если бы «*» проверялся
  // первым. Порядок обязан быть обратным.
  const greedy = [...catalog, { id: 'X0', endpoint: '*', types: ['status-code'], title: 'жадный' }];
  const result = checkReport({ endpoint: 'GET /items', type: 'status-code' }, greedy, []);

  assert.equal(result.bugId, 'X1');
});

test('повторный репорт помечается дублем и не засчитывается заново', () => {
  const result = checkReport({ endpoint: 'GET /items', type: 'status-code' }, catalog, ['X1']);

  assert.equal(result.verdict, DUPLICATE);
  assert.equal(result.bugId, 'X1');
});

test('промах по типу на «живом» эндпоинте помечается как близкий', () => {
  const result = checkReport({ endpoint: 'POST /items', type: 'boundary' }, catalog, []);

  assert.equal(result.verdict, REJECTED);
  assert.equal(result.bugId, null);
  assert.equal(result.nearMiss, true);
});

test('на эндпоинте без ненайденных дефектов близкого промаха нет', () => {
  const result = checkReport({ endpoint: 'POST /items', type: 'boundary' }, catalog, ['X3']);

  assert.equal(result.verdict, REJECTED);
  assert.equal(result.nearMiss, false);
});

test('репорт по неизвестному эндпоинту отклоняется без подсказки', () => {
  const result = checkReport({ endpoint: 'DELETE /nothing', type: 'contract' }, catalog, []);

  assert.equal(result.verdict, REJECTED);
  assert.equal(result.nearMiss, false);
});

test('foundBugIds берёт только засчитанные репорты', () => {
  const reports = [
    { verdict: ACCEPTED, bugId: 'X1' },
    { verdict: DUPLICATE, bugId: 'X1' },
    { verdict: REJECTED, bugId: null },
    { verdict: ACCEPTED, bugId: 'X3' },
  ];

  assert.deepEqual(foundBugIds(reports), ['X1', 'X3']);
  assert.deepEqual(foundBugIds([]), []);
});

test('список эндпоинтов формы собирается из контракта и содержит «*»', () => {
  const options = endpointOptions(usersContract);

  assert.ok(options.includes('GET /users'));
  assert.ok(options.includes('GET /users/:id'));
  assert.equal(options.at(-1), '*', 'пункт «*» должен идти последним');
  assert.equal(options.length, usersContract.endpoints.length + 1);
});
