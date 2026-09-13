// Режимы: лестница инструментов и её согласованность с заданиями.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MODE,
  MODES,
  TASK_TOOL_NEEDS,
  isToolEnabled,
  sanitizeMode,
} from '../src/modes.js';
import { TASK_TOOLS, usersTasks } from '../src/mock-api/scenarios/users.tasks.js';

test('каждый следующий режим включает всё из предыдущего', () => {
  // Инвариант лестницы: переключение вперёд не должно отбирать инструмент.
  // В самом модуле он проверяется при импорте, здесь — явно, чтобы падение
  // читалось как «режимы», а не как «не удалось импортировать».
  for (let i = 1; i < MODES.length; i += 1) {
    for (const tool of MODES[i - 1].tools) {
      assert.ok(
        MODES[i].tools.includes(tool),
        `${MODES[i].id} потерял инструмент "${tool}"`,
      );
    }
  }
});

test('в ручном режиме инструментов нет, в автоматизации есть все', () => {
  assert.deepEqual(MODES[0].tools, []);
  assert.deepEqual(MODES.at(-1).tools, ['schema', 'tests', 'variables']);
});

test('по умолчанию включён первый режим лестницы', () => {
  assert.equal(DEFAULT_MODE, MODES[0].id);
});

test('isToolEnabled отвечает по текущему режиму', () => {
  assert.equal(isToolEnabled('manual', 'schema'), false);
  assert.equal(isToolEnabled('contract', 'schema'), true);
  assert.equal(isToolEnabled('contract', 'tests'), false);
  assert.equal(isToolEnabled('auto', 'tests'), true);
  assert.equal(isToolEnabled('auto', 'variables'), true);
});

test('неизвестный режим не открывает инструменты', () => {
  // Показать лишнее хуже, чем показать меньше: чужое или испорченное значение
  // не должно случайно включать панели.
  assert.equal(isToolEnabled('чужое', 'tests'), false);
  assert.equal(isToolEnabled(undefined, 'schema'), false);
});

test('испорченный сохранённый режим откатывается к умолчанию', () => {
  for (const broken of [undefined, null, '', 'auto2', 42, {}]) {
    assert.equal(sanitizeMode(broken), DEFAULT_MODE, `не отфильтровано: ${String(broken)}`);
  }
});

test('корректный сохранённый режим сохраняется', () => {
  for (const mode of MODES) {
    assert.equal(sanitizeMode(mode.id), mode.id);
  }
});

test('у каждого режима есть подпись и пояснение', () => {
  const ids = new Set();

  for (const mode of MODES) {
    assert.ok(mode.label?.length > 2, `${mode.id}: нет подписи`);
    assert.ok(mode.note?.length > 10, `${mode.id}: нет пояснения`);
    assert.ok(!ids.has(mode.id), `дубль режима ${mode.id}`);
    ids.add(mode.id);
  }
});

test('каждый инструмент задания знает, какой режим ему нужен', () => {
  // Иначе бейдж задания показывался бы в режиме, где инструмента нет.
  for (const tool of Object.keys(TASK_TOOLS)) {
    assert.ok(
      Object.hasOwn(TASK_TOOL_NEEDS, tool),
      `инструмент "${tool}" не сопоставлен ни с одним режимом`,
    );
  }
});

test('требования заданий покрываются самым полным режимом', () => {
  const full = MODES.at(-1).id;

  for (const task of usersTasks) {
    for (const tool of task.tools) {
      const needs = TASK_TOOL_NEEDS[tool];
      assert.ok(
        needs === null || isToolEnabled(full, needs),
        `${task.id}: инструмент "${tool}" недоступен даже в режиме "${full}"`,
      );
    }
  }
});

test('в ручном режиме у каждого задания остаётся хотя бы способ «глазами»', () => {
  // Ни один режим не должен делать задание нерешаемым.
  for (const task of usersTasks) {
    const available = task.tools.filter((tool) => {
      const needs = TASK_TOOL_NEEDS[tool];
      return needs === null || isToolEnabled('manual', needs);
    });

    assert.ok(
      available.length > 0 || TASK_TOOL_NEEDS.eye === null,
      `${task.id}: в ручном режиме нечем решать`,
    );
  }
});
