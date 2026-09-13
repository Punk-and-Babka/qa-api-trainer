// Состояние сценария Orders. Устроено так же, как у Users: данные живут в
// модуле, сброс возвращает их к эталону копированием.
//
// В отличие от Users, здесь есть каталог товаров: цены приходят с сервера, а
// не из запроса. Так дефекты в подсчёте суммы становятся проверяемыми — цену
// позиции студент видит в ответе и может перемножить сам.

export const CATALOG = [
  { sku: 'KB-01', title: 'Клавиатура механическая', price: 5490 },
  { sku: 'MS-02', title: 'Мышь беспроводная', price: 1290.5 },
  { sku: 'HD-03', title: 'Наушники', price: 349.99 },
  { sku: 'CB-04', title: 'Кабель USB-C', price: 99.9 },
];

// Промокоды. Скидка в процентах от суммы заказа — по спецификации она
// применяется к заказу целиком, один раз.
export const PROMOS = {
  SALE10: 10,
  SALE25: 25,
};

export const STATUSES = ['new', 'paid', 'shipped', 'cancelled'];

function line(sku, qty) {
  const product = CATALOG.find((item) => item.sku === sku);
  return { sku: product.sku, title: product.title, qty, price: product.price };
}

// Эталонные заказы. Даты намеренно вразнобой: список обязан сортироваться по
// дате, и на одинаковых датах дефект сортировки был бы не виден.
const SEED_ORDERS = [
  {
    id: 1001,
    customer: 'anna@example.com',
    items: [line('KB-01', 1), line('MS-02', 2)],
    subtotal: 5490 + 1290.5 * 2,
    discount: 0,
    total: 5490 + 1290.5 * 2,
    status: 'new',
    comment: null,
    promo: null,
    paidAmount: 0,
    createdAt: '2026-03-02T11:20:00Z',
  },
  {
    id: 1002,
    customer: 'boris@example.com',
    items: [line('HD-03', 1)],
    subtotal: 349.99,
    discount: 0,
    total: 349.99,
    status: 'paid',
    comment: 'Позвонить перед доставкой',
    promo: null,
    paidAmount: 349.99,
    createdAt: '2026-03-05T09:05:00Z',
  },
  {
    id: 1003,
    customer: 'clara@example.com',
    items: [line('CB-04', 3)],
    subtotal: 99.9 * 3,
    discount: 0,
    total: 99.9 * 3,
    status: 'cancelled',
    comment: null,
    promo: null,
    paidAmount: 0,
    createdAt: '2026-03-01T16:40:00Z',
  },
  {
    id: 1004,
    customer: 'dmitry@example.com',
    items: [line('KB-01', 1), line('CB-04', 1)],
    subtotal: 5490 + 99.9,
    discount: 0,
    total: 5490 + 99.9,
    status: 'shipped',
    comment: null,
    promo: null,
    paidAmount: 5490 + 99.9,
    createdAt: '2026-02-27T08:15:00Z',
  },
  {
    id: 1005,
    customer: 'elena@example.com',
    items: [line('MS-02', 1), line('HD-03', 2)],
    subtotal: 1290.5 + 349.99 * 2,
    discount: 0,
    total: 1290.5 + 349.99 * 2,
    status: 'new',
    comment: null,
    promo: null,
    paidAmount: 0,
    createdAt: '2026-03-07T14:00:00Z',
  },
];

let orders = [];
let idCounter = 0;

export function resetOrders() {
  // Копируется и заказ, и каждая позиция: позиции — вложенные объекты, и без
  // второго уровня копирования обработчики правили бы эталон.
  orders = SEED_ORDERS.map((order) => ({
    ...order,
    items: order.items.map((item) => ({ ...item })),
  }));
  idCounter = orders.reduce((max, order) => Math.max(max, order.id), 0);
}

resetOrders();

export function listOrders() {
  return orders;
}

export function findOrder(id) {
  return orders.find((order) => order.id === id);
}

export function insertOrder(order) {
  orders.push(order);
  return order;
}

export function nextOrderId() {
  idCounter += 1;
  return idCounter;
}

// Деньги считаются в копейках и округляются в конце: 0.1 + 0.2 в двоичной
// плавающей точке даёт 0.30000000000000004, и такие хвосты в ответе выглядели
// бы как отдельный дефект, которого в каталоге нет.
export function money(value) {
  return Math.round(value * 100) / 100;
}
