// Генератор ключей к заданиям: по файлу на сценарий, answers-<id>.txt в корне.
//
//   npm run answers
//
// Заголовки, типы и подсказки берутся из каталогов дефектов, привязка к
// заданиям — из файлов заданий. Руками здесь дописаны только способ
// воспроизведения и то, как дефект обнаруживается: этого в данных нет.
//
// Сами файлы в репозиторий не попадают — они перечислены в .gitignore. Сам
// генератор попадает, и это осознанно: каталог дефектов и так лежит в
// открытых исходниках, а восстанавливать этот скрипт заново при каждой
// правке каталога — та же работа в третий раз.

import { writeFileSync } from 'node:fs';
import { SCENARIOS } from '../src/mock-api/scenarios/index.js';
import { BUG_TYPES } from '../src/mock-api/bug-types.js';

// Как дефект воспроизвести и чем он обнаруживается. Ключ — идентификатор
// дефекта; при добавлении нового сюда нужно дописать пару строк, иначе в
// ключе появится прочерк и генератор об этом скажет.
const NOTES = {
  B1: {
    repro: 'POST /users  {"email": "new@example.io", "name": "Новый"}',
    detect: 'глазами; схема скажет «статус 200 не описан, ожидались 201, 400, 409»',
  },
  B2: {
    repro: 'POST /users  {"email": "abc", "name": "Тест"}',
    detect: 'глазами: ожидался 400, а пришёл созданный пользователь',
  },
  B3: {
    repro: 'POST /users  {"email": "new@example.io", "name": "Новый"}',
    detect: 'глазами по набору полей либо тестом to.not.have.property("passwordHash")',
  },
  B4: {
    repro: 'GET /users → DELETE /users/2 → GET /users',
    detect: 'total остался 100 при меньшем числе элементов',
  },
  B5: {
    repro: 'GET /users?limit=0, для сравнения GET /users?limit=101',
    detect: 'только глазами: 101 даёт 400, а 0 отдаёт весь список',
  },
  B6: {
    repro: 'PUT /users/1 {"name": "Новое имя"} → затем GET /users/1',
    detect: 'сравнением двух ответов; автоматически — цепочкой через переменную',
  },
  B7: {
    repro: 'DELETE /users/3',
    detect: 'схема: «статус 200 не описан, ожидались 204, 404»',
  },
  B8: {
    repro: 'GET /users/99999',
    detect: 'схема: / must be object',
  },
  B9: {
    repro: 'любой ответ, например GET /users/1',
    detect: 'схема: /createdAt must match format "date-time"',
  },
  B10: {
    repro: 'GET /users, сравнить элемент списка с ответом GET /users/1',
    detect: 'схема: /items/0 must have required property "role"',
  },

  O1: {
    repro: 'POST /orders  {"customer":"a@b.io","items":[{"sku":"HD-03","qty":3}]}',
    detect: 'посчитать 349.99 × 3 = 1049.97 и сравнить с total = 1049',
  },
  O2: {
    repro: 'PATCH /orders/:id {"status":"cancelled"} → POST /orders/:id/pay',
    detect: 'оплата отменённого проходит: 200 и статус paid вместо 409',
  },
  O3: {
    repro: 'POST /orders/:id/pay дважды подряд по одному заказу',
    detect: 'paidAmount удваивается, второй раз обязан быть 409',
  },
  O4: {
    repro: 'POST /orders с promo SALE10: сначала из одной позиции, потом из трёх',
    detect: 'на одной позиции скидка 10%, на трёх — 30% от суммы',
  },
  O5: {
    repro: 'GET /orders?limit=2&page=1, затем page=2, затем page=3',
    detect: 'последняя запись страницы повторяется первой на следующей',
  },
  O6: {
    repro: 'GET /orders',
    detect: 'даты идут не по убыванию: порядок по id, а не по createdAt',
  },
  O7: {
    repro: 'POST /orders с comment на русском языке',
    detect: 'кириллица возвращается знаками вопроса, латиница проходит целой',
  },
  O8: {
    repro: 'POST /orders/1001/pay → PATCH /orders/1001 {"status":"new"}',
    detect: 'переход paid → new проходит вместо 409; из shipped корректно запрещён',
  },
  O9: {
    repro: 'POST /orders с qty = 0, затем с qty = -1',
    detect: 'оба принимаются: 201, сумма нулевая либо уменьшенная',
  },
  O10: {
    repro: 'GET /orders',
    detect: 'в списке активных есть заказ 1003 со статусом cancelled, он же в total',
  },
};

