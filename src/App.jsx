import { useEffect, useRef, useState } from 'react';
import SpecPanel from './components/SpecPanel.jsx';
import RequestBuilder from './components/RequestBuilder.jsx';
import ResponseViewer from './components/ResponseViewer.jsx';
import HistoryList from './components/HistoryList.jsx';
import BugReportForm from './components/BugReportForm.jsx';
import BugProgress from './components/BugProgress.jsx';
import SchemaCheck from './components/SchemaCheck.jsx';
import TestsEditor from './components/TestsEditor.jsx';
import TestResults from './components/TestResults.jsx';
import { usersContract } from './mock-api/scenarios/users.contract.js';
import { bugs } from './mock-api/scenarios/users.bugs.js';
import { BUG_TYPES } from './mock-api/bug-types.js';
import { checkReport, endpointOptions, foundBugIds } from './bug-check.js';
import { checkResponse } from './schema-check.js';
import { runTests } from './pm-runtime.js';
import { load, save, clear } from './storage.js';
import { handle } from './mock-api/server.js';
import { resetState } from './mock-api/state.js';

const REQUEST_HEADERS = { 'Content-Type': 'application/json' };

// Список эндпоинтов для формы считается из контракта один раз на загрузку
// модуля, а не при каждом рендере: контракт — константа, пересчитывать нечего.
const REPORT_ENDPOINTS = endpointOptions(usersContract);

// Стартовый скрипт: он же короткая документация по доступному API. Пустое поле
// заставляло бы вспоминать синтаксис, а вспоминать пока нечего.
const DEFAULT_SCRIPT = `pm.test('статус 200', function () {
  pm.response.to.have.status(200);
});

pm.test('в теле есть id', function () {
  pm.expect(pm.response.json()).to.have.property('id');
});
`;

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

// Снимок читается один раз при загрузке модуля, до первого рендера. В теле
// компонента это выполнялось бы на каждый рендер, а данные всё равно нужны
// только для начальных значений.
const SAVED = load();

// Наибольший из сохранённых id. Счётчики надо продолжить с него, иначе после
// перезагрузки новые записи получат id, уже занятые старыми, и React начнёт
// путать элементы списка: key обязан быть уникальным.
function maxId(list) {
  return list.reduce((max, item) => Math.max(max, item.id), 0);
}

