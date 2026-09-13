// Переменные окружения и подстановка {{имя}} — как в Postman.
//
// Хранятся списком записей {id, name, value}, а не объектом: в объекте
// переименование ключа во время набора создавало бы по новому ключу на каждую
// букву, а порядок строк в таблице был бы неуправляем. Объект получается из
// списка на лету, когда нужен быстрый поиск по имени.
//
// id нужен как React key: строки таблицы удаляются из середины, и key по
// индексу заставил бы React считать, что изменились все строки ниже.
// Счётчика в useRef здесь нет намеренно — id выдаётся из самого списка чистой
// функцией, поэтому её можно звать откуда угодно, в том числе изнутри
// функции обновления состояния, которая обязана оставаться чистой.

// Имя: буквы, цифры, подчёркивание, дефис и точка. Пробелы вокруг имени
// внутри скобок допускаются — {{ userId }} встречается в чужих коллекциях.
const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;

// Первый свободный id: на единицу больше наибольшего занятого.
export function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

export function toObject(list) {
  const values = {};
  for (const item of list) {
    // Пустые имена игнорируются: пустая строка появляется в только что
    // добавленной строке таблицы, пока её не заполнили.
    if (item.name.trim() === '') continue;
    values[item.name.trim()] = item.value;
  }
  return values;
}

// Подстановка. Неизвестная переменная остаётся в тексте как есть — так же
// поступает Postman: запрос уходит с литеральным {{token}} и сервер отвечает
// ошибкой. Это честнее, чем молча подставить пустую строку, и полезнее, чем
// запретить отправку: увидеть в ответе своё же {{token}} — понятный урок.
// Список ненайденных имён возвращается отдельно, чтобы UI предупредил заранее.
export function applyVariables(text, values) {
  const unknown = [];

  const result = text.replace(PLACEHOLDER, (match, name) => {
    if (!Object.hasOwn(values, name)) {
      unknown.push(name);
      return match;
    }
    return String(values[name]);
  });

  return { text: result, unknown: [...new Set(unknown)] };
}

// Слияние изменений, сделанных скриптом (pm.environment.set), обратно в список.
// Существующие строки правятся на месте, чтобы не прыгал порядок в таблице;
// новые дописываются в конец. Удалённые скриптом (unset) исчезают.
export function mergeVariables(list, values) {
  const seen = new Set();
  let free = nextId(list);

  const updated = [];
  for (const item of list) {
    const name = item.name.trim();
    if (name === '') {
      // Незаполненная строка таблицы — пользовательский черновик, скрипт про
      // неё ничего не знает, поэтому она сохраняется как есть.
      updated.push(item);
      continue;
    }
    if (!Object.hasOwn(values, name)) continue;

    seen.add(name);
    updated.push({ ...item, value: values[name] });
  }

  for (const [name, value] of Object.entries(values)) {
    if (!seen.has(name)) {
      updated.push({ id: free, name, value });
      free += 1;
    }
  }

  return updated;
}
