// Русские числительные: три формы, и выбор зависит от двух последних цифр,
// а не только от последней — «21 запрос», но «11 запросов».
//
// Формы передаются массивом в порядке: 1, 2, 5.
export function plural(count, forms) {
  const tens = count % 100;
  const ones = count % 10;

  if (tens >= 11 && tens <= 14) return forms[2];
  if (ones === 1) return forms[0];
  if (ones >= 2 && ones <= 4) return forms[1];
  return forms[2];
}
