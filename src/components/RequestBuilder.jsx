// Конструктор запроса. Собственного состояния не имеет: всё приходит через
// props, изменения уходят наверх колбэками. Так App остаётся единственным
// владельцем запроса — это понадобится на шаге 5, когда клик по истории
// должен будет перезаписать поля извне.

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export default function RequestBuilder({
  method,
  path,
  query,
  bodyText,
  bodyError,
  pending,
  onMethodChange,
  onPathChange,
  onBodyChange,
  onSend,
}) {
  const queryPairs = Object.entries(query);
  const canSend = !pending && bodyError === null;

  return (
    <div className="request">
      <div className="request__line">
        <select
          className={`request__method method--${method.toLowerCase()}`}
          value={method}
          onChange={(event) => onMethodChange(event.target.value)}
        >
          {METHODS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <input
          className="request__path"
          value={path}
          spellCheck={false}
          placeholder="/users?limit=10"
          onChange={(event) => onPathChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSend) {
              onSend();
            }
          }}
        />

        <button className="request__send" type="button" disabled={!canSend} onClick={onSend}>
          {pending ? '…' : 'Отправить'}
        </button>
      </div>

      {queryPairs.length > 0 ? (
        <div className="request__query">
          <span className="request__label">Разобранный query:</span>
          {queryPairs.map(([key, value]) => (
            <span key={key} className="request__pair">
              {key} = {value === '' ? <em>пусто</em> : value}
            </span>
          ))}
        </div>
      ) : null}

      <label className="request__label" htmlFor="request-body">
        Тело запроса (JSON)
      </label>
      <textarea
        id="request-body"
        className={`request__body${bodyError ? ' request__body--invalid' : ''}`}
        value={bodyText}
        spellCheck={false}
        rows={10}
        placeholder={'{\n  "email": "egor@example.com",\n  "name": "Egor"\n}'}
        onChange={(event) => onBodyChange(event.target.value)}
      />

      {bodyError ? (
        <p className="request__error">Невалидный JSON: {bodyError}</p>
      ) : (
        <p className="request__hint">
          {bodyText.trim() === ''
            ? 'Пусто — запрос уйдёт без тела.'
            : 'JSON разобран, можно отправлять.'}
        </p>
      )}
    </div>
  );
}
