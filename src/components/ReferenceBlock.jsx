// Справка по разделу: группы строк «что написать → что произойдёт».
// Содержимое приходит данными из src/reference.js, компонент только рисует.

export default function ReferenceBlock({ groups }) {
  return (
    <div className="reference">
      {groups.map((group) => (
        <div key={group.title} className="reference__group">
          <h4 className="reference__title">{group.title}</h4>
          <dl className="reference__rows">
            {group.rows.map((row) => (
              // dl/dt/dd, а не таблица: это словарь терминов, и разметка
              // должна об этом говорить. Экранному диктору так понятнее.
              <div key={row.code} className="reference__row">
                <dt className="reference__code">{row.code}</dt>
                <dd className="reference__note">{row.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
