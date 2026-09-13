// JSON Schema ответов Orders API.
//
// Схемы написаны по спецификации и корректны, но поймают они здесь почти
// ничего — и это важная часть урока. Все дефекты сценария лежат в значениях и
// в поведении: сумма посчитана не так, порядок не тот, повтор меняет
// состояние. JSON Schema описывает форму, а не смысл: «total равен
// subtotal − discount» на её языке невыразимо.
//
// Единственное, что схема здесь ловит, — отрицательные значения там, где их
// быть не может (qty и суммы), то есть край дефекта O9.

const item = {
  type: 'object',
  required: ['sku', 'title', 'qty', 'price'],
  additionalProperties: false,
  properties: {
    sku: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    qty: { type: 'integer', minimum: 1 },
    price: { type: 'number', minimum: 0 },
  },
};

const order = {
  type: 'object',
  required: [
    'id',
    'customer',
    'items',
    'subtotal',
    'discount',
    'total',
    'status',
    'paidAmount',
    'comment',
    'createdAt',
  ],
  additionalProperties: false,
  properties: {
    id: { type: 'integer', minimum: 1 },
    customer: { type: 'string', format: 'email' },
    items: { type: 'array', minItems: 1, items: item },
    subtotal: { type: 'number', minimum: 0 },
    discount: { type: 'number', minimum: 0 },
    total: { type: 'number', minimum: 0 },
    status: { type: 'string', enum: ['new', 'paid', 'shipped', 'cancelled'] },
    paidAmount: { type: 'number', minimum: 0 },
    // Комментария может не быть — тогда null, а не отсутствующее поле.
    comment: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const orderList = {
  type: 'object',
  required: ['items', 'total', 'page', 'limit'],
  additionalProperties: false,
  properties: {
    items: { type: 'array', items: order },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 50 },
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

export const responseSchemas = {
  'GET /orders': { 200: orderList, 400: errorBody },
  'GET /orders/:id': { 200: order, 404: errorBody },
  'POST /orders': { 201: order, 400: errorBody, 404: errorBody },
  'POST /orders/:id/pay': { 200: order, 409: errorBody, 404: errorBody },
  'PATCH /orders/:id': { 200: order, 400: errorBody, 409: errorBody, 404: errorBody },
};
