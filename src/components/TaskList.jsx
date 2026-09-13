import { TASK_TOOLS } from '../mock-api/scenarios/users.tasks.js';
import { plural } from '../plural.js';
import { TASK_TOOL_NEEDS, isToolEnabled } from '../modes.js';

// Список заданий. Отметка о выполнении не хранится: задание закрыто, когда
// засчитаны все связанные с ним баги, и это вычисляется при рендере из уже
// существующего списка найденного.

export default function TaskList({ tasks, foundIds, mode }) {
  // В ручном режиме инструменты автоматизации скрыты, и обещать их в задании
  // нельзя. Задание при этом остаётся решаемым: все дефекты находятся глазами,
  // поэтому вместо скрытых бейджей показывается «глазами».
  function visibleTools(task) {
    const shown = task.tools.filter((tool) => {
      const needs = TASK_TOOL_NEEDS[tool];
      return needs === null || isToolEnabled(mode, needs);
    });

    return shown.length > 0 ? shown : ['eye'];
  }

  const doneCount = (task) => task.bugIds.filter((id) => foundIds.includes(id)).length;
  const isDone = (task) => doneCount(task) === task.bugIds.length;
  const done = tasks.filter(isDone).length;

  return (
    <div className="tasks-panel">
      <div className="tasks-panel__meter">
        <div
          className="tasks-panel__fill"
          style={{ width: `${(done / tasks.length) * 100}%` }}
        />
      </div>
      <p className="tasks-panel__count">
        выполнено {done} из {tasks.length}
      </p>

      <ol className="tasks-panel__list">
        {tasks.map((task) => {
          const complete = isDone(task);
          const found = doneCount(task);

          return (
            <li key={task.id} className={`task${complete ? ' task--done' : ''}`}>
              <div className="task__head">
                <span className="task__mark">{complete ? '✓' : '○'}</span>
                <span className="task__title">{task.title}</span>
              </div>

              <div className="task__badges">
                {visibleTools(task).map((tool) => (
                  <span
                    key={tool}
                    className={`badge badge--${TASK_TOOLS[tool].modifier}`}
                  >
                    {TASK_TOOLS[tool].label}
                  </span>
                ))}
                <span className="badge badge--count">
                  {/* Сколько дефектов за заданием — чтобы студент знал, что
                      искать дальше, а не остановился на первом найденном. */}
                  {found > 0 && !complete ? `${found} из ${task.bugIds.length}, ` : ''}
                  {task.bugIds.length}{' '}
                  {plural(task.bugIds.length, ['дефект', 'дефекта', 'дефектов'])}
                </span>
              </div>

              <p className="task__detail">{task.detail}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
