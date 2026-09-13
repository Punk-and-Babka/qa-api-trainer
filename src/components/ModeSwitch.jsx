import { MODES } from '../modes.js';

// Переключатель режима в шапке. Три кнопки подряд, а не выпадающий список:
// список прячет варианты, а здесь важно, что ступеней именно три и что за
// текущей есть следующая — это и есть приглашение идти дальше.

export default function ModeSwitch({ mode, onChange }) {
  const current = MODES.find((item) => item.id === mode);

  return (
    <div className="modes">
      <div className="modes__buttons" role="group" aria-label="Режим работы">
        {MODES.map((item) => (
          <button
            key={item.id}
            className={`modes__button${item.id === mode ? ' modes__button--on' : ''}`}
            type="button"
            aria-pressed={item.id === mode}
            title={item.note}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <span className="modes__note">{current?.note}</span>
    </div>
  );
}
