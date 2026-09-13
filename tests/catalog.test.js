// Инварианты содержимого: каталог дефектов, задания, схемы и спецификация
// должны быть согласованы между собой.
//
// Эти проверки ловят не поломку кода, а рассогласование данных — то, что
// иначе проявляется как тихо неработающая функция: задание, которое нельзя
// закрыть, дефект, который нельзя зарепортить, эндпоинт без схемы.
//
// Все проверки идут по каждому сценарию из реестра, поэтому новый сценарий
// попадает под них автоматически, без правки этого файла.

import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS } from '../src/mock-api/scenarios/index.js';
import { TASK_TOOLS } from '../src/mock-api/task-tools.js';
import { BUG_TYPES } from '../src/mock-api/bug-types.js';
import { checkReport, endpointOptions } from '../src/bug-check.js';

test('каталог загружается: инвариант уникальности пар не нарушен', () => {
  for (const scenario of SCENARIOS) {
    // assertUniquePairs бросает прямо при импорте модуля, поэтому сам факт
    // того, что мы досюда дошли, уже проверка. Дублируем её явно, чтобы
    // падение читалось как «каталог», а не «не удалось импортировать тест».
    const seen = new Map();

    for (const bug of scenario.bugs) {
      for (const type of bug.types) {
        const key = `${bug.endpoint} + ${type}`;
        assert.equal(seen.get(key), undefined, `дубль пары "${key}"`);
        seen.set(key, bug.id);
      }
    }
  }
});

test('тип общего дефекта не принадлежит никому больше', () => {
  for (const scenario of SCENARIOS) {
    // Иначе выбор между общим и конкретным багом зависел бы от порядка
    // перебора — ровно та ошибка, из-за которой был введён тип format.
    for (const wide of scenario.bugs.filter((bug) => bug.endpoint === '*')) {
      for (const type of wide.types) {
        const clash = scenario.bugs.find((bug) => bug.id !== wide.id && bug.types.includes(type));
        assert.equal(clash, undefined, `тип "${type}" бага ${wide.id} занят и багом ${clash?.id}`);
      }
    }
  }
});

test('каждый тип дефекта из каталога есть в справочнике и описан', () => {
  for (const scenario of SCENARIOS) {
    const known = new Set(BUG_TYPES.map((type) => type.id));

    for (const bug of scenario.bugs) {
      assert.ok(bug.types.length > 0, `${bug.id}: не указан ни один тип`);
      for (const type of bug.types) {
        assert.ok(known.has(type), `${bug.id}: неизвестный тип "${type}"`);
      }
    }

    for (const type of BUG_TYPES) {
      // Описание типа показывается в справке формы баг-репорта: без него
      // выбрать правильный тип нельзя, а пустая строка выглядит как пропуск.
      assert.ok(type.note && type.note.length > 20, `тип ${type.id}: нет внятного описания`);
    }
  }
});

test('каждый дефект достижим через выпадающий список формы', () => {
  for (const scenario of SCENARIOS) {
    const options = endpointOptions(scenario.contract);

    for (const bug of scenario.bugs) {
      assert.ok(
        options.includes(bug.endpoint),
        `${bug.id}: эндпоинт "${bug.endpoint}" нельзя выбрать в форме`,
      );
    }
  }
});

test('у каждого дефекта есть заголовок и подсказка', () => {
  for (const scenario of SCENARIOS) {
    for (const bug of scenario.bugs) {
      assert.ok(bug.title?.length > 10, `${bug.id}: нет заголовка`);
      assert.ok(bug.hint?.length > 10, `${bug.id}: нет подсказки`);
    }
  }
});

test('задания ссылаются только на существующие дефекты и инструменты', () => {
  for (const scenario of SCENARIOS) {
    const known = new Set(scenario.bugs.map((bug) => bug.id));

    for (const task of scenario.tasks) {
      assert.ok(task.bugIds.length > 0, `${task.id}: задание ни к чему не ведёт`);
      for (const bugId of task.bugIds) {
        assert.ok(known.has(bugId), `${task.id}: ссылка на несуществующий баг ${bugId}`);
      }
      for (const tool of task.tools) {
        assert.ok(Object.hasOwn(TASK_TOOLS, tool), `${task.id}: неизвестный инструмент "${tool}"`);
      }
      assert.ok(task.detail?.length > 30, `${task.id}: слишком короткое описание`);
    }
  }
});

