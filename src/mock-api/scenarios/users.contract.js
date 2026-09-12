// Эталонная спецификация Users API — то, с чем студент сверяет ответы сервера.
// Это данные, а не разметка: панель слева рендерится обходом этого объекта,
// поэтому новый эндпоинт добавляется сюда и появляется в UI сам.
//
// Реализация в users.handlers.js намеренно расходится с этим описанием
// в десяти местах. Расхождения здесь не отмечены — их и нужно найти.

export const usersContract = {
  title: 'Users API',
  description:
    'Справочник пользователей. Все ответы — JSON. Даты в формате ISO 8601.',

  model: {
    name: 'User',
    fields: [
      { name: 'id', type: 'number', note: 'уникальный, назначается сервером' },
      { name: 'email', type: 'string', note: 'уникальный, валидный адрес' },
      { name: 'name', type: 'string', note: 'непустая строка' },
      { name: 'role', type: 'string', note: 'user | admin | moderator' },
      { name: 'createdAt', type: 'string', note: 'ISO 8601, UTC' },
    ],
    example: {
      id: 1,
      email: 'anna@example.com',
      name: 'Anna',
      role: 'user',
      createdAt: '2026-01-14T10:00:00Z',
    },
  },

  endpoints: [
    {
      method: 'GET',
      path: '/users',
      summary: 'Список пользователей с пагинацией',
      query: [
        {
          name: 'limit',
          type: 'number',
          required: false,
          note: 'по умолчанию 10, допустимый диапазон 1–100',
        },
        {
          name: 'page',
          type: 'number',
          required: false,
          note: 'по умолчанию 1, нумерация с единицы',
        },
      ],
      responses: [
        {
          status: 200,
          note: 'total — реальное общее количество записей на сервере',
          example: {
            items: [
              {
                id: 1,
                email: 'anna@example.com',
                name: 'Anna',
                role: 'user',
                createdAt: '2026-01-14T10:00:00Z',
              },
            ],
            total: 4,
            page: 1,
            limit: 10,
          },
        },
        { status: 400, note: 'limit вне диапазона 1–100' },
      ],
    },

    {
      method: 'GET',
      path: '/users/:id',
      summary: 'Один пользователь по идентификатору',
      responses: [
        { status: 200, note: 'объект User целиком' },
        { status: 404, note: 'пользователя с таким id нет', example: { error: 'Not found' } },
      ],
    },

    {
      method: 'POST',
      path: '/users',
      summary: 'Создание пользователя',
      body: {
        fields: [
          { name: 'email', type: 'string', required: true, note: 'валидный адрес' },
          { name: 'name', type: 'string', required: true, note: 'непустая строка' },
          { name: 'role', type: 'string', required: false, note: 'по умолчанию user' },
        ],
        example: { email: 'egor@example.com', name: 'Egor' },
      },
      responses: [
        { status: 201, note: 'созданный объект User' },
        { status: 400, note: 'нет обязательного поля либо email невалиден' },
        { status: 409, note: 'пользователь с таким email уже существует' },
      ],
    },

    {
      method: 'PUT',
      path: '/users/:id',
      summary: 'Обновление пользователя',
      body: {
        fields: [
          { name: 'email', type: 'string', required: false },
          { name: 'name', type: 'string', required: false },
          { name: 'role', type: 'string', required: false },
        ],
        example: { name: 'Anna Petrova', role: 'admin' },
      },
      responses: [
        { status: 200, note: 'обновлённый объект User со всеми применёнными изменениями' },
        { status: 404, note: 'пользователя с таким id нет' },
      ],
    },

    {
      method: 'DELETE',
      path: '/users/:id',
      summary: 'Удаление пользователя',
      responses: [
        { status: 204, note: 'без тела ответа' },
        { status: 404, note: 'пользователя с таким id нет' },
      ],
    },
  ],
};
