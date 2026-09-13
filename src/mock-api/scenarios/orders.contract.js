// Эталонная спецификация Orders API.
//
// Сценарий рассчитан на ручное тестирование: дефекты в реализации нарушают не
// форму ответа, а его смысл — арифметику, порядок, правила смены статуса,
// поведение при повторе. Ни один из них не виден в структуре тела, поэтому
// проверка по схеме здесь почти бесполезна. Это намеренно: контрактные
// проверки не заменяют понимания предметной области.

export const ordersContract = {
  title: 'Orders API',
  description:
    'Заказы интернет-магазина. Цены берутся из каталога сервера. Все суммы в рублях, ' +
    'даты в формате ISO 8601.',

  model: {
    name: 'Order',
    fields: [
      { name: 'id', type: 'number', note: 'уникальный, назначается сервером' },
      { name: 'customer', type: 'string', note: 'email покупателя' },
      { name: 'items', type: 'array', note: 'позиции: sku, title, qty, price' },
      { name: 'subtotal', type: 'number', note: 'сумма price × qty по всем позициям' },
      { name: 'discount', type: 'number', note: 'скидка по промокоду, 0 без промокода' },
      { name: 'total', type: 'number', note: 'ровно subtotal − discount' },
      { name: 'status', type: 'string', note: 'new | paid | shipped | cancelled' },
      { name: 'paidAmount', type: 'number', note: 'сколько оплачено; 0 до оплаты' },
      { name: 'comment', type: 'string', note: 'комментарий покупателя или null' },
      { name: 'createdAt', type: 'string', note: 'ISO 8601, UTC' },
    ],
    example: {
      id: 1001,
      customer: 'anna@example.com',
      items: [{ sku: 'MS-02', title: 'Мышь беспроводная', qty: 2, price: 1290.5 }],
      subtotal: 2581,
      discount: 0,
      total: 2581,
      status: 'new',
      paidAmount: 0,
      comment: null,
      createdAt: '2026-03-02T11:20:00Z',
    },
  },

  notes: [
    'Каталог товаров: KB-01 — 5490, MS-02 — 1290.5, HD-03 — 349.99, CB-04 — 99.9.',
    'Промокоды: SALE10 — скидка 10% от суммы заказа, SALE25 — 25%. Скидка применяется ' +
      'к заказу целиком и только один раз.',
    'Допустимые переходы статуса: new → paid, new → cancelled, paid → shipped. ' +
      'Любой другой переход запрещён.',
    'Отменённый заказ не участвует ни в списке активных заказов, ни в оплате.',
  ],

  endpoints: [
    {
      method: 'GET',
      path: '/orders',
      summary: 'Список активных заказов, новые первыми',
      query: [
        {
          name: 'limit',
          type: 'number',
          required: false,
          note: 'по умолчанию 10, допустимый диапазон 1–50',
        },
        {
          name: 'page',
          type: 'number',
          required: false,
          note: 'по умолчанию 1, нумерация с единицы; страницы не пересекаются',
        },
      ],
      responses: [
        {
          status: 200,
          note:
            'items отсортированы по createdAt по убыванию — новые первыми. Отменённые ' +
            'заказы в списке не появляются. total — количество активных заказов на сервере',
          example: {
            items: [
              {
                id: 1005,
                customer: 'elena@example.com',
                items: [{ sku: 'MS-02', title: 'Мышь беспроводная', qty: 1, price: 1290.5 }],
                subtotal: 1990.48,
                discount: 0,
                total: 1990.48,
                status: 'new',
                paidAmount: 0,
                comment: null,
                createdAt: '2026-03-07T14:00:00Z',
              },
            ],
            total: 4,
            page: 1,
            limit: 10,
          },
        },
        { status: 400, note: 'limit вне диапазона 1–50 либо page меньше 1' },
      ],
    },

    {
      method: 'GET',
      path: '/orders/:id',
      summary: 'Заказ по идентификатору',
      responses: [
        { status: 200, note: 'объект Order целиком, включая отменённый' },
        { status: 404, note: 'заказа с таким id нет', example: { error: 'Not found' } },
      ],
    },

    {
      method: 'POST',
      path: '/orders',
      summary: 'Создание заказа',
      body: {
        fields: [
          { name: 'customer', type: 'string', required: true, note: 'email покупателя' },
          {
            name: 'items',
            type: 'array',
            required: true,
            note: 'непустой список позиций { sku, qty }, qty — целое не меньше 1',
          },
          { name: 'promo', type: 'string', required: false, note: 'код скидки' },
          { name: 'comment', type: 'string', required: false, note: 'сохраняется как есть' },
        ],
        example: {
          customer: 'egor@example.com',
          items: [{ sku: 'MS-02', qty: 2 }],
          promo: 'SALE10',
          comment: 'Позвонить заранее',
        },
      },
      responses: [
        {
          status: 201,
          note:
            'созданный заказ: статус new, paidAmount 0, цены и названия подставлены из ' +
            'каталога, комментарий сохранён без изменений',
        },
        { status: 400, note: 'пустой список позиций, qty меньше 1 либо неизвестный промокод' },
        { status: 404, note: 'в позициях указан sku, которого нет в каталоге' },
      ],
    },

    {
      method: 'POST',
      path: '/orders/:id/pay',
      summary: 'Оплата заказа',
      responses: [
        {
          status: 200,
          note: 'заказ переходит в статус paid, paidAmount становится равен total',
        },
        {
          status: 409,
          note: 'заказ уже оплачен, отправлен или отменён — оплатить можно только new',
        },
        { status: 404, note: 'заказа с таким id нет' },
      ],
    },

    {
      method: 'PATCH',
      path: '/orders/:id',
      summary: 'Смена статуса заказа',
      body: {
        fields: [
          { name: 'status', type: 'string', required: true, note: 'новый статус заказа' },
        ],
        example: { status: 'cancelled' },
      },
      responses: [
        { status: 200, note: 'обновлённый заказ' },
        { status: 400, note: 'статуса с таким названием не существует' },
        { status: 409, note: 'переход из текущего статуса в указанный запрещён' },
        { status: 404, note: 'заказа с таким id нет' },
      ],
    },
  ],
};
