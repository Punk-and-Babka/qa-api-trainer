// Сценарий Orders: корректное поведение и все десять вшитых дефектов.
//
// Как и в Users, дефекты закреплены тестами намеренно — они и есть содержание
// сценария. Разница в том, что здесь почти все они про смысл, а не про форму:
// проверить их можно только вычислив ожидаемый результат самому.

import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/mock-api/server.js';
import { findScenario } from '../src/mock-api/scenarios/index.js';
import { CATALOG } from '../src/mock-api/scenarios/orders.state.js';

const orders = findScenario('orders');

function request(method, path, body = null, query = {}) {
  return handle({ method, path, query, headers: {}, body }, orders.routes);
}

function price(sku) {
  return CATALOG.find((item) => item.sku === sku).price;
}

test('корректное поведение, которое ломать нельзя', () => {
  orders.reset();

  assert.equal(request('GET', '/orders', null, { limit: '51' }).status, 400, 'верхняя граница limit');
  assert.equal(request('GET', '/orders', null, { page: '0' }).status, 400, 'страница с нуля');
  assert.equal(
    request('POST', '/orders', { customer: 'a@b.io', items: [] }).status,
    400,
    'пустой список позиций',
  );
  assert.equal(
    request('POST', '/orders', { customer: 'a@b.io', items: [{ sku: 'NOPE', qty: 1 }] }).status,
    404,
    'неизвестный sku',
  );
  assert.equal(
    request('POST', '/orders', { customer: 'a@b.io', items: [{ sku: 'KB-01', qty: 1 }], promo: 'НЕТ' })
      .status,
    400,
    'неизвестный промокод',
  );
  assert.equal(request('PATCH', '/orders/1001', { status: 'готов' }).status, 400, 'нет такого статуса');
  assert.equal(request('PATCH', '/orders/1001', { status: 'shipped' }).status, 409, 'new → shipped запрещён');
  assert.equal(request('POST', '/orders/1004/pay').status, 409, 'оплата отправленного');
  assert.equal(request('GET', '/orders/999999').status, 404);
  assert.equal(request('PATCH', '/orders/999999', { status: 'paid' }).status, 404);
});

test('сброс возвращает заказы к эталону, не мутируя его', () => {
  orders.reset();
  const before = request('GET', '/orders', null, { limit: '50' }).body.items;

  request('POST', '/orders/1001/pay');
  request('POST', '/orders', { customer: 'x@y.io', items: [{ sku: 'CB-04', qty: 1 }] });
  orders.reset();

  const after = request('GET', '/orders', null, { limit: '50' }).body.items;
  assert.deepEqual(after, before, 'позиции вложены в заказ — копировать нужно оба уровня');
});

test('O1: total округляется вниз и расходится с subtotal', () => {
  orders.reset();
  const response = request('POST', '/orders', {
    customer: 'a@b.io',
    items: [{ sku: 'HD-03', qty: 3 }],
  });

  const expected = price('HD-03') * 3;
  assert.equal(response.body.subtotal, Math.round(expected * 100) / 100);
  assert.notEqual(response.body.total, response.body.subtotal - response.body.discount);
  assert.equal(response.body.total, Math.floor(expected), 'копейки теряются');
});

test('O4: промокод применяется к каждой позиции отдельно', () => {
  orders.reset();
  const one = request('POST', '/orders', {
    customer: 'a@b.io',
    items: [{ sku: 'KB-01', qty: 1 }],
    promo: 'SALE10',
  }).body;
  const three = request('POST', '/orders', {
    customer: 'a@b.io',
    items: [
      { sku: 'KB-01', qty: 1 },
      { sku: 'MS-02', qty: 1 },
      { sku: 'CB-04', qty: 1 },
    ],
    promo: 'SALE10',
  }).body;

  // На одной позиции ошибка не видна: множитель равен единице.
  assert.equal(one.discount, one.subtotal * 0.1);
  assert.equal(three.discount, Math.round(three.subtotal * 0.3 * 100) / 100, 'вместо 10% вышло 30%');
});

