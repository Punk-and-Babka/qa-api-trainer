// Режимы работы: сколько инструментов показывать.
//
// Смысл не в том, чтобы «убрать лишнее с экрана», а в лестнице: один и тот же
// сценарий проходится сначала руками, потом с проверкой контракта, потом с
// тестами — и разница в трудозатратах видна на себе. Поэтому режимы
// упорядочены и каждый следующий включает всё из предыдущего.
//
// Ни один режим не делает задание нерешаемым: все десять дефектов находятся
// глазами, инструменты только ускоряют и автоматизируют поиск.

export const MODES = [
  {
    id: 'manual',
    label: 'Ручной',
    note: 'спецификация, запросы и внимательность',
    tools: [],
  },
  {
    id: 'contract',
    label: 'Контрактный',
    note: 'плюс проверка ответа по JSON Schema',
    tools: ['schema'],
  },
  {
    id: 'auto',
    label: 'Автоматизация',
    note: 'плюс тесты на pm и переменные для цепочек',
    tools: ['schema', 'tests', 'variables'],
  },
];

export const DEFAULT_MODE = MODES[0].id;

// Инструмент задания (см. TASK_TOOLS) → инструмент режима, который для него
// нужен. Пустое значение означает «доступен всегда»: глазами работают в любом
// режиме. Цепочке запросов нужны переменные, поэтому она привязана к ним.
export const TASK_TOOL_NEEDS = {
  eye: null,
  schema: 'schema',
  tests: 'tests',
  chain: 'variables',
};

export function isToolEnabled(modeId, tool) {
  const mode = MODES.find((item) => item.id === modeId);
  // Неизвестный режим (например, из испорченного снимка) трактуется как
  // самый простой: показать лишнее хуже, чем показать меньше.
  if (mode === undefined) return false;

  return mode.tools.includes(tool);
}

// Режим из снимка localStorage может оказаться чужим или испорченным.
export function sanitizeMode(saved) {
  return MODES.some((mode) => mode.id === saved) ? saved : DEFAULT_MODE;
}

// Инвариант лестницы: каждый следующий режим обязан включать всё из
// предыдущего. Иначе переключение вперёд отбирало бы инструмент — поведение,
// которого никто не ждёт, а заметить его можно только вручную.
function assertLadder(modes) {
  for (let i = 1; i < modes.length; i += 1) {
    for (const tool of modes[i - 1].tools) {
      if (!modes[i].tools.includes(tool)) {
        throw new Error(
          `Режимы: "${modes[i].id}" не включает инструмент "${tool}" из ` +
            `предыдущего "${modes[i - 1].id}". Режимы обязаны быть лестницей.`,
        );
      }
    }
  }
}

assertLadder(MODES);
