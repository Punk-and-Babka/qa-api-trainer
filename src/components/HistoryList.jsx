// История отправленных запросов. Каждый элемент — кнопка: клик возвращает
// запрос в конструктор. Своего состояния компонент не имеет, список приходит
// сверху готовым.

// Дубликат такой же функции из ResponseViewer.jsx и SpecPanel.jsx — третья
// копия. Просится вынести в общий модуль, но это правка работающих файлов.
function statusClass(status) {
  if (status >= 500) return 'status status--5xx';
  if (status >= 400) return 'status status--4xx';
  return 'status status--2xx';
}

export default function HistoryList({ entries, onPick }) {
  if (entries.length === 0) {
    return <p className="placeholder">Пока пусто. Отправь первый запрос.</p>;
  }

  return (
    <ul className="history">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button className="history__item" type="button" onClick={() => onPick(entry)}>
            <span className={`method method--${entry.method.toLowerCase()}`}>
              {entry.method}
            </span>
            <span className="history__path">{entry.path}</span>
            <span className={statusClass(entry.status)}>{entry.status}</span>
            <span className="history__time">{entry.time} мс</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
