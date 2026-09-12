import JsonView from './JsonView.jsx';

// Расшифровки статусов — только те, что реально встречаются в сценарии.
// Неизвестный код покажется без подписи, это не ошибка.
const STATUS_TEXT = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

function statusClass(status) {
  if (status >= 500) return 'status status--5xx';
  if (status >= 400) return 'status status--4xx';
  return 'status status--2xx';
}

export default function ResponseViewer({ response, pending }) {
  if (pending) {
    return <p className="placeholder">Отправка…</p>;
  }

  if (!response) {
    return <p className="placeholder">Ответ появится здесь после отправки запроса.</p>;
  }

  return (
    <div className="response">
      <div className="response__meta">
        <span className={`${statusClass(response.status)} response__status`}>
          {response.status}
        </span>
        <span className="response__statusText">{STATUS_TEXT[response.status] || ''}</span>
        <span className="response__time">{response.time} мс</span>
      </div>

      <h4 className="response__label">Заголовки</h4>
      <div className="response__headers">
        {Object.entries(response.headers).map(([name, value]) => (
          <div key={name}>
            <span className="response__headerName">{name}:</span> {value}
          </div>
        ))}
      </div>

      <h4 className="response__label">Тело</h4>
      <JsonView value={response.body} />
    </div>
  );
}