// Что в сценарии работает правильно. Важно не меньше самих дефектов: если
// сломано всё, тренажёр теряет смысл — дефект виден на фоне исправного.
const CORRECT = {
  users: [
    'limit=101 → 400 (верхняя граница проверяется, нижняя — нет, это B5)',
    'нет обязательного поля → 400',
    'дубликат email → 409',
    'PUT и DELETE по несуществующему id → 404',
  ],
  orders: [
    'limit=51 → 400, page=0 → 400',
    'пустой список позиций → 400, неизвестный sku → 404',
    'неизвестный промокод → 400, неизвестный статус → 400',
    'new → shipped → 409, оплата отправленного заказа → 409',
    'запрос несуществующего заказа → 404',
  ],
};

const typeLabel = (id) => BUG_TYPES.find((type) => type.id === id)?.label ?? id;
const rule = (char = '=') => char.repeat(78);

function render(scenario) {
  const out = [];
  const missing = [];

  out.push(rule());
  out.push(`КЛЮЧ К ЗАДАНИЯМ — ${scenario.title.toUpperCase()}`);
  out.push(rule());
  out.push('');
  out.push(scenario.summary);
  out.push('');
  out.push(`Дефектов: ${scenario.bugs.length}. Заданий: ${scenario.tasks.length}.`);
  out.push('');
  out.push('Файл только для локального пользования: он в .gitignore и в репозиторий');
  out.push('не уходит. Открывать имеет смысл после самостоятельной попытки — иначе');
  out.push('тренажёр теряет смысл.');
  out.push('');
  out.push('Сгенерирован командой npm run answers.');
  out.push('');

  for (const bug of scenario.bugs) {
    const task = scenario.tasks.find((item) => item.bugIds.includes(bug.id));
    const notes = NOTES[bug.id];
    if (notes === undefined) missing.push(bug.id);

    out.push(rule('-'));
    out.push(`${bug.id}. ${bug.title}`);
    out.push(rule('-'));
    out.push(`  Эндпоинт:  ${bug.endpoint}${bug.endpoint === '*' ? '  (во всех ответах)' : ''}`);
    out.push(`  Тип:       ${bug.types.map(typeLabel).join('  |  ')}   [${bug.types.join(', ')}]`);
    out.push('');
    out.push('  Воспроизведение:');
    out.push(`    ${notes?.repro ?? '— не описано, дополни NOTES в scripts/make-answers.mjs'}`);
    out.push('');
    out.push('  Как обнаруживается:');
    out.push(`    ${notes?.detect ?? '— не описано'}`);
    out.push('');
    out.push('  Подсказка в интерфейсе:');
    out.push(`    ${bug.hint}`);
    if (task !== undefined) {
      out.push('');
      out.push(`  Задание: ${task.id}. ${task.title}  (${task.bugIds.join(', ')})`);
    }
    out.push('');
  }

  out.push(rule());
  out.push('ЧТО НАМЕРЕННО НЕ СЛОМАНО');
  out.push(rule());
  out.push('');
  for (const item of CORRECT[scenario.id] ?? ['— не описано']) {
    out.push(`  ${item}`);
  }
  out.push('');

  return { text: out.join('\r\n'), missing };
}

for (const scenario of SCENARIOS) {
  const { text, missing } = render(scenario);
  const file = `answers-${scenario.id}.txt`;

  // BOM: файл открывают Блокнотом, а он на старых сборках Windows читает
  // UTF-8 без BOM как ANSI и показывает кракозябры.
  writeFileSync(file, `﻿${text}`, 'utf8');

  const note = missing.length > 0 ? `  ВНИМАНИЕ: без описания ${missing.join(', ')}` : '';
  console.log(`${file}: ${scenario.bugs.length} дефектов${note}`);
}
