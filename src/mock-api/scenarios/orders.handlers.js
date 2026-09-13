// Обработчики Orders. Каждое отступление от спецификации помечено
// идентификатором дефекта прямо в точке ошибки.
//
// Дефекты этого сценария другого рода, чем в Users: тело ответа всюду
// структурно корректно, статусы правдоподобны, дата в ISO 8601. Неверен смысл —
// арифметика, порядок, правила предметной области, поведение при повторе.
// Ни один из них не ловится проверкой по схеме, и это главное свойство
// сценария: он про понимание, а не про форму.

import {
  CATALOG,
  PROMOS,
  STATUSES,
  findOrder,
  insertOrder,
  listOrders,
  money,
  nextOrderId,
} from './orders.state.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// Допустимые переходы по спецификации: new → paid, new → cancelled,
// paid → shipped.
//
// O8: в таблицу добавлен переход paid → new, которого спецификация не
// разрешает. Отправленный заказ так «вернуть» нельзя, а оплаченный — можно,
// и это открывает путь к повторной оплате уже проведённого заказа.
const TRANSITIONS = {
  new: ['paid', 'cancelled'],
  paid: ['shipped', 'new'], // O8
  shipped: [],
  cancelled: [],
};

function toPublicOrder(order) {
  return {
    id: order.id,
    customer: order.customer,
    items: order.items.map((item) => ({ ...item })),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    status: order.status,
    paidAmount: order.paidAmount,
    comment: order.comment,
    createdAt: order.createdAt,
  };
}

function parsePositive(raw, fallback) {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(String(raw))) return null;
  return Number(raw);
}

function getOrdersList({ query }) {
  const limit = parsePositive(query.limit, DEFAULT_LIMIT);
  const page = parsePositive(query.page, 1);

  if (limit === null || limit < 1 || limit > MAX_LIMIT || page === null || page < 1) {
    return {
      status: 400,
      body: { error: 'limit must be between 1 and 50, page must be 1 or greater' },
    };
  }

  // O10: отменённые заказы должны быть исключены из списка активных, но
  // фильтра нет. Они видны и в items, и в total — это меняет и картину
  // списка, и счётчик.
  const active = listOrders();

  // O6: спецификация обещает «новые первыми», то есть сортировку по createdAt
  // по убыванию. Здесь порядок — по возрастанию id, то есть по времени
  // создания записи в хранилище. На сидовых данных это разные порядки.
  const sorted = [...active].sort((left, right) => left.id - right.id);

  // O5: шаг страницы посчитан как limit − 1 вместо limit. Первая страница
  // корректна, а каждая следующая начинается на запись раньше, чем должна:
  // границы страниц перекрываются, и один и тот же заказ встречается дважды.
  //
  // Дефект намеренно не ломает первый же запрос: список без параметров
  // выглядит нормально, и обнаруживается перекрытие только при обходе
  // страниц подряд. Ошибка, которая видна сразу, ничему не учит.
  const offset = (page - 1) * (limit - 1);

  return {
    status: 200,
    body: {
      items: sorted.slice(offset, offset + limit).map(toPublicOrder),
      total: active.length,
      page,
      limit,
    },
  };
}

function getOrderById({ params }) {
  const order = findOrder(Number(params.id));
  if (order === undefined) {
    return { status: 404, body: { error: 'Not found' } };
  }

  return { status: 200, body: toPublicOrder(order) };
}

