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
import EnvPanel from './components/EnvPanel.jsx';
import TaskList from './components/TaskList.jsx';
import HelpBlock from './components/HelpBlock.jsx';
import Section from './components/Section.jsx';
import Splitter from './components/Splitter.jsx';
import ModeSwitch from './components/ModeSwitch.jsx';
import {
  DEFAULT_COLUMNS,
  SPLITTER_PX,
  resizeColumns,
  sanitizeColumns,
} from './columns.js';
import { BUG_TYPES } from './mock-api/bug-types.js';
import {
  SCENARIOS,
  findScenario,
  sanitizeScenario,
} from './mock-api/scenarios/index.js';
import { checkReport, endpointOptions, foundBugIds } from './bug-check.js';
import { checkResponse } from './schema-check.js';
import { runTests } from './pm-runtime.js';
import { load, save, clear } from './storage.js';
import { applyVariables, mergeVariables, nextId, toObject } from './variables.js';
import { plural } from './plural.js';
import { REFERENCE } from './reference.js';
import { isToolEnabled, sanitizeMode } from './modes.js';
import { handle } from './mock-api/server.js';

const REQUEST_HEADERS = { 'Content-Type': 'application/json' };


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

// Скрипты и переменные — свои у каждого сценария: тест, написанный под Users,
// на ответах Orders бессмыслен, а прогонялся бы он автоматически.
//
// Ранние снимки хранили один скрипт строкой, до появления второго сценария.
// Такое значение переносится в сценарий users, а не выбрасывается: поднимать
// версию снимка ради совместимого расширения значило бы стереть чужую работу
// на ровном месте.
function migrateScripts(saved) {
  if (typeof saved?.testScript === 'string') return { users: saved.testScript };
  return saved?.scripts ?? {};
}

