// Сверка баг-репорта студента с каталогом вшитых дефектов.
//
// React здесь намеренно нет: это чистые функции над обычными массивами.
// Такую логику можно прогнать из Node одной строкой и позже покрыть тестами,
// не поднимая браузер и не рендеря компоненты.

export const ACCEPTED = 'accepted';
export const DUPLICATE = 'duplicate';
export const REJECTED = 'rejected';

// Баг опознаётся по паре «эндпоинт + тип дефекта». Уникальность этой пары —
// инвариант каталога, он проверяется в users.bugs.js при импорте модуля.
// Поэтому find() здесь заведомо возвращает не больше одного совпадения.
export function checkReport(report, bugs, foundIds) {
  const bug = bugs.find(
    (item) => item.endpoint === report.endpoint && item.type === report.type,
  );

  if (bug === undefined) {
    return { verdict: REJECTED, bugId: null };
  }
  if (foundIds.includes(bug.id)) {
    return { verdict: DUPLICATE, bugId: bug.id };
  }
  return { verdict: ACCEPTED, bugId: bug.id };
}

// Список эндпоинтов для выпадающего поля формы. Собирается из контракта, а не
// пишется руками: новый эндпоинт появляется в спеке и в форме одновременно.
// Пункт "*" добавляется отдельно — он не эндпоинт, а способ сообщить о дефекте,
// который виден во всех ответах сразу (такой в каталоге есть: B9, формат даты).
export function endpointOptions(contract) {
  const fromContract = contract.endpoints.map(
    (endpoint) => `${endpoint.method} ${endpoint.path}`,
  );
  return [...fromContract, '*'];
}

// Какие баги уже засчитаны. Производное значение: считается из ленты репортов
// при каждом рендере, отдельным состоянием не хранится — иначе появилось бы
// два источника правды, которые могут разъехаться.
export function foundBugIds(reports) {
  return reports
    .filter((report) => report.verdict === ACCEPTED)
    .map((report) => report.bugId);
}
