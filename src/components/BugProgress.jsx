import { ACCEPTED, DUPLICATE } from '../bug-check.js';

// Прогресс поиска: счётчик, список засчитанных багов, подсказки и лента
// отправленных репортов. Своего состояния нет — всё приходит сверху.

const VERDICT_TEXT = {
  [ACCEPTED]: { label: 'засчитан', modifier: 'ok' },
  [DUPLICATE]: { label: 'уже найден', modifier: 'dup' },
};

// Тип дефекта хранится в репорте идентификатором ('status-code'), а показывать
// нужно человеческую подпись из справочника.
function typeLabel(types, id) {
  const found = types.find((item) => item.id === id);
  return found === undefined ? id : found.label;
}

export default function BugProgress({
  bugs,
  types,
  reports,
  foundIds,
  revealedHints,
  onRevealHint,
}) {
  const foundBugs = bugs.filter((bug) => foundIds.includes(bug.id));
  const hints = bugs.filter((bug) => revealedHints.includes(bug.id));
  // Подсказка есть смысл только пока остались не найденные баги без подсказки.
  const hasHintLeft = bugs.some(
    (bug) => !foundIds.includes(bug.id) && !revealedHints.includes(bug.id),
  );

  return (
    <div className="progress">
      <div className="progress__bar">
        <div
          className="progress__fill"
          style={{ width: `${(foundIds.length / bugs.length) * 100}%` }}
        />
      </div>

      {foundBugs.length === 0 ? (
        <p className="placeholder">Пока ничего не засчитано.</p>
      ) : (
        <ul className="found">
          {foundBugs.map((bug) => (
            <li key={bug.id} className="found__item">
              <span className="found__id">{bug.id}</span>
              <span className="found__endpoint">{bug.endpoint}</span>
              <span className="found__title">{bug.title}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="hints">
        <button
          className="hints__button"
          type="button"
          disabled={!hasHintLeft}
          onClick={onRevealHint}
        >
          Показать подсказку
        </button>
        <span className="hints__note">
          {revealedHints.length === 0
            ? 'подсказок не открыто'
            : `открыто подсказок: ${revealedHints.length}`}
        </span>
      </div>

      {hints.length > 0 ? (
        <ul className="hints__list">
          {hints.map((bug) => (
            <li key={bug.id} className="hints__item">
              {bug.hint}
            </li>
          ))}
        </ul>
      ) : null}

      <h2 className="panel__title panel__title--spaced">Мои репорты</h2>

      {reports.length === 0 ? (
        <p className="placeholder">Репортов ещё нет.</p>
      ) : (
        <ul className="reports">
          {reports.map((report) => {
            const verdict = VERDICT_TEXT[report.verdict];

            return (
              <li key={report.id} className="reports__item">
                <div className="reports__head">
                  <span className="reports__endpoint">{report.endpoint}</span>
                  <span className="reports__type">
                    {typeLabel(types, report.type)}
                  </span>
                  <span
                    className={`verdict verdict--${
                      verdict === undefined ? 'no' : verdict.modifier
                    }`}
                  >
                    {verdict === undefined ? 'не совпало' : verdict.label}
                  </span>
                </div>

                <p className="reports__description">{report.description}</p>

                {/* При совпадении показывается эталонная формулировка: студент
                    сравнивает её со своей и учится описывать дефект точнее. */}
                {report.bugId === null ? (
                  <p className="reports__note">
                    {report.nearMiss
                      ? 'На этом эндпоинте ненайденные расхождения ещё есть, но не с этим типом дефекта. Либо наблюдение верное, а тип не тот, либо смотреть надо в другую сторону.'
                      : 'Такой пары «эндпоинт + тип» в каталоге нет. Либо это не дефект, либо и эндпоинт, и тип выбраны не те.'}
                  </p>
                ) : (
                  <p className="reports__note">
                    {report.bugId}: {bugs.find((bug) => bug.id === report.bugId).title}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
