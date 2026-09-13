// Таблица переменных окружения. Значения правятся руками, но их же меняет
// скрипт из панели Tests через pm.environment.set — поэтому список живёт
// в App, а не здесь: у него два источника изменений.

export default function EnvPanel({ variables, onChange, onAdd, onRemove }) {
  return (
    <div className="env">
      {variables.length === 0 ? (
        <p className="placeholder">Переменных нет.</p>
      ) : (
        <table className="env__table">
          <tbody>
            {variables.map((variable) => (
              // key по id, а не по индексу: строки удаляются из середины, и по
              // индексу React решил бы, что изменились все строки ниже.
              <tr key={variable.id}>
                <td>
                  <input
                    className="env__input env__input--name"
                    value={variable.name}
                    spellCheck={false}
                    placeholder="имя"
                    onChange={(event) => onChange(variable.id, 'name', event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="env__input"
                    value={variable.value}
                    spellCheck={false}
                    placeholder="значение"
                    onChange={(event) => onChange(variable.id, 'value', event.target.value)}
                  />
                </td>
                <td>
                  <button
                    className="env__remove"
                    type="button"
                    title="удалить переменную"
                    onClick={() => onRemove(variable.id)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="env__actions">
        <button className="env__add" type="button" onClick={onAdd}>
          Добавить переменную
        </button>
        <span className="env__note">
          в пути и теле: <code>{'{{имя}}'}</code>, в скрипте:{' '}
          <code>pm.environment.set(...)</code>
        </span>
      </div>
    </div>
  );
}
