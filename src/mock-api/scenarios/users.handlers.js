import {
  listUsers,
  findUser,
  insertUser,
  patchUser,
  removeUser,
  nextId,
  brokenTimestamp,
  fakeHash,
} from './users.state.js';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Публичное представление записи: внутреннее поле passwordHash наружу не идёт.
function toPublicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// B10: элемент списка собирается отдельно от toPublicUser и поле role в него
// не попало. В GET /users/:id роль есть, в GET /users — нет: один и тот же
// ресурс описан двумя разными наборами полей.
function toListItem(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

function getUsersList({ query }) {
  const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
  const page = query.page === undefined ? 1 : Number(query.page);
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;

  // B5: ноль — значение вне допустимого диапазона 1..100, по спецификации
  // здесь положен 400. Вместо этого ноль трактуется как "без ограничения"
  // и отдаётся весь список целиком.
  if (limit === 0) {
    return {
      status: 200,
      body: {
        items: listUsers().map(toListItem),
        total: 100, // B4
        page: safePage,
        limit: 0,
      },
    };
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return {
      status: 400,
      body: { error: 'limit must be an integer between 1 and 100' },
    };
  }

  const all = listUsers();
  const start = (safePage - 1) * limit;
  const items = all.slice(start, start + limit).map(toListItem);

  return {
    status: 200,
    body: {
      items,
      // B4: total захардкожен и не связан с реальным количеством записей.
      // Пагинация, построенная на этом числе, всегда обещает лишние страницы.
      total: 100,
      page: safePage,
      limit,
    },
  };
}

function getUserById({ params }) {
  const user = findUser(Number(params.id));

  // B8: по спецификации отсутствующий пользователь — это 404 { error }.
  // Результат поиска отдаётся как есть, без проверки на undefined: клиент
  // получает 200 и тело null, то есть "успех" с пустотой внутри.
  if (!user) {
    return { status: 200, body: null };
  }

  return { status: 200, body: toPublicUser(user) };
}

function createUser({ body }) {
  const data = body || {};

  if (!data.email || !data.name) {
    return { status: 400, body: { error: 'email and name are required' } };
  }

  // B2: проверки формата email нет вообще — строка "abc" без "@" и домена
  // проходит как валидный адрес.

  const duplicate = listUsers().some((user) => user.email === data.email);
  if (duplicate) {
    return { status: 409, body: { error: 'email already exists' } };
  }

  const user = {
    id: nextId(),
    email: data.email,
    name: data.name,
    role: data.role || 'user',
    createdAt: brokenTimestamp(), // B9
    passwordHash: fakeHash(data.email),
  };
  insertUser(user);

  // B1: создание ресурса по спецификации — 201 Created, возвращается 200.
  // B3: запись уходит наружу целиком, минуя toPublicUser, — вместе с
  //     внутренним passwordHash. Классическая утечка через "верни как есть".
  return { status: 200, body: user };
}

function replaceUser({ params, body }) {
  const user = findUser(Number(params.id));
  if (!user) {
    return { status: 404, body: { error: 'Not found' } };
  }

  const data = body || {};

  // B6: name в набор изменений не попал. Поле молча игнорируется, ошибки нет,
  // ответ 200 — и в нём старое имя. Снаружи выглядит как успешное обновление.
  const updated = patchUser(user.id, {
    email: data.email === undefined ? user.email : data.email,
    role: data.role === undefined ? user.role : data.role,
  });

  return { status: 200, body: toPublicUser(updated) };
}

function deleteUser({ params }) {
  const user = findUser(Number(params.id));
  if (!user) {
    return { status: 404, body: { error: 'Not found' } };
  }

  removeUser(user.id);

  // B7: по спецификации удаление — 204 без тела. Возвращается 200 и тело
  // с удалённым объектом.
  return { status: 200, body: { deleted: true, user: toPublicUser(user) } };
}

export const usersRoutes = [
  { method: 'GET', path: '/users', handler: getUsersList },
  { method: 'GET', path: '/users/:id', handler: getUserById },
  { method: 'POST', path: '/users', handler: createUser },
  { method: 'PUT', path: '/users/:id', handler: replaceUser },
  { method: 'DELETE', path: '/users/:id', handler: deleteUser },
];
