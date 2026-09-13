// Ширины колонок: доли, проверка сохранённого значения и пересчёт при
// перетаскивании разделителя.
//
// Здесь нет ни React, ни DOM: на входе числа, на выходе числа. Единственное,
// что нужно от браузера, — фактическая ширина сетки в пикселях, и она
// передаётся аргументом.

// Доли по умолчанию. Спека шире остальных: в ней сплошной текст, который
// читают, а не поля, которые заполняют.
export const DEFAULT_COLUMNS = [1.3, 1, 1.2];

// Ширина разделителя и минимальная ширина колонки в пикселях. Уже двухсот
// пикселей панель бесполезна: конструктор запроса перестаёт помещаться.
export const SPLITTER_PX = 6;
export const MIN_COLUMN_PX = 200;

// Снимок приходит из localStorage, который можно испортить руками или оставить
// от прежней версии. Кривые доли сделали бы раскладку неработающей, а починить
// её через интерфейс было бы уже нельзя — поэтому значения проверяются, а не
// берутся на веру.
export function sanitizeColumns(saved) {
  const ok =
    Array.isArray(saved) &&
    saved.length === DEFAULT_COLUMNS.length &&
    saved.every((value) => Number.isFinite(value) && value >= 0.1);

  return ok ? saved : DEFAULT_COLUMNS;
}

// Перетаскивание разделителя с номером index двигает границу между колонками
// index и index+1. Соседние колонки обмениваются шириной, сумма долей не
// меняется — иначе поехала бы вся сетка.
//
// Возвращает null, когда двигать некуда: колонка упёрлась в минимум. Null, а
// не прежний массив, чтобы вызывающий код не перерисовывал состояние зря.
export function resizeColumns(columns, index, deltaPx, gridWidthPx) {
  const totalFr = columns.reduce((sum, value) => sum + value, 0);
  const totalPx = gridWidthPx - SPLITTER_PX * (columns.length - 1);
  if (totalPx <= 0) return null;

  const pxPerFr = totalPx / totalFr;
  const leftPx = columns[index] * pxPerFr + deltaPx;
  const rightPx = columns[index + 1] * pxPerFr - deltaPx;

  if (leftPx < MIN_COLUMN_PX || rightPx < MIN_COLUMN_PX) return null;

  const next = [...columns];
  next[index] = leftPx / pxPerFr;
  next[index + 1] = rightPx / pxPerFr;
  return next;
}
