import { statusClass } from '../status.js';

// Панель эталонной спецификации. Ничего не знает про конкретный сценарий:
// получает объект контракта через props и обходит его. Добавление эндпоинта
// в users.contract.js отражается здесь без единой правки этого файла.

function FieldTable({ fields }) {
  return (
    <table className="fields">
      <tbody>
        {fields.map((field) => (
          <tr key={field.name}>
            <td className="fields__name">
              {field.name}
              {field.required ? <span className="fields__req">*</span> : null}
            </td>
            <td className="fields__type">{field.type}</td>
            <td className="fields__note">{field.note || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Example({ value }) {
  return <pre className="code-block">{JSON.stringify(value, null, 2)}</pre>;
}

function Endpoint({ endpoint }) {
  return (
    <article className="endpoint">
      <header className="endpoint__head">
        <span className={`method method--${endpoint.method.toLowerCase()}`}>
          {endpoint.method}
        </span>
        <code className="endpoint__path">{endpoint.path}</code>
      </header>

      <p className="endpoint__summary">{endpoint.summary}</p>

      {endpoint.query ? (
        <section className="endpoint__block">
          <h4 className="endpoint__label">Query-параметры</h4>
          <FieldTable fields={endpoint.query} />
        </section>
      ) : null}

      {endpoint.body ? (
        <section className="endpoint__block">
          <h4 className="endpoint__label">Тело запроса</h4>
          <FieldTable fields={endpoint.body.fields} />
          {endpoint.body.example ? <Example value={endpoint.body.example} /> : null}
        </section>
      ) : null}

      <section className="endpoint__block">
        <h4 className="endpoint__label">Ответы</h4>
        <ul className="responses">
          {endpoint.responses.map((response) => (
            <li key={response.status} className="responses__item">
              <span className={statusClass(response.status)}>{response.status}</span>
              <span className="responses__note">{response.note}</span>
              {response.example ? <Example value={response.example} /> : null}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

export default function SpecPanel({ contract }) {
  return (
    <div className="spec">
      <h2 className="panel__title">{contract.title}</h2>
      <p className="spec__description">{contract.description}</p>

      <section className="spec__model">
        <h3 className="spec__heading">Модель {contract.model.name}</h3>
        <FieldTable fields={contract.model.fields} />
        <Example value={contract.model.example} />
      </section>

      <section>
        <h3 className="spec__heading">Эндпоинты</h3>
        {contract.endpoints.map((endpoint) => (
          <Endpoint key={`${endpoint.method} ${endpoint.path}`} endpoint={endpoint} />
        ))}
      </section>
    </div>
  );
}
