import JsonView from './JsonView.jsx';
import { STATUS_TEXT, statusClass } from '../status.js';

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