function migrateVariables(saved) {
  if (Array.isArray(saved?.variables)) return { users: saved.variables };
  return saved?.variablesByScenario ?? {};
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
  const [testRun, setTestRun] = useState(null);
  // Оба словаря — «сценарий → значение». Отсутствующий ключ означает
  // «студент сюда ещё не заходил», и подставляется умолчание.
  const [scripts, setScripts] = useState(() => migrateScripts(SAVED));
  const [variablesByScenario, setVariablesByScenario] = useState(() => migrateVariables(SAVED));
  const [scenarioId, setScenarioId] = useState(() => sanitizeScenario(SAVED?.scenario));
  // Справка открыта при первом заходе и закрывается насовсем, когда её
  // свернули: сохранённое значение читается из снимка.
  const [helpOpen, setHelpOpen] = useState(SAVED?.helpOpen ?? true);
  const [tasksOpen, setTasksOpen] = useState(SAVED?.tasksOpen ?? true);
  const [specOpen, setSpecOpen] = useState(SAVED?.specOpen ?? true);
  const [varsOpen, setVarsOpen] = useState(SAVED?.varsOpen ?? true);
  const [testsOpen, setTestsOpen] = useState(SAVED?.testsOpen ?? true);
  const [historyOpen, setHistoryOpen] = useState(SAVED?.historyOpen ?? true);
  const [columns, setColumns] = useState(() => sanitizeColumns(SAVED?.columns));
  // Пока тянут разделитель, выделение текста в панелях только мешает.
  const [resizing, setResizing] = useState(false);
  const [mode, setMode] = useState(() => sanitizeMode(SAVED?.mode));

  // Ссылка на сетку колонок нужна, чтобы узнать её ширину в пикселях: доли
  // сами по себе не говорят, сколько пикселей в одной доле.
  const layoutRef = useRef(null);
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

  // Активный сценарий и всё, что из него следует. Производные значения, а не
  // состояние: они однозначно вычисляются из scenarioId.
  const scenario = findScenario(scenarioId);
  const bugs = scenario.bugs;
  const tasks = scenario.tasks;
  const reportEndpoints = endpointOptions(scenario.contract);

  // Скрипт и переменные текущего сценария. Обёртки над словарями выглядят как
  // обычные setState, поэтому остальной код о разделении по сценариям не знает.
  const testScript = scripts[scenarioId] ?? DEFAULT_SCRIPT;
  const variables = variablesByScenario[scenarioId] ?? [];

  function setTestScript(value) {
    setScripts((current) => ({ ...current, [scenarioId]: value }));
  }

  function setVariables(updater) {
    setVariablesByScenario((current) => ({
      ...current,
      [scenarioId]:
        typeof updater === 'function' ? updater(current[scenarioId] ?? []) : updater,
    }));
  }

  // Сохранение с задержкой в 300 мс. Без неё каждый символ, набранный в
  // скрипте, вызывал бы запись в localStorage — операция синхронная, она
  // блокирует поток. Возвращаемая функция — уборка эффекта: React вызывает её
  // перед следующим запуском, поэтому предыдущий отложенный вызов отменяется,
  // и запись происходит один раз через 300 мс после последнего изменения.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      save({
        method,
        path,
        bodyText,
        scripts,
        history,
        reports,
        revealedHints,
        variablesByScenario,
        scenario: scenarioId,
        helpOpen,
        tasksOpen,
        specOpen,
        varsOpen,
        testsOpen,
        historyOpen,
        columns,
        mode,
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    method,
    path,
    bodyText,
    scripts,
    history,
    reports,
    revealedHints,
    variablesByScenario,
    scenarioId,
    helpOpen,
    tasksOpen,
    specOpen,
    varsOpen,
    testsOpen,
    historyOpen,
    columns,
    mode,
  ]);

  // Ответ, разобранный запрос и результаты проверок сознательно не
  // сохраняются: ответ относится к состоянию сервера, которого после
  // перезагрузки уже нет — сервер поднимается заново из SEED_USERS.

  // Производные значения, а не состояние: они однозначно вычисляются из path
  // и bodyText. Держать их в useState значило бы хранить одну и ту же правду
  // дважды и ловить рассинхрон.
  // Инструменты текущего режима. Вычисляются при рендере: это производное от
  // mode, хранить его отдельно значило бы держать одну правду дважды.
  const schemaEnabled = isToolEnabled(mode, 'schema');
  const testsEnabled = isToolEnabled(mode, 'tests');
  const varsEnabled = isToolEnabled(mode, 'variables');

  // Подстановка идёт до разбора, и порядок здесь принципиален: тело
  // {"id": {{userId}}} невалидно как JSON и становится валидным только после
  // замены. Postman работает так же — подстановка чисто текстовая.
  // Вне режима с переменными подстановка не работает вовсе. Иначе сохранённые
  // с прошлого раза значения молча подставлялись бы в запрос, а таблицы, где
  // это видно, на экране не было бы.
  const values = varsEnabled ? toObject(variables) : {};
  const resolvedPath = applyVariables(path, values);
  const resolvedBody = applyVariables(bodyText, values);

  const parsedPath = splitPath(resolvedPath.text);
  const parsedBody = parseBody(resolvedBody.text);

  // Имена, которых нет в таблице. Отправку не блокируют: неизвестная
  // переменная уходит на сервер как есть, и увидеть своё же {{token}} в ответе
  // полезнее, чем упереться в запрет.
  const unknownVars = [...new Set([...resolvedPath.unknown, ...resolvedBody.unknown])];

  // То же самое для найденных багов: они однозначно восстанавливаются из ленты
  // репортов, поэтому отдельным состоянием не хранятся.
  // Прогресс считается по текущему сценарию: id дефектов уникальны между
  // сценариями, поэтому достаточно отфильтровать общий список найденного.
  const scenarioBugIds = new Set(bugs.map((bug) => bug.id));
  const foundIds = foundBugIds(reports).filter((id) => scenarioBugIds.has(id));

  // Репорты и история тоже показываются только для текущего сценария. Записи
  // из ранних версий сценария не знают — они все относятся к users.
  const scenarioReports = reports.filter((report) => (report.scenario ?? 'users') === scenarioId);
  const scenarioHistory = history.filter((entry) => (entry.scenario ?? 'users') === scenarioId);

  // Число закрытых заданий нужно и панели, и её заголовку: в свёрнутом виде
  // это единственное, что от заданий остаётся видно.
  const doneTasks = tasks.filter((task) =>
    task.bugIds.every((id) => foundIds.includes(id)),
  ).length;

  // Сколько тестов прошло в последнем прогоне — сводка для свёрнутой панели
  // Tests. Сам список результатов живёт в правой колонке, рядом с ответом.
  const testsPassed = testRun === null ? 0 : testRun.tests.filter((test) => test.passed).length;

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
    }, scenario.routes);

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
        scenario: scenarioId,
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
      // Скрипт не выполняется, когда панель Tests скрыта: запускать код
      // незаметно для пользователя нельзя, даже написанный им самим.
      if (testsEnabled) {
        const run = runTests(testScript, result, values);
        setTestRun(run);
        // Скрипт мог сохранить значение из ответа — это и есть цепочка
        // запросов. Функциональная форма: между отправкой и ответом таблицу
        // могли править руками, и затирать эту правку снимком нельзя.
        setVariables((current) => mergeVariables(current, run.variables));
      }
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
      scenario: scenarioId,
      endpoint: draft.endpoint,
      type: draft.type,
      description: draft.description,
      verdict: result.verdict,
      bugId: result.bugId,
      nearMiss: result.nearMiss,
    };

    setReports((current) => [entry, ...current]);
  }

  function runSchemaCheck() {
    if (response === null || answered === null) return;

    setSchemaResult(checkResponse(scenario, answered.method, answered.path, response));
  }

  // Повторный прогон по тому же ответу — нужен, когда скрипт правят после
  // получения ответа. Заново запрос при этом не отправляется: состояние
  // сервера могло бы измениться, и тесты проверяли бы уже другой ответ.
  function rerunTests() {
    if (response === null) return;

    const run = runTests(testScript, response, values);
    setTestRun(run);
    setVariables((current) => mergeVariables(current, run.variables));
  }

  function changeVariable(id, field, value) {
    setVariables((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  function addVariable() {
    setVariables((current) => [...current, { id: nextId(current), name: '', value: '' }]);
  }

  function removeVariable(id) {
    setVariables((current) => current.filter((item) => item.id !== id));
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

  // Ширину сетки в пикселях знает только DOM — сам пересчёт живёт в
  // src/columns.js и о браузере ничего не знает. null означает «упёрлись в
  // минимальную ширину», и тогда состояние не трогается вовсе.
  function dragColumns(index, deltaPx) {
    if (layoutRef.current === null) return;

    const gridWidth = layoutRef.current.getBoundingClientRect().width;
    const next = resizeColumns(columns, index, deltaPx, gridWidth);
    if (next === null) return;

    setColumns(next);
  }

  function resetServer() {
    scenario.reset();
    setResetAt(new Date().toLocaleTimeString('ru-RU'));
  }

  // Переключение сценария. Ответ и результаты проверок снимаются: они
  // относятся к серверу другого сценария, и показывать их рядом с новой
  // спецификацией значило бы вводить в заблуждение. Прогресс, история и
  // скрипты остаются — они хранятся в разрезе сценариев.
  function switchScenario(nextId) {
    const next = findScenario(nextId);

    setScenarioId(next.id);
    setResponse(null);
    setAnswered(null);
    setSchemaResult(null);
    setTestRun(null);
    setResetAt(null);
    // Путь из чужого сценария дал бы 404 на первом же запросе, поэтому поля
    // конструктора встают на первый эндпоинт нового контракта.
    setMethod(next.contract.endpoints[0].method);
    setPath(next.contract.endpoints[0].path);
    setBodyText('');
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
    setHistory([]);
    setReports([]);
    setRevealedHints([]);
    setHelpOpen(true);
    setTasksOpen(true);
    setSpecOpen(true);
    setVarsOpen(true);
    setTestsOpen(true);
    setHistoryOpen(true);
    setColumns(DEFAULT_COLUMNS);
    setMode(sanitizeMode(null));
    setScripts({});
    setVariablesByScenario({});
    setScenarioId(sanitizeScenario(null));
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
        {/* Список, а не кнопки: сценариев со временем станет много, и они не
            лестница — между ними переключаются, а не поднимаются. */}
        <select
          className="app__scenarioPick"
          value={scenarioId}
          aria-label="Сценарий"
          title={scenario.summary}
          onChange={(event) => switchScenario(event.target.value)}
        >
          {SCENARIOS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <ModeSwitch mode={mode} onChange={setMode} />

        <div className="app__actions">
          <span className="app__score">
            найдено {foundIds.length} из {bugs.length}
          </span>
          {resetAt ? (
            <span className="app__note">состояние сброшено в {resetAt}</span>
          ) : null}
          <button className="btn" type="button" onClick={resetServer}>
            Сбросить состояние сервера
          </button>
          <button className="btn" type="button" onClick={startOver}>
            Начать заново
          </button>
        </div>
      </header>

      <main
        ref={layoutRef}
        className={`layout${resizing ? ' layout--resizing' : ''}`}
        style={{
          gridTemplateColumns: columns
            .map((value) => `${value}fr`)
            .join(` ${SPLITTER_PX}px `),
        }}
      >
        <section className="panel panel--spec">
          <Section
            title="Как этим пользоваться"
            open={helpOpen}
            onToggle={() => setHelpOpen((current) => !current)}
          >
            <HelpBlock mode={mode} />
          </Section>

          <Section
            title="Задания"
            summary={`${doneTasks} / ${tasks.length}`}
            lead="Порядок произвольный. Задание закрывается само, когда засчитан связанный с ним баг-репорт."
            open={tasksOpen}
            onToggle={() => setTasksOpen((current) => !current)}
          >
            <TaskList tasks={tasks} foundIds={foundIds} mode={mode} />
          </Section>

          <Section
            title="Спецификация"
            summary={`${scenario.contract.endpoints.length} ${plural(
              scenario.contract.endpoints.length,
              ['эндпоинт', 'эндпоинта', 'эндпоинтов'],
            )}`}
            lead="Эталон. Всё, что сервер делает иначе, — дефект."
            reference={REFERENCE.spec}
            open={specOpen}
            onToggle={() => setSpecOpen((current) => !current)}
          >
            <SpecPanel contract={scenario.contract} />
          </Section>
        </section>

        <Splitter
          onResize={(delta) => dragColumns(0, delta)}
          onStart={() => setResizing(true)}
          onEnd={() => setResizing(false)}
          onReset={() => setColumns(DEFAULT_COLUMNS)}
        />

        <section className="panel panel--request">
          <Section
            title="Запрос"
            lead="Путь целиком, вместе с query. Enter отправляет."
            reference={REFERENCE.request}
            first
          >
            <RequestBuilder
              method={method}
              path={path}
              resolvedPath={resolvedPath.text}
              unknownVars={unknownVars}
              query={parsedPath.query}
              bodyText={bodyText}
              bodyError={parsedBody.error}
              pending={pending}
              onMethodChange={setMethod}
              onPathChange={setPath}
              onBodyChange={setBodyText}
              onSend={send}
            />
          </Section>

          {varsEnabled ? (
            <Section
              title="Переменные"
              summary={
                variables.length === 0
                  ? null
                  : `${variables.length} ${plural(variables.length, [
                      'переменная',
                      'переменные',
                      'переменных',
                    ])}`
              }
              lead="Для цепочек: значение из одного ответа подставляется в следующий запрос."
              reference={REFERENCE.variables}
              open={varsOpen}
              onToggle={() => setVarsOpen((current) => !current)}
            >
              <EnvPanel
                variables={variables}
                onChange={changeVariable}
                onAdd={addVariable}
                onRemove={removeVariable}
              />
            </Section>
          ) : null}

          {testsEnabled ? (
            <Section
              title="Tests"
              summary={testRun === null ? null : `${testsPassed} / ${testRun.tests.length}`}
              lead="JavaScript. Тест падает, если функция бросила исключение."
              reference={REFERENCE.tests}
              open={testsOpen}
              onToggle={() => setTestsOpen((current) => !current)}
            >
              <TestsEditor
                script={testScript}
                canRun={response !== null && !pending}
                onChange={setTestScript}
                onRun={rerunTests}
              />
            </Section>
          ) : null}

          <Section
            title="История"
            reference={REFERENCE.history}
            summary={
              scenarioHistory.length === 0
                ? null
                : `${scenarioHistory.length} ${plural(scenarioHistory.length, [
                    'запрос',
                    'запроса',
                    'запросов',
                  ])}`
            }
            open={historyOpen}
            onToggle={() => setHistoryOpen((current) => !current)}
          >
            <HistoryList entries={scenarioHistory} onPick={pickFromHistory} />
          </Section>
        </section>

        <Splitter
          onResize={(delta) => dragColumns(1, delta)}
          onStart={() => setResizing(true)}
          onEnd={() => setResizing(false)}
          onReset={() => setColumns(DEFAULT_COLUMNS)}
        />

        <section className="panel panel--response">
          <Section title="Ответ" first>
            <ResponseViewer response={response} pending={pending} />
          </Section>

          {testsEnabled ? (
            <Section
              title="Результаты тестов"
              summary={testRun === null ? null : `${testsPassed} / ${testRun.tests.length}`}
            >
              <TestResults run={testRun} />
            </Section>
          ) : null}

          {schemaEnabled ? (
            <Section
              title="Проверка по схеме"
              lead="Сверяет тело с моделью из спецификации. Видит не всё."
              reference={REFERENCE.schema}
            >
              <SchemaCheck
                result={schemaResult}
                canCheck={response !== null && !pending}
                onCheck={runSchemaCheck}
              />
            </Section>
          ) : null}

          <Section
            title="Баг-репорт"
            lead="Совпадение проверяется по паре «эндпоинт + тип»."
            reference={REFERENCE.report}
          >
            <BugReportForm
              endpoints={reportEndpoints}
              types={BUG_TYPES}
              onSubmit={submitReport}
            />
          </Section>

          <Section title="Прогресс" summary={`${foundIds.length} / ${bugs.length}`}>
            <BugProgress
              bugs={bugs}
              types={BUG_TYPES}
              reports={scenarioReports}
              foundIds={foundIds}
              revealedHints={revealedHints}
              onRevealHint={revealHint}
            />
          </Section>
        </section>
      </main>
    </div>
  );
}
