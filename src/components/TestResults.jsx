// Результаты прогона тестов. Разделены два случая: упал отдельный тест
// (остальные при этом отработали) и упал весь скрипт — синтаксическая ошибка
// или исключение вне pm.test. Второе не «ноль тестов прошло», а «тесты не
// запускались», и путать их нельзя.

export default function TestResults({ run }) {
  if (run === null) {
    return <p className="placeholder">Тесты ещё не прогонялись.</p>;
  }

  const passed = run.tests.filter((test) => test.passed).length;

  return (
    <div className="results">
      {run.error === null ? null : (
        <p className="results__crash">Скрипт упал — {run.error}</p>
      )}

      {run.tests.length === 0 ? (
        run.error === null ? (
          <p className="placeholder">Скрипт отработал, но ни одного pm.test не объявлено.</p>
        ) : null
      ) : (
        <>
          <p
            className={`results__summary${
              passed === run.tests.length ? ' results__summary--ok' : ''
            }`}
          >
            прошло {passed} из {run.tests.length}
          </p>

          <ul className="results__list">
            {run.tests.map((test, index) => (
              // Индекс в key допустим: список неизменяемый и целиком
              // заменяется новым при следующем прогоне.
              <li key={index} className="results__item">
                <span
                  className={`results__mark results__mark--${test.passed ? 'ok' : 'fail'}`}
                >
                  {test.passed ? 'PASS' : 'FAIL'}
                </span>
                <span className="results__name">{test.name}</span>
                {test.passed ? null : (
                  <span className="results__message">{test.message}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
