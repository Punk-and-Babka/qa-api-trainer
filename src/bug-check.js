// Сверка баг-репорта студента с каталогом вшитых дефектов.
//
// React здесь намеренно нет: это чистые функции над обычными массивами.
// Такую логику можно прогнать из Node одной строкой и позже покрыть тестами,
// не поднимая браузер и не рендеря компоненты.

export const ACCEPTED = 'accepted';
export const DUPLICATE = 'duplicate';
export const REJECTED = 'rejected';

// Баг опознаётся по паре «эндпоинт + тип дефекта». Уникальность этой пары —
// инвариант каталога, он проверяется в users.bugs.js при импорте модуля,
// поэтому find() заведомо возвращает не больше одного совпадения.
//
// Сначала ищется точное совпадение по эндпоинту, и только потом — баг с
// эндпоинтом «*». Порядок важен: «*» означает «во всех ответах», и если бы он
// проверялся первым, то перехватывал бы репорты по конкретным эндпоинтам.
// Сам поиск по «*» нужен потому, что общий дефект студент видит в ответе
// конкретного запроса и логично репортит именно туда.
export function checkReport(report, bugs, foundIds) {
  const exact = bugs.find(
    (item) => item.endpoint === report.endpoint && item.types.includes(report.type),
  );
  const wide = bugs.find(
    (item) => item.endpoint === '*' && item.types.includes(report.type),
  );
  const bug = exact ?? wide;

  if (bug === undefined) {
    // Промах рядом: на этом эндпоинте ненайденный дефект есть, но тип выбран
    // не тот. Сообщить об этом честнее, чем сухое «не совпало» — иначе
    // студент решит, что ошибся в самом наблюдении, и перестанет копать там,
    // где копал правильно. Какой именно тип, не называется.
    const nearMiss = bugs.some(
      (item) => item.endpoint === report.endpoint && !foundIds.includes(item.id),
    );
    return { verdict: REJECTED, bugId: null, nearMiss };
  }
  if (foundIds.includes(bug.id)) {
    return { verdict: DUPLICATE, bugId: bug.id, nearMiss: false };
  }
  return { verdict: ACCEPTED, bugId: bug.id, nearMiss: false };
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
