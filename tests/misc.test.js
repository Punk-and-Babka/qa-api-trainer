// Мелкие модули: ширины колонок, числительные, группы статусов.
// По отдельности каждый на десяток строк, отдельные файлы под них были бы
// шумом — но без проверок их оставлять нельзя: ошибка здесь тихая.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COLUMNS,
  MIN_COLUMN_PX,
  resizeColumns,
  sanitizeColumns,
} from '../src/columns.js';
import { plural } from '../src/plural.js';
import { STATUS_TEXT, statusClass } from '../src/status.js';

const WIDTH = 1200;
const sum = (columns) => columns.reduce((total, value) => total + value, 0);

test('перетаскивание перераспределяет ширину между соседями', () => {
  const next = resizeColumns(DEFAULT_COLUMNS, 0, 100, WIDTH);

  assert.ok(next[0] > DEFAULT_COLUMNS[0], 'левая колонка шире');
  assert.ok(next[1] < DEFAULT_COLUMNS[1], 'правая соседка уже');
  assert.equal(next[2], DEFAULT_COLUMNS[2], 'третья колонка не должна двигаться');
});

test('сумма долей не меняется — иначе поедет вся сетка', () => {
  let columns = DEFAULT_COLUMNS;
  for (const delta of [100, -40, 25, -10, 60]) {
    const next = resizeColumns(columns, delta > 0 ? 0 : 1, delta, WIDTH);
    if (next !== null) columns = next;
  }

  assert.ok(Math.abs(sum(columns) - sum(DEFAULT_COLUMNS)) < 1e-9);
});

test('упор в минимальную ширину возвращает null, а не схлопывает колонку', () => {
  assert.equal(resizeColumns(DEFAULT_COLUMNS, 0, -400, WIDTH), null);
  assert.equal(resizeColumns(DEFAULT_COLUMNS, 1, 400, WIDTH), null);
});

test('ни одна колонка не может стать уже минимума', () => {
  let columns = DEFAULT_COLUMNS;
  for (let step = 0; step < 50; step += 1) {
    const next = resizeColumns(columns, 0, -20, WIDTH);
    if (next === null) break;
    columns = next;
  }

  const pxPerFr = (WIDTH - 12) / sum(columns);
  assert.ok(Math.min(...columns) * pxPerFr >= MIN_COLUMN_PX - 1e-9);
});

test('в слишком узком окне двигать нечего', () => {
  assert.equal(resizeColumns(DEFAULT_COLUMNS, 0, 10, 500), null);
  assert.equal(resizeColumns(DEFAULT_COLUMNS, 0, 10, 0), null);
});

test('повреждённые сохранённые доли откатываются к умолчанию', () => {
  for (const broken of [undefined, null, 'сломано', [1, 2], ['a', 1, 2], [1, 0, 2], [NaN, 1, 1], [Infinity, 1, 1]]) {
    assert.equal(sanitizeColumns(broken), DEFAULT_COLUMNS, `не отфильтровано: ${JSON.stringify(broken)}`);
  }
});

test('корректные сохранённые доли берутся как есть', () => {
  const saved = [2, 1, 1];
  assert.equal(sanitizeColumns(saved), saved);
});

test('русские числительные выбираются по двум последним цифрам', () => {
  const forms = ['запрос', 'запроса', 'запросов'];
  const cases = [
    [0, 'запросов'],
    [1, 'запрос'],
    [2, 'запроса'],
    [4, 'запроса'],
    [5, 'запросов'],
    [11, 'запросов'],
    [12, 'запросов'],
    [14, 'запросов'],
    [15, 'запросов'],
    [21, 'запрос'],
    [22, 'запроса'],
    [25, 'запросов'],
    [101, 'запрос'],
    [111, 'запросов'],
    [112, 'запросов'],
  ];

  for (const [count, expected] of cases) {
    assert.equal(plural(count, forms), expected, `${count}`);
  }
});

test('статусы раскладываются по цветовым группам', () => {
  assert.equal(statusClass(200), 'status status--2xx');
  assert.equal(statusClass(204), 'status status--2xx');
  // 3xx до v0.4.2 попадал в зелёную группу — ради этого случая функция и
  // вынесена из трёх разошедшихся копий в общий модуль.
  assert.equal(statusClass(301), 'status status--3xx');
  assert.equal(statusClass(400), 'status status--4xx');
  assert.equal(statusClass(500), 'status status--5xx');
  assert.equal(statusClass(100), 'status status--1xx');
});

test('расшифровки статусов есть для всех, что встречаются в сценарии', () => {
  for (const status of [200, 201, 204, 400, 404, 409, 500]) {
    assert.ok(STATUS_TEXT[status], `нет расшифровки для ${status}`);
  }
});
