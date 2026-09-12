// Подсветка JSON без внешних зависимостей. Компонент рекурсивный: он рисует
// значение, а для вложенных значений вызывает сам себя с увеличенным уровнем
// отступа. Переносы строк вставляются как обычный текст и видны потому, что
// контейнер имеет white-space: pre.

const INDENT = '  ';

function JsonValue({ value, level }) {
  const pad = INDENT.repeat(level);
  const padInner = INDENT.repeat(level + 1);

  if (value === null) {
    return <span className="json__null">null</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="json__punct">[]</span>;
    }
    return (
      <>
        <span className="json__punct">[</span>
        {value.map((item, index) => (
          // Индекс как key здесь допустим: список статичный, состояния внутри
          // элементов нет, перестановок не бывает — весь блок перерисовывается
          // целиком при каждом новом ответе.
          <span key={index}>
            {`\n${padInner}`}
            <JsonValue value={item} level={level + 1} />
            {index < value.length - 1 ? <span className="json__punct">,</span> : null}
          </span>
        ))}
        {`\n${pad}`}
        <span className="json__punct">]</span>
      </>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="json__punct">{'{}'}</span>;
    }
    return (
      <>
        <span className="json__punct">{'{'}</span>
        {entries.map(([key, item], index) => (
          <span key={key}>
            {`\n${padInner}`}
            <span className="json__key">"{key}"</span>
            <span className="json__punct">: </span>
            <JsonValue value={item} level={level + 1} />
            {index < entries.length - 1 ? <span className="json__punct">,</span> : null}
          </span>
        ))}
        {`\n${pad}`}
        <span className="json__punct">{'}'}</span>
      </>
    );
  }

  if (typeof value === 'string') {
    return <span className="json__string">"{value}"</span>;
  }

  if (typeof value === 'number') {
    return <span className="json__number">{String(value)}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="json__bool">{String(value)}</span>;
  }

  // undefined и всё прочее, чего в JSON быть не должно.
  return <span className="json__null">{String(value)}</span>;
}

export default function JsonView({ value }) {
  return (
    <pre className="json">
      <JsonValue value={value} level={0} />
    </pre>
  );
}
