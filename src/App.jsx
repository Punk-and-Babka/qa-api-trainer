import { useRef, useState } from 'react';
import SpecPanel from './components/SpecPanel.jsx';
import RequestBuilder from './components/RequestBuilder.jsx';
import ResponseViewer from './components/ResponseViewer.jsx';
import HistoryList from './components/HistoryList.jsx';
import { usersContract } from './mock-api/scenarios/users.contract.js';
import { handle } from './mock-api/server.js';
import { resetState } from './mock-api/state.js';

const REQUEST_HEADERS = { 'Content-Type': 'application/json' };

// decodeURIComponent бросает исключение на битой последовательности вроде "%zz".
// Приложение из-за опечатки в адресной строке падать не должно.
function safeDecode(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

// Путь вводится одной строкой, как его и пишут руками: "/users?limit=0".
// Роутер по контракту ждёт path и query раздельно — разбираем здесь.
function splitPath(raw) {
  const trimmed = raw.trim();
  const mark = trimmed.indexOf('?');
  if (mark === -1) {
    return { path: trimmed, query: {} };
  }

  const query = {};
  for (const pair of trimmed.slice(mark + 1).split('&')) {
    if (pair === '') continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? '' : pair.slice(eq + 1);
    query[safeDecode(key)] = safeDecode(value);
  }

  return { path: trimmed.slice(0, mark), query };
}

// Результат разбора тела: либо значение, либо текст ошибки. Оба поля нужны
// одновременно, поэтому возвращается пара, а не исключение.
function parseBody(text) {
  if (text.trim() === '') {
    return { value: null, error: null };
  }
  try {
    return { value: JSON.parse(text), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

export default function App() {
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/users');
  const [bodyText, setBodyText] = useState('');
  const [response, setResponse] = useState(null);
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState([]);
  const [resetAt, setResetAt] = useState(null);

  // Счётчик для key элементов истории. useRef, а не useState: значение должно
  // переживать перерисовки, но его изменение само по себе перерисовку не
  // требует. Менять .current прямо в рендере нельзя — только в обработчиках.
  const entryId = useRef(0);

  // Производные значения, а не состояние: они однозначно вычисляются из path
  // и bodyText. Держать их в useState значило бы хранить одну и ту же правду
  // дважды и ловить рассинхрон.
  const parsedPath = splitPath(path);
  const parsedBody = parseBody(bodyText);

  function send() {
    if (parsedBody.error !== null || pending) {
      return;
    }

    // Сервер отвечает сразу — он синхронный. Задержку изображает setTimeout
    // здесь, на время, которое вернул сам сервер.
    const result = handle({
      method,
      path: parsedPath.path,
      query: parsedPath.query,
      headers: REQUEST_HEADERS,
      body: parsedBody.value,
    });

    setPending(true);
    setResponse(null);

    window.setTimeout(() => {
      entryId.current += 1;
      const entry = {
        id: entryId.current,
        method,
        // Путь и тело сохраняются ровно в том виде, в каком были набраны:
        // клик по истории должен вернуть в поля то же самое, а не разобранный
        // и заново собранный вариант.
        path: path.trim(),
        bodyText,
        status: result.status,
        time: result.time,
      };

      setResponse(result);
      setPending(false);
      // Новое сверху. Сравнение с прошлым запросом — самое частое действие,
      // и ради него не должно приходиться прокручивать список.
      setHistory((current) => [entry, ...current]);
    }, result.time);
  }

  function pickFromHistory(entry) {
    setMethod(entry.method);
    setPath(entry.path);
    setBodyText(entry.bodyText);
  }

  function resetServer() {
    resetState();
    setResetAt(new Date().toLocaleTimeString('ru-RU'));
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">QA API Trainer</h1>
        <span className="app__scenario">сценарий: {usersContract.title}</span>
        <div className="app__actions">
          {resetAt ? (
            <span className="app__note">состояние сброшено в {resetAt}</span>
          ) : null}
          <button className="app__reset" type="button" onClick={resetServer}>
            Сбросить состояние сервера
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="panel panel--spec">
          <SpecPanel contract={usersContract} />
        </section>

        <section className="panel panel--request">
          <h2 className="panel__title">Запрос</h2>
          <RequestBuilder
            method={method}
            path={path}
            query={parsedPath.query}
            bodyText={bodyText}
            bodyError={parsedBody.error}
            pending={pending}
            onMethodChange={setMethod}
            onPathChange={setPath}
            onBodyChange={setBodyText}
            onSend={send}
          />

          <h2 className="panel__title panel__title--spaced">История</h2>
          <HistoryList entries={history} onPick={pickFromHistory} />
        </section>

        <section className="panel panel--response">
          <h2 className="panel__title">Ответ</h2>
          <ResponseViewer response={response} pending={pending} />
        </section>
      </main>
    </div>
  );
}
