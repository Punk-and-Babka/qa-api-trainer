import { VALID, INVALID, NO_ENDPOINT, NO_SCHEMA } from '../schema-check.js';

// Проверка ответа по JSON Schema. Запускается кнопкой, а не автоматически:
// проверка выдаёт часть дефектов сразу, и решение «сначала посмотреть глазами,
// потом сверить машиной» остаётся за студентом. Своего состояния нет —
// результат считает App и передаёт сюда готовым.

export default function SchemaCheck({ result, canCheck, onCheck }) {
  return (
    <div className="schema">
      <div className="schema__actions">
        <button
          className="btn"
          type="button"
          disabled={!canCheck}
          onClick={onCheck}
        >
          Проверить по схеме
        </button>
        {canCheck ? null : (
          <span className="schema__note">сначала отправь запрос</span>
        )}
      </div>

      {result === null ? null : (
        <div className="schema__result">
          {result.verdict === VALID ? (
            <p className="schema__verdict schema__verdict--ok">
              Ответ соответствует схеме {result.route} → {result.status}.
            </p>
          ) : null}

          {result.verdict === NO_ENDPOINT ? (
            <p className="schema__verdict schema__verdict--warn">
              Такого эндпоинта в спецификации нет — сверять не с чем.
            </p>
          ) : null}

          {result.verdict === NO_SCHEMA ? (
            <p className="schema__verdict schema__verdict--warn">
              Для {result.route} спецификация не описывает статус {result.status}.
              Ожидались: {result.expected.join(', ')}. Тело не проверялось: неизвестно,
              с чем его сверять.
            </p>
          ) : null}

          {result.verdict === INVALID ? (
            <>
              <p className="schema__verdict schema__verdict--err">
                {result.route} → {result.status}: расхождений {result.errors.length}
              </p>
              <ul className="schema__errors">
                {result.errors.map((error, index) => (
                  // Индекс в key допустим: список неизменяемый, он целиком
                  // заменяется на новый при следующей проверке.
                  <li key={index} className="schema__error">
                    <span className="schema__path">{error.path}</span>
                    <span className="schema__message">{error.message}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
