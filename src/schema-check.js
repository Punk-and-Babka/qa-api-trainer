// Проверка ответа по JSON Schema.
//
// Как и bug-check.js, модуль не знает про React: на входе метод, путь и ответ
// сервера, на выходе обычный объект с результатом.

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { matchPath } from './mock-api/server.js';
import { usersContract } from './mock-api/scenarios/users.contract.js';
import { responseSchemas } from './mock-api/scenarios/users.schemas.js';

export const VALID = 'valid';
export const INVALID = 'invalid';
export const NO_ENDPOINT = 'no-endpoint';
export const NO_SCHEMA = 'no-schema';

// allErrors: по умолчанию ajv останавливается на первой ошибке. Для тренажёра
// нужен полный список расхождений, иначе студент чинит их по одному вслепую.
const ajv = new Ajv({ allErrors: true });

// Сам ajv форматы не проверяет: ключевое слово format без этого плагина молча
// игнорируется, и дата "2026-01-14 10:00:00" прошла бы как валидная строка.
// Именно ради B9 подключён ajv-formats.
addFormats(ajv);

// Схемы компилируются один раз на загрузку модуля, а не на каждую проверку:
// компиляция у ajv небыстрая (он генерирует код валидатора), а схемы —
// константы. Побочный плюс: ошибка в самой схеме обнаружится сразу при старте.
const compiled = {};
for (const [route, byStatus] of Object.entries(responseSchemas)) {
  compiled[route] = {};
  for (const [status, schema] of Object.entries(byStatus)) {
    compiled[route][status] = ajv.compile(schema);
  }
}

// Какому эндпоинту спецификации соответствует фактический запрос.
// "/users/1" → "GET /users/:id". null, если такого эндпоинта в спеке нет.
export function findRoute(method, path) {
  const endpoint = usersContract.endpoints.find(
    (item) => item.method === method && matchPath(item.path, path) !== null,
  );
  return endpoint === undefined ? null : `${endpoint.method} ${endpoint.path}`;
}

// Сообщения ajv лаконичны и на английском — так же, как их увидит студент в
// реальном проекте, поэтому текст не переводится. Дополняется только то, без
// чего сообщение бесполезно: "must NOT have additional properties" не называет
// поле, а имя лишнего поля — самое важное в этой ошибке.
function describe(error) {
  const path = error.instancePath === '' ? '/' : error.instancePath;

  if (error.keyword === 'additionalProperties') {
    return { path, message: `${error.message}: ${error.params.additionalProperty}` };
  }
  return { path, message: error.message };
}

export function checkResponse(method, path, response) {
  const route = findRoute(method, path);
  if (route === null) {
    return {
      verdict: NO_ENDPOINT,
      route: null,
      status: response.status,
      expected: [],
      errors: [],
    };
  }

  // Статусы, которые спецификация обещает для этого эндпоинта. Нужны в случае
  // no-schema: сообщение «схемы нет» без них не подсказывает ничего, а с ними
  // сразу видно «ожидались 201, 400 или 409, пришло 200».
  const expected = Object.keys(compiled[route]).map(Number);

  const validate = compiled[route][response.status];
  if (validate === undefined) {
    return { verdict: NO_SCHEMA, route, status: response.status, expected, errors: [] };
  }

  const ok = validate(response.body);
  return {
    verdict: ok ? VALID : INVALID,
    route,
    status: response.status,
    expected,
    errors: ok ? [] : validate.errors.map(describe),
  };
}