function createOrder({ body }) {
  const data = body || {};

  if (typeof data.customer !== 'string' || data.customer.trim() === '') {
    return { status: 400, body: { error: 'customer is required' } };
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { status: 400, body: { error: 'items must be a non-empty array' } };
  }

  const items = [];
  for (const requested of data.items) {
    const product = CATALOG.find((item) => item.sku === requested?.sku);
    if (product === undefined) {
      return { status: 404, body: { error: `unknown sku: ${requested?.sku}` } };
    }

    // O9: спецификация требует целое количество не меньше единицы. Проверки
    // нет вовсе: qty=0 создаёт позицию, которая ничего не стоит и ничего не
    // значит, а qty=-1 ещё и уменьшает сумму заказа.
    const qty = Number(requested.qty);
    items.push({ sku: product.sku, title: product.title, qty, price: product.price });
  }

  const subtotal = money(items.reduce((sum, item) => sum + item.price * item.qty, 0));

  let discount = 0;
  if (data.promo !== undefined) {
    const percent = PROMOS[data.promo];
    if (percent === undefined) {
      return { status: 400, body: { error: `unknown promo: ${data.promo}` } };
    }

    // O4: скидка должна применяться к заказу целиком один раз. Здесь она
    // считается для каждой позиции отдельно и суммируется — при нескольких
    // позициях процент фактически умножается на их количество.
    discount = money(
      items.reduce((sum, item) => sum + (item.price * item.qty * percent) / 100, 0) *
        items.length,
    );
  }

  // O1: total обязан быть ровно subtotal − discount. Здесь результат
  // округляется вниз до целого рубля — копейки исчезают, и сумма перестаёт
  // сходиться с позициями.
  const total = Math.floor(subtotal - discount);

  const order = {
    id: nextOrderId(),
    customer: data.customer,
    items,
    subtotal,
    discount,
    total,
    status: 'new',
    paidAmount: 0,
    // O7: комментарий должен сохраняться как есть. Здесь все символы вне
    // ASCII заменяются знаком вопроса — так выглядит потеря кодировки при
    // передаче между сервисами.
    comment: data.comment === undefined ? null : String(data.comment).replace(/[^\x00-\x7F]/g, '?'),
    promo: data.promo ?? null,
    createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };

  insertOrder(order);
  return { status: 201, body: toPublicOrder(order) };
}

function payOrder({ params }) {
  const order = findOrder(Number(params.id));
  if (order === undefined) {
    return { status: 404, body: { error: 'Not found' } };
  }

  // По спецификации оплатить можно только заказ в статусе new. Проверка
  // отсеивает лишь отправленные заказы.
  //
  // O2: отменённый заказ оплачивается как ни в чём не бывало и переходит в
  // paid — деньги списываются за отменённый заказ.
  // O3: уже оплаченный заказ оплачивается повторно, и paidAmount растёт с
  // каждым вызовом. Повторная отправка того же запроса обязана быть
  // безопасной, а здесь она удваивает сумму.
  if (order.status === 'shipped') {
    return { status: 409, body: { error: 'order already shipped' } };
  }

  order.status = 'paid';
  order.paidAmount = money(order.paidAmount + order.total);

  return { status: 200, body: toPublicOrder(order) };
}

function changeStatus({ params, body }) {
  const order = findOrder(Number(params.id));
  if (order === undefined) {
    return { status: 404, body: { error: 'Not found' } };
  }

  const next = body?.status;
  if (!STATUSES.includes(next)) {
    return { status: 400, body: { error: `unknown status: ${next}` } };
  }

  if (!TRANSITIONS[order.status].includes(next)) {
    return {
      status: 409,
      body: { error: `transition ${order.status} -> ${next} is not allowed` },
    };
  }

  order.status = next;
  return { status: 200, body: toPublicOrder(order) };
}

export const ordersRoutes = [
  { method: 'GET', path: '/orders', handler: getOrdersList },
  { method: 'POST', path: '/orders', handler: createOrder },
  // Более длинный путь объявлен раньше: роутер берёт первое совпадение, а
  // "/orders/:id" совпал бы и с "/orders/1001/pay" по числу сегментов? Нет —
  // сегментов разное количество, поэтому конфликта нет, но порядок всё равно
  // держим от частного к общему: так добавление нового пути не сломает
  // существующий.
  { method: 'POST', path: '/orders/:id/pay', handler: payOrder },
  { method: 'GET', path: '/orders/:id', handler: getOrderById },
  { method: 'PATCH', path: '/orders/:id', handler: changeStatus },
];
