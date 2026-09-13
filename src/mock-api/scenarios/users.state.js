// Состояние сценария Users. Живёт в модуле, а не в React: сервер обязан
// переживать перерисовки компонентов, иначе созданный пользователь исчезал бы
// при каждом обновлении экрана.
//
// У каждого сценария своё состояние и своя функция сброса — реестр в index.js
// вызывает нужную. Общего хранилища нет намеренно: сценарии независимы, и
// сброс одного не должен трогать другой.

// B9: по спецификации createdAt — ISO 8601 вида "2026-01-14T10:00:00Z".
// Здесь дата собирается вручную: пробел вместо разделителя "T" и полное
// отсутствие таймзоны. Такой формат не распарсится половиной клиентов.
export function brokenTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const hms = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${ymd} ${hms}`;
}

// Не настоящая криптография — правдоподобная строка, чтобы утечка в B3
// выглядела как утечка, а не как заглушка "hash".
export function fakeHash(seed) {
  let acc = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    acc ^= seed.charCodeAt(i);
    acc = Math.imul(acc, 0x01000193) >>> 0;
  }
  return `$2b$10$${acc.toString(16).padStart(8, '0')}${(acc * 7 >>> 0).toString(16)}`;
}

// Эталонные данные. Каждый сброс возвращает сервер ровно к ним.
// passwordHash — внутреннее поле: оно есть в хранилище, как было бы у
// настоящего сервиса, но наружу отдаваться не должно.
const SEED_USERS = [
  {
    id: 1,
    email: 'anna@example.com',
    name: 'Anna',
    role: 'user',
    createdAt: '2026-01-14 10:00:00',
    passwordHash: fakeHash('anna@example.com'),
  },
  {
    id: 2,
    email: 'boris@example.com',
    name: 'Boris',
    role: 'admin',
    createdAt: '2026-01-15 09:30:00',
    passwordHash: fakeHash('boris@example.com'),
  },
  {
    id: 3,
    email: 'clara@example.com',
    name: 'Clara',
    role: 'user',
    createdAt: '2026-02-02 18:45:00',
    passwordHash: fakeHash('clara@example.com'),
  },
  {
    id: 4,
    email: 'dmitry@example.com',
    name: 'Dmitry',
    role: 'moderator',
    createdAt: '2026-02-11 12:05:00',
    passwordHash: fakeHash('dmitry@example.com'),
  },
];

let users = [];
let idCounter = 0;

export function resetUsers() {
  // Копируем каждую запись: без этого обработчики мутировали бы сами
  // эталонные объекты, и сброс перестал бы что-либо сбрасывать.
  users = SEED_USERS.map((user) => ({ ...user }));
  idCounter = users.reduce((max, user) => Math.max(max, user.id), 0);
}

resetUsers();

export function listUsers() {
  return users;
}

export function findUser(id) {
  return users.find((user) => user.id === id);
}

export function insertUser(user) {
  users.push(user);
  return user;
}

export function patchUser(id, changes) {
  const user = findUser(id);
  Object.assign(user, changes);
  return user;
}

export function removeUser(id) {
  users = users.filter((user) => user.id !== id);
}

export function nextId() {
  idCounter += 1;
  return idCounter;
}
