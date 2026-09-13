import { useState } from 'react';

// Форма баг-репорта: эндпоинт, тип дефекта, описание своими словами.
//
// Отступление от правила «App — единственный владелец состояния»: черновик
// формы живёт здесь, в useState самого компонента. Правило появилось ради
// истории запросов, где клик по элементу обязан перезаписать поля извне.
// Черновику это не нужно: снаружи его никто не задаёт и не читает, наверх
// уходит только готовый репорт при отправке. Поднимать такое состояние в App
// значило бы гонять четыре лишних props туда-обратно без выигрыша.

export default function BugReportForm({ endpoints, types, onSubmit }) {
  const [endpoint, setEndpoint] = useState(endpoints[0]);
  const [type, setType] = useState(types[0].id);
  const [description, setDescription] = useState('');

  const canSubmit = description.trim() !== '';

  function submit() {
    if (!canSubmit) return;

    onSubmit({ endpoint, type, description: description.trim() });
    // Очищается только описание. Эндпоинт и тип остаются: на одном эндпоинте
    // обычно находят несколько дефектов подряд, и переставлять селекты заново
    // после каждого репорта — лишняя работа.
    setDescription('');
  }

  return (
    <div className="report">
      <div className="report__row">
        <label className="report__label" htmlFor="report-endpoint">
          Эндпоинт
        </label>
        <select
          id="report-endpoint"
          className="report__select"
          value={endpoint}
          onChange={(event) => setEndpoint(event.target.value)}
        >
          {endpoints.map((item) => (
            <option key={item} value={item}>
              {item === '*' ? '* — во всех ответах' : item}
            </option>
          ))}
        </select>
      </div>

      <div className="report__row">
        <label className="report__label" htmlFor="report-type">
          Тип дефекта
        </label>
        <select
          id="report-type"
          className="report__select"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {types.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <label className="report__label" htmlFor="report-description">
        Что не так
      </label>
      <textarea
        id="report-description"
        className="report__description"
        value={description}
        rows={3}
        placeholder="Ожидалось 201 Created, фактически 200 OK"
        onChange={(event) => setDescription(event.target.value)}
      />

      <button
        className="btn btn--primary"
        type="button"
        disabled={!canSubmit}
        onClick={submit}
      >
        Завести баг
      </button>
    </div>
  );
}
