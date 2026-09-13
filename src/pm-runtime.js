// Исполнение тестового скрипта студента и объект `pm`, доступный внутри.
//
// Это упрощённая версия того, что даёт Postman. Совпадает главное: скрипт —
// настоящий JavaScript, тесты объявляются через pm.test(имя, функция), тест
// считается упавшим, если функция бросила исключение. Именно так работают и
// chai-проверки в настоящем Postman: expect не возвращает false, он кидает.

import { expect } from './expect.js';
import { validateAgainst } from './schema-check.js';

// Заголовки в ответе mock-сервера — обычный объект. Postman отдаёт их
// объектом с методом get(), и скрипты обычно пишут именно pm.response.headers.
function createHeaders(headers) {
  return {
    ...headers,
    get: (name) => {
      const key = Object.keys(headers).find(
        (item) => item.toLowerCase() === String(name).toLowerCase(),
      );
      return key === undefined ? undefined : headers[key];
    },
  };
}

function createResponse(response) {
  const api = {
    code: response.status,
    responseTime: response.time,
    headers: createHeaders(response.headers),

    // Тело mock-сервера уже разобрано — парсить нечего. Postman на пустом теле
    // бросает исключение; здесь возвращается null, чтобы студент мог написать
    // pm.expect(pm.response.json()).to.be.null и проверить именно это.
    json: () => response.body,
    text: () => (response.body === null ? '' : JSON.stringify(response.body)),
  };

  // Форма pm.response.to.have.status(201) — та же, что в Postman. Внутри это
  // обычные функции, бросающие исключение: отдельного механизма у тестов нет.
  api.to = {
    have: {
      status: (code) => {
        if (response.status !== code) {
          throw new Error(`получен статус ${response.status}, ожидался ${code}`);
        }
      },
      header: (name) => {
        if (api.headers.get(name) === undefined) {
          throw new Error(`в ответе нет заголовка "${name}"`);
        }
      },
      jsonSchema: (schema) => {
        const { ok, errors } = validateAgainst(schema, response.body);
        if (!ok) {
          const text = errors.map((item) => `${item.path} ${item.message}`).join('; ');
          throw new Error(`тело не соответствует схеме: ${text}`);
        }
      },
    },
  };

  return api;
}

export function runTests(script, response) {
  const tests = [];

  const pm = {
    response: createResponse(response),
    expect,
    // Тест не прерывает остальные: упавший записывается и выполнение идёт
    // дальше. В Postman точно так же — иначе первый же провал скрыл бы
    // остальные результаты.
    test: (name, fn) => {
      try {
        fn();
        tests.push({ name: String(name), passed: true, message: null });
      } catch (error) {
        tests.push({ name: String(name), passed: false, message: error.message });
      }
    },
  };

  try {
    // new Function компилирует строку в функцию с единственным аргументом pm.
    // Синтаксическая ошибка вылетит уже здесь, на конструкторе, а не при
    // вызове — поэтому конструирование и вызов стоят внутри одного try.
    // 'use strict' добавлен, чтобы забытый var не создавал глобальную
    // переменную и опечатка ловилась ошибкой.
    const compiled = new Function('pm', `'use strict';\n${script}`);
    compiled(pm);
  } catch (error) {
    // Скрипт упал целиком: синтаксическая ошибка или исключение вне pm.test.
    // Тесты, успевшие отработать до падения, сохраняются — они уже результат.
    return { error: `${error.name}: ${error.message}`, tests };
  }

  return { error: null, tests };
}