test('O9: количество не проверяется', () => {
  orders.reset();
  const zero = request('POST', '/orders', {
    customer: 'a@b.io',
    items: [{ sku: 'KB-01', qty: 0 }],
  });
  const negative = request('POST', '/orders', {
    customer: 'a@b.io',
    items: [
      { sku: 'KB-01', qty: 2 },
      { sku: 'MS-02', qty: -1 },
    ],
  });

  assert.equal(zero.status, 201, 'по спецификации должно быть 400');
  assert.equal(zero.body.total, 0);
  assert.equal(negative.status, 201);
  assert.ok(
    negative.body.subtotal < price('KB-01') * 2,
    'отрицательное количество уменьшает сумму заказа',
  );
});

test('O7: кириллица в комментарии искажается', () => {
  orders.reset();
  const response = request('POST', '/orders', {
    customer: 'a@b.io',
    items: [{ sku: 'CB-04', qty: 1 }],
    comment: 'Позвонить заранее',
  });

  assert.notEqual(response.body.comment, 'Позвонить заранее');
  assert.match(response.body.comment, /\?/);
  // Латиница при этом проходит целой — иначе дефект выглядел бы как «сервер
  // не сохраняет комментарий вовсе».
  const latin = request('POST', '/orders', {
    customer: 'a@b.io',
    items: [{ sku: 'CB-04', qty: 1 }],
    comment: 'call before delivery',
  });
  assert.equal(latin.body.comment, 'call before delivery');
});

test('O3: повторная оплата проходит и удваивает paidAmount', () => {
  orders.reset();
  const created = request('POST', '/orders', {
    customer: 'a@b.io',
    items: [{ sku: 'HD-03', qty: 1 }],
  }).body;

  const first = request('POST', `/orders/${created.id}/pay`);
  const second = request('POST', `/orders/${created.id}/pay`);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200, 'по спецификации повтор должен давать 409');
  assert.equal(second.body.paidAmount, first.body.paidAmount * 2);
});

test('O2: отменённый заказ можно оплатить', () => {
  orders.reset();
  const created = request('POST', '/orders', {
    customer: 'a@b.io',
    items: [{ sku: 'CB-04', qty: 1 }],
  }).body;

  assert.equal(request('PATCH', `/orders/${created.id}`, { status: 'cancelled' }).status, 200);
  const paid = request('POST', `/orders/${created.id}/pay`);

  assert.equal(paid.status, 200, 'по спецификации должно быть 409');
  assert.equal(paid.body.status, 'paid', 'отменённый заказ стал оплаченным');
});

test('O8: разрешён переход paid → new', () => {
  orders.reset();
  request('POST', '/orders/1001/pay');
  const back = request('PATCH', '/orders/1001', { status: 'new' });

  assert.equal(back.status, 200, 'по спецификации должно быть 409');
  assert.equal(back.body.status, 'new');
  // Обратный переход из shipped при этом закрыт — сломано не всё подряд.
  assert.equal(request('PATCH', '/orders/1004', { status: 'new' }).status, 409);
});

test('O6: список отсортирован не по дате', () => {
  orders.reset();
  const items = request('GET', '/orders', null, { limit: '50' }).body.items;

  const byDateDesc = [...items].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  assert.notDeepEqual(
    items.map((order) => order.id),
    byDateDesc.map((order) => order.id),
    'спецификация обещает новые первыми',
  );
});

test('O10: отменённые заказы остаются в списке и в счётчике', () => {
  orders.reset();
  const body = request('GET', '/orders', null, { limit: '50' }).body;

  assert.ok(
    body.items.some((order) => order.status === 'cancelled'),
    'по спецификации список только из активных',
  );
  assert.equal(body.total, body.items.length, 'счётчик считает те же записи, включая отменённые');
});

test('O5: соседние страницы перекрываются', () => {
  orders.reset();
  const first = request('GET', '/orders', null, { limit: '2', page: '1' }).body.items;
  const second = request('GET', '/orders', null, { limit: '2', page: '2' }).body.items;

  const overlap = first.filter((order) => second.some((other) => other.id === order.id));
  assert.equal(overlap.length, 1, 'последняя запись страницы повторяется на следующей');
});

test('первая страница остаётся корректной', () => {
  // Дефект пагинации не должен ломать самый первый запрос: список без
  // параметров обязан выглядеть нормально, иначе это читается как «данных
  // нет», а не как дефект.
  orders.reset();
  const plain = request('GET', '/orders').body;

  assert.equal(plain.items.length, 5);
  assert.equal(plain.page, 1);
});
