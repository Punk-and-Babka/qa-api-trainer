// Сворачиваемый раздел панели. Заголовок здесь — кнопка целиком: попасть в
// маленькую стрелку мышью труднее, чем в строку, а лишней разметки это не
// стоит.
//
// Своего состояния нет: открытость приходит сверху, потому что она
// сохраняется в снимке localStorage вместе с остальным.

export default function Section({ title, summary, lead, open, onToggle, children }) {
  return (
    <>
      <h2 className="panel__title panel__title--spaced section__head">
        <button
          className="section__toggle"
          type="button"
          aria-expanded={open}
          onClick={onToggle}
        >
          <span className="section__caret">{open ? '▾' : '▸'}</span>
          {title}
        </button>
        {/* Сводка видна и в свёрнутом виде — иначе, свернув задания, студент
            теряет из виду прогресс, ради которого их и открывал. */}
        {summary ? <span className="section__summary">{summary}</span> : null}
      </h2>

      {open ? (
        <>
          {lead ? <p className="panel__lead">{lead}</p> : null}
          {children}
        </>
      ) : null}
    </>
  );
}
