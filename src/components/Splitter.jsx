import { useRef } from 'react';

// Разделитель между колонками: тянется мышью, меняет их ширину.
//
// Используются pointer events, а не mouse: один и тот же код работает для
// мыши, тачпада и пера. Ключевая часть — setPointerCapture: он привязывает
// все последующие события указателя к этому элементу, даже когда курсор ушёл
// с него на соседнюю панель. Без захвата пришлось бы вешать обработчики на
// window и снимать их вручную, и любой промах привёл бы к «залипшему» захвату.
//
// Своего состояния о ширине здесь нет: разделитель сообщает наверх смещение в
// пикселях, а пересчёт долей — дело App, который эти доли и хранит.

export default function Splitter({ onResize, onStart, onEnd, onReset }) {
  // Точка отсчёта. В ref, а не в состоянии: она меняется на каждое движение
  // мыши, и перерисовывать из-за неё компонент незачем.
  const anchor = useRef(0);

  function handleDown(event) {
    // Без preventDefault браузер начнёт выделять текст в соседних панелях.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    anchor.current = event.clientX;
    onStart();
  }

  function handleMove(event) {
    // Движения приходят и без нажатия — реагируем только на захваченные.
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;

    const delta = event.clientX - anchor.current;
    if (delta === 0) return;

    // Отсчёт сдвигается на каждом шаге: смещение считается от прошлого
    // положения, а не от начала перетаскивания. Иначе упор в минимальную
    // ширину копил бы «долг», и колонка не двинулась бы обратно, пока курсор
    // не вернётся в исходную точку.
    anchor.current = event.clientX;
    onResize(delta);
  }

  function handleUp(event) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onEnd();
  }

  function handleKey(event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onResize(-24);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onResize(24);
    }
  }

  return (
    <div
      className="splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ширина колонок"
      tabIndex={0}
      title="Потяни, чтобы изменить ширину. Двойной клик вернёт как было."
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onDoubleClick={onReset}
      onKeyDown={handleKey}
    />
  );
}
