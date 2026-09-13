// Редактор тестового скрипта. Как и конструктор запроса, своего состояния не
// имеет: текст живёт в App, потому что тесты прогоняются автоматически при
// получении ответа — то есть из кода, который лежит там же.

export default function TestsEditor({ script, canRun, onChange, onRun }) {
  return (
    <div className="tests">
      <textarea
        className="tests__editor"
        value={script}
        spellCheck={false}
        rows={10}
        onChange={(event) => onChange(event.target.value)}
      />

      <div className="tests__actions">
        <button className="tests__run" type="button" disabled={!canRun} onClick={onRun}>
          Прогнать тесты
        </button>
        <span className="tests__note">
          {canRun
            ? 'прогоняются сами после каждого ответа'
            : 'нужен ответ — отправь запрос'}
        </span>
      </div>
    </div>
  );
}
