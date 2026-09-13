// Сохранение состояния тренажёра между перезагрузками страницы.
//
// Три причины, по которым здесь всё обёрнуто в try/catch, хотя выглядит это
// избыточно:
//   1. Обращение к localStorage может бросить исключение само по себе —
//      в приватном режиме Safari и при запрете хранилища в настройках.
//      Не «вернуть null», а именно бросить, ещё на чтении свойства.
//   2. В хранилище может лежать испорченный или чужой текст: JSON.parse
//      бросит SyntaxError, и приложение не запустится вообще.
//   3. setItem бросает при переполнении квоты.
// Ни один из этих случаев не повод ронять тренажёр: не сохранилось — значит
// работаем без сохранения.

const KEY = 'qa-api-trainer';

// Версия формата снимка. Меняется, когда меняется набор полей. Снимок другой
// версии не читается, а игнорируется: это надёжнее, чем пытаться угадать,
// какие поля в старых данных ещё годятся. Цена — потерянный прогресс, но
// только в тот раз, когда формат поменялся.
const VERSION = 1;

// Серверный рендеринг (им проверяются компоненты) выполняется в Node, где
// window нет вовсе. Без этой проверки модуль падал бы на импорте.
function available() {
  return typeof window !== 'undefined' && window.localStorage !== undefined;
}

export function load() {
  if (!available()) return null;

  let raw;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.version === VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function save(snapshot) {
  if (!available()) return;

  try {
    window.localStorage.setItem(KEY, JSON.stringify({ version: VERSION, ...snapshot }));
  } catch {
    // Молча: пользователю нечего с этим делать, а работу продолжать можно.
  }
}

export function clear() {
  if (!available()) return;

  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // См. выше.
  }
}
