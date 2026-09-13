// Список заданий. Отметка о выполнении не хранится: задание закрыто, когда
// засчитаны все связанные с ним баги, и это вычисляется при рендере из уже
// существующего списка найденного.

export default function TaskList({ tasks, foundIds }) {
  const isDone = (task) => task.bugIds.every((id) => foundIds.includes(id));
  const done = tasks.filter(isDone).length;

  return (
    <div className="tasks-panel">
      <p className="tasks-panel__count">
        выполнено {done} из {tasks.length}
      </p>

      <ol className="tasks-panel__list">
        {tasks.map((task) => {
          const complete = isDone(task);

          return (
            <li
              key={task.id}
              className={`task${complete ? ' task--done' : ''}`}
            >
              <div className="task__head">
                <span className="task__mark">{complete ? '✓' : '○'}</span>
                <span className="task__title">{task.title}</span>
                <span className="task__tool">{task.tool}</span>
              </div>
              <p className="task__detail">{task.detail}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
