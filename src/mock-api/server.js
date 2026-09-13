import { usersRoutes } from './scenarios/users.handlers.js';

const routes = usersRoutes;

// Сопоставление пути с шаблоном вида "/users/:id".
// Экспортируется: тем же матчингом пользуется проверка ответа по схеме, ей
// нужно понять, какому эндпоинту спецификации соответствует "/users/1".
// Второй такой же матчер в UI означал бы два места, которые обязаны совпадать.
// Возвращает объект параметров при совпадении и null при несовпадении.
// Важно именно null, а не пустой объект: у "/users" параметров нет, но
// совпадение есть, и отличить одно от другого нужно.
export function matchPath(pattern, actual) {
  const expected = pattern.split('/').filter(Boolean);
  const given = actual.split('/').filter(Boolean);

  if (expected.length !== given.length) {
    return null;
  }

  const params = {};
  for (let i = 0; i < expected.length; i += 1) {
    const segment = expected[i];
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = given[i];
    } else if (segment !== given[i]) {
      return null;
    }
  }
  return params;
}

// Фиктивное время ответа. Считается здесь, а не в UI, чтобы значение пришло
// в составе ответа — вызывающий код просто задержит показ на это число мс.
function responseTime() {
  return 18 + Math.floor(Math.random() * 62);
}

function finish(result) {
  return {
    status: result.status,
    headers: { 'Content-Type': 'application/json', ...(result.headers || {}) },
    body: result.body === undefined ? null : result.body,
    time: responseTime(),
  };
}

export function handle(request) {
  const method = (request.method || 'GET').toUpperCase();
  const path = request.path || '/';
  const query = request.query || {};
  const headers = request.headers || {};
  const body = request.body === undefined ? null : request.body;

  for (const route of routes) {
    const params = matchPath(route.path, path);
    if (params === null || route.method !== method) {
      continue;
    }
    return finish(route.handler({ method, path, query, headers, body, params }));
  }

  return finish({ status: 404, body: { error: 'Not found' } });
}
