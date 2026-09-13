// Инварианты содержимого: каталог дефектов, задания, схемы и спецификация
// должны быть согласованы между собой.
//
// Эти проверки ловят не поломку кода, а рассогласование данных — то, что
// иначе проявляется как тихо неработающая функция: задание, которое нельзя
// закрыть, дефект, который нельзя зарепортить, эндпоинт без схемы.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bugs } from '../src/mock-api/scenarios/users.bugs.js';
import { usersTasks, TASK_TOOLS } from '../src/mock-api/scenarios/users.tasks.js';
import { usersContract } from '../src/mock-api/scenarios/users.contract.js';
import { responseSchemas } from '../src/mock-api/scenarios/users.schemas.js';
import { BUG_TYPES } from '../src/mock-api/bug-types.js';
import { endpointOptions } from '../src/bug-check.js';

test('каталог загружается: инвариант уникальности пар не нарушен', () => {
  // assertUniquePairs бросает прямо при импорте модуля, поэтому сам факт
  // того, что мы досюда дошли, уже проверка. Дублируем её явно, чтобы
  // падение читалось как «каталог», а не «не удалось импортировать тест».
  const seen = new Map();

  for (const bug of bugs) {
    for (const type of bug.types) {
      const key = `${bug.endpoint} + ${type}`;
      assert.equal(seen.get(key), undefined, `дубль пары "${key}"`);
      seen.set(key, bug.id);
    }
  }
});

test('тип общего дефекта не принадлежит никому больше', () => {
  // Иначе выбор между общим и конкретным багом зависел бы от порядка
  // перебора — ровно та ошибка, из-за которой был введён тип format.
  for (const wide of bugs.filter((bug) => bug.endpoint === '*')) {
    for (const type of wide.types) {
      const clash = bugs.find((bug) => bug.id !== wide.id && bug.types.includes(type));
      assert.equal(clash, undefined, `тип "${type}" бага ${wide.id} занят и багом ${clash?.id}`);
    }
  }
});

test('каждый тип дефекта из каталога есть в справочнике и описан', () => {
  const known = new Set(BUG_TYPES.map((type) => type.id));

  for (const bug of bugs) {
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
});

test('каждый дефект достижим через выпадающий список формы', () => {
  const options = endpointOptions(usersContract);

  for (const bug of bugs) {
    assert.ok(
      options.includes(bug.endpoint),
      `${bug.id}: эндпоинт "${bug.endpoint}" нельзя выбрать в форме`,
    );
  }
});

test('у каждого дефекта есть заголовок и подсказка', () => {
  for (const bug of bugs) {
    assert.ok(bug.title?.length > 10, `${bug.id}: нет заголовка`);
    assert.ok(bug.hint?.length > 10, `${bug.id}: нет подсказки`);
  }
});

test('задания ссылаются только на существующие дефекты и инструменты', () => {
  const known = new Set(bugs.map((bug) => bug.id));

  for (const task of usersTasks) {
    assert.ok(task.bugIds.length > 0, `${task.id}: задание ни к чему не ведёт`);
    for (const bugId of task.bugIds) {
      assert.ok(known.has(bugId), `${task.id}: ссылка на несуществующий баг ${bugId}`);
    }
    for (const tool of task.tools) {
      assert.ok(Object.hasOwn(TASK_TOOLS, tool), `${task.id}: неизвестный инструмент "${tool}"`);
    }
    assert.ok(task.detail?.length > 30, `${task.id}: слишком короткое описание`);
  }
});

test('текст задания не обещает инструментов, которых может не быть на экране', () => {
  // В ручном режиме панели Tests, переменных и проверки по схеме скрыты.
  // Задание, которое называет их в тексте, в этом режиме читается как
  // указание нажать несуществующую кнопку.
  const forbidden = ['Проверить по схеме', 'pm.', '{{', 'панел'];

  for (const task of usersTasks) {
    for (const word of forbidden) {
      assert.ok(
        !task.detail.includes(word),
        `${task.id}: текст задания упоминает "${word}" — скажи об этом бейджем инструмента`,
      );
    }
  }
});

test('задания покрывают все дефекты каталога', () => {
  // Не жёсткое требование архитектуры, а осознанное свойство содержимого:
  // сейчас пройти тренажёр можно целиком по заданиям. Если однажды часть
  // дефектов оставят на самостоятельный поиск, этот тест придётся изменить
  // осознанно, а не обнаружить пропажу задания случайно.
  const covered = new Set(usersTasks.flatMap((task) => task.bugIds));
  const missing = bugs.filter((bug) => !covered.has(bug.id)).map((bug) => bug.id);

  assert.deepEqual(missing, [], 'дефекты без задания');
});

test('каждое задание ведёт к своим дефектам, а не дублирует чужие', () => {
  const seen = new Set();

  for (const task of usersTasks) {
    for (const bugId of task.bugIds) {
      assert.ok(!seen.has(bugId), `${bugId} встречается больше чем в одном задании`);
      seen.add(bugId);
    }
  }
});

test('у каждого эндпоинта спецификации есть схемы на все обещанные статусы', () => {
  for (const endpoint of usersContract.endpoints) {
    const route = `${endpoint.method} ${endpoint.path}`;
    const schemas = responseSchemas[route];

    assert.ok(schemas !== undefined, `нет схем для ${route}`);

    for (const response of endpoint.responses) {
      assert.ok(
        schemas[response.status] !== undefined,
        `${route}: спецификация обещает ${response.status}, схемы для него нет`,
      );
    }
  }
});

test('схемы не описывают эндпоинтов, которых нет в спецификации', () => {
  const routes = new Set(
    usersContract.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`),
  );

  for (const route of Object.keys(responseSchemas)) {
    assert.ok(routes.has(route), `схема для ${route}, которого нет в спецификации`);
  }
});