test('текст задания не обещает инструментов, которых может не быть на экране', () => {
  for (const scenario of SCENARIOS) {
    // В ручном режиме панели Tests, переменных и проверки по схеме скрыты.
    // Задание, которое называет их в тексте, в этом режиме читается как
    // указание нажать несуществующую кнопку.
    const forbidden = ['Проверить по схеме', 'pm.', '{{', 'панел'];

    for (const task of scenario.tasks) {
      for (const word of forbidden) {
        assert.ok(
          !task.detail.includes(word),
          `${task.id}: текст задания упоминает "${word}" — скажи об этом бейджем инструмента`,
        );
      }
    }
  }
});

test('задания покрывают все дефекты каталога', () => {
  for (const scenario of SCENARIOS) {
    // Не жёсткое требование архитектуры, а осознанное свойство содержимого:
    // сейчас пройти тренажёр можно целиком по заданиям. Если однажды часть
    // дефектов оставят на самостоятельный поиск, этот тест придётся изменить
    // осознанно, а не обнаружить пропажу задания случайно.
    const covered = new Set(scenario.tasks.flatMap((task) => task.bugIds));
    const missing = scenario.bugs.filter((bug) => !covered.has(bug.id)).map((bug) => bug.id);

    assert.deepEqual(missing, [], 'дефекты без задания');
  }
});

test('каждое задание ведёт к своим дефектам, а не дублирует чужие', () => {
  for (const scenario of SCENARIOS) {
    const seen = new Set();

    for (const task of scenario.tasks) {
      for (const bugId of task.bugIds) {
        assert.ok(!seen.has(bugId), `${bugId} встречается больше чем в одном задании`);
        seen.add(bugId);
      }
    }
  }
});

test('у каждого эндпоинта спецификации есть схемы на все обещанные статусы', () => {
  for (const scenario of SCENARIOS) {
    for (const endpoint of scenario.contract.endpoints) {
      const route = `${endpoint.method} ${endpoint.path}`;
      const schemas = scenario.schemas[route];

      assert.ok(schemas !== undefined, `нет схем для ${route}`);

      for (const response of endpoint.responses) {
        assert.ok(
          schemas[response.status] !== undefined,
          `${route}: спецификация обещает ${response.status}, схемы для него нет`,
        );
      }
    }
  }
});

test('схемы не описывают эндпоинтов, которых нет в спецификации', () => {
  for (const scenario of SCENARIOS) {
    const routes = new Set(
      scenario.contract.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`),
    );

    for (const route of Object.keys(scenario.schemas)) {
      assert.ok(routes.has(route), `схема для ${route}, которого нет в спецификации`);
    }
  }
});

// Регрессия на конкретную ошибку, найденную прохождением Orders (v0.5a).
//
// O1 (копейки в total отброшены) и O4 (промокод считается от каждой позиции)
// живут на одном эндпоинте и оба про арифметику. Пока оба описывались типом
// "расчёт", сверка засчитывала репорт про округление как дефект промокода:
// пары «эндпоинт + тип» оставались уникальными, поэтому инвариант уникальности
// молчал, а студент получал «зачтено» с чужой эталонной формулировкой.
//
// Проверка написана на конкретные идентификаторы намеренно: это не общий
// инвариант, а именно та пара дефектов, которую однажды уже перепутали.
test('арифметические дефекты Orders различимы по типу', () => {
  const orders = SCENARIOS.find((scenario) => scenario.id === 'orders');

  const byType = (type) =>
    checkReport({ endpoint: 'POST /orders', type, description: '' }, orders.bugs, []).bugId;

  assert.equal(byType('rounding'), 'O1', 'округление обязано опознаваться как O1');
  assert.equal(byType('calculation'), 'O4', 'неверная база скидки обязана опознаваться как O4');
});
