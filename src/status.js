// Расшифровки и цветовые группы HTTP-статусов.
//
// До v0.4.2 функция statusClass существовала в трёх копиях — в SpecPanel,
// ResponseViewer и HistoryList. Вынесена сюда, когда правка стилей всё равно
// затронула все три файла: три копии успели разойтись, 3xx нигде не
// учитывался и попадал в зелёную группу вместе с 2xx.

export const STATUS_TEXT = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

// Группа определяет цвет значка. Возвращается полный набор классов, чтобы в
// разметке осталось одно выражение и нельзя было забыть базовый класс.
export function statusClass(status) {
  if (status >= 500) return 'status status--5xx';
  if (status >= 400) return 'status status--4xx';
  if (status >= 300) return 'status status--3xx';
  if (status >= 200) return 'status status--2xx';
  return 'status status--1xx';
}
