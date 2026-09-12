import SpecPanel from './components/SpecPanel.jsx';
import { usersContract } from './mock-api/scenarios/users.contract.js';

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">QA API Trainer</h1>
        <span className="app__scenario">сценарий: {usersContract.title}</span>
      </header>

      <main className="layout">
        <section className="panel panel--spec">
          <SpecPanel contract={usersContract} />
        </section>

        <section className="panel panel--request">
          <h2 className="panel__title">Запрос</h2>
          <p className="placeholder">Конструктор запроса — шаг 4.</p>
        </section>

        <section className="panel panel--response">
          <h2 className="panel__title">Ответ</h2>
          <p className="placeholder">Просмотр ответа — шаг 4.</p>
        </section>
      </main>
    </div>
  );
}