export default function App() {
  // Восстановленные значения подставляются как начальные. Оператор ?? берёт
  // умолчание только на null и undefined — пустая строка тела и пустые списки
  // сохраняются как есть, а не заменяются умолчанием.
  const [method, setMethod] = useState(SAVED?.method ?? 'GET');
  const [path, setPath] = useState(SAVED?.path ?? '/users');
  const [bodyText, setBodyText] = useState(SAVED?.bodyText ?? '');
  const [response, setResponse] = useState(null);
  // Метод и путь запроса, на который пришёл текущий ответ. Хранятся отдельно
  // от полей конструктора: студент вправе поменять путь после отправки, и
  // проверка по схеме должна сверять ответ с тем эндпоинтом, который реально
  // спрашивали, а не с тем, что сейчас набрано в поле.
  const [answered, setAnswered] = useState(null);
  const [schemaResult, setSchemaResult] = useState(null);
  const [testScript, setTestScript] = useState(SAVED?.testScript ?? DEFAULT_SCRIPT);
  const [testRun, setTestRun] = useState(null);
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState(SAVED?.history ?? []);
  const [resetAt, setResetAt] = useState(null);
  const [reports, setReports] = useState(SAVED?.reports ?? []);
  const [revealedHints, setRevealedHints] = useState(SAVED?.revealedHints ?? []);

  // Счётчик для key элементов истории. useRef, а не useState: значение должно
  // переживать перерисовки, но его изменение само по себе перерисовку не
  // требует. Менять .current прямо в рендере нельзя — только в обработчиках.
  const entryId = useRef(maxId(SAVED?.history ?? []));
  const reportId = useRef(maxId(SAVED?.reports ?? []));

  // Сохранение с задержкой в 300 мс. Без неё каждый символ, набранный в
  // скрипте, вызывал бы запись в localStorage — операция синхронная, она
  // блокирует поток. Возвращаемая функция — уборка эффекта: React вызывает её
  // перед следующим запуском, поэтому предыдущий отложенный вызов отменяется,
  // и запись происходит один раз через 300 мс после последнего изменения.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      save({ method, path, bodyText, testScript, history, reports, revealedHints });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [method, path, bodyText, testScript, history, reports, revealedHints]);

  // Ответ, разобранный запрос и результаты проверок сознательно не
  // сохраняются: ответ относится к состоянию сервера, которого после
  // перезагрузки уже нет — сервер поднимается заново из SEED_USERS.

  // Производные значения, а не состояние: они однозначно вычисляются из path
  // и bodyText. Держать их в useState значило бы хранить одну и ту же правду
  // дважды и ловить рассинхрон.
  const parsedPath = splitPath(path);
  const parsedBody = parseBody(bodyText);

  // То же самое для найденных багов: они однозначно восстанавливаются из ленты
  // репортов, поэтому отдельным состоянием не хранятся.
  const foundIds = foundBugIds(reports);

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
    // Результат прошлой проверки относится к прошлому ответу — снимаем сразу,
    // иначе он повисит на экране рядом с новым.
    setSchemaResult(null);
    setTestRun(null);

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
      setAnswered({ method, path: parsedPath.path });
      // Тесты прогоняются сами, как в Postman. Скрипт берётся тот, что был на
      // момент отправки: правка поля во время ожидания ответа не должна менять
      // то, что прогоняется по этому ответу.
      setTestRun(runTests(testScript, result));
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

  // В отличие от истории, вердикт считается прямо здесь, а не внутри
  // setReports: обработчик выполняется синхронно по клику, и reports в нём —
  // актуальный список, а не устаревший снимок. Функциональная форма нужна была
  // истории потому, что запись добавлялась из setTimeout. Внутрь updater'а
  // счётчик id класть тоже нельзя: React вправе вызвать его дважды, а функция
  // обновления обязана быть чистой.
  function submitReport(draft) {
    const result = checkReport(draft, bugs, foundIds);
    reportId.current += 1;

    const entry = {
      id: reportId.current,
      endpoint: draft.endpoint,
      type: draft.type,
      description: draft.description,
      verdict: result.verdict,
      bugId: result.bugId,
    };

    setReports((current) => [entry, ...current]);
  }

  function runSchemaCheck() {
    if (response === null || answered === null) return;

    setSchemaResult(checkResponse(answered.method, answered.path, response));
  }

  // Повторный прогон по тому же ответу — нужен, когда скрипт правят после
  // получения ответа. Заново запрос при этом не отправляется: состояние
  // сервера могло бы измениться, и тесты проверяли бы уже другой ответ.
  function rerunTests() {
    if (response === null) return;

    setTestRun(runTests(testScript, response));
  }

  // Подсказки открываются по одной, в порядке каталога, и только для тех
  // багов, которые ещё не найдены: подсказывать про уже засчитанный смысла нет.
  function revealHint() {
    const next = bugs.find(
      (bug) => !foundIds.includes(bug.id) && !revealedHints.includes(bug.id),
    );
    if (next === undefined) return;

    setRevealedHints((current) => [...current, next.id]);
  }

  function resetServer() {
    resetState();
    setResetAt(new Date().toLocaleTimeString('ru-RU'));
  }

  // Полный сброс: и сервер, и всё сохранённое. Подтверждение здесь не
  // формальность — тестовый скрипт пишут руками, и стереть его случайно
  // обиднее всего.
  function startOver() {
    const confirmed = window.confirm(
      'Будут стёрты: тестовый скрипт, история запросов, найденные баги и подсказки. Начать заново?',
    );
    if (!confirmed) return;

    clear();
    setMethod('GET');
    setPath('/users');
    setBodyText('');
    setTestScript(DEFAULT_SCRIPT);
    setHistory([]);
    setReports([]);
    setRevealedHints([]);
    setResponse(null);
    setAnswered(null);
    setSchemaResult(null);
    setTestRun(null);
    entryId.current = 0;
    reportId.current = 0;
    resetServer();
    // Эффект сохранения через 300 мс запишет поверх чистый снимок — так и
    // задумано: очистка нужна на случай, если вкладку закроют раньше.
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">QA API Trainer</h1>
        <span className="app__scenario">сценарий: {usersContract.title}</span>
        <div className="app__actions">
          <span className="app__score">
            найдено {foundIds.length} из {bugs.length}
          </span>
          {resetAt ? (
            <span className="app__note">состояние сброшено в {resetAt}</span>
          ) : null}
          <button className="app__reset" type="button" onClick={resetServer}>
            Сбросить состояние сервера
          </button>
          <button className="app__reset" type="button" onClick={startOver}>
            Начать заново
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

          <h2 className="panel__title panel__title--spaced">Tests</h2>
          <TestsEditor
            script={testScript}
            canRun={response !== null && !pending}
            onChange={setTestScript}
            onRun={rerunTests}
          />

          <h2 className="panel__title panel__title--spaced">История</h2>
          <HistoryList entries={history} onPick={pickFromHistory} />
        </section>

        <section className="panel panel--response">
          <h2 className="panel__title">Ответ</h2>
          <ResponseViewer response={response} pending={pending} />

          <h2 className="panel__title panel__title--spaced">Результаты тестов</h2>
          <TestResults run={testRun} />

          <h2 className="panel__title panel__title--spaced">Проверка по схеме</h2>
          <SchemaCheck
            result={schemaResult}
            canCheck={response !== null && !pending}
            onCheck={runSchemaCheck}
          />

          <h2 className="panel__title panel__title--spaced">Баг-репорт</h2>
          <BugReportForm
            endpoints={REPORT_ENDPOINTS}
            types={BUG_TYPES}
            onSubmit={submitReport}
          />

          <h2 className="panel__title panel__title--spaced">Прогресс</h2>
          <BugProgress
            bugs={bugs}
            types={BUG_TYPES}
            reports={reports}
            foundIds={foundIds}
            revealedHints={revealedHints}
            onRevealHint={revealHint}
          />
        </section>
      </main>
    </div>
  );
}
