import { useState } from 'react';
import ReferenceBlock from './ReferenceBlock.jsx';

// Сворачиваемый раздел панели. Заголовок здесь — кнопка целиком: попасть в
// маленькую стрелку мышью труднее, чем в строку, а лишней разметки это не
// стоит.
//
// Открытость самого раздела приходит сверху: она сохраняется в снимке
// localStorage вместе с остальным вводом. А вот открытость справки живёт
// здесь, в useState: это сиюминутный взгляд в шпаргалку, а не выбор
// раскладки, и переживать перезагрузку ему незачем.
//
// Без onToggle раздел не сворачивается: заголовок остаётся текстом, а
// содержимое видно всегда. Так устроены разделы правой колонки — там всё
// появляется по ходу работы и исчезает само, прятать нечего, но справка
// нужна и им.

export default function Section({
  title,
  summary,
  lead,
  reference,
  open,
  onToggle,
  first,
  children,
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  const collapsible = typeof onToggle === 'function';
  const shown = collapsible ? open : true;

  return (
    <>
      <h2
        className={`panel__title section__head${first ? '' : ' panel__title--spaced'}`}
      >
        {collapsible ? (
          <button
            className="section__toggle"
            type="button"
            aria-expanded={open}
            onClick={onToggle}
          >
            <span className="section__caret">{open ? '▾' : '▸'}</span>
            {title}
          </button>
        ) : (
          <span className="section__static">{title}</span>
        )}

        {/* Сводка видна и в свёрнутом виде — иначе, свернув задания, студент
            теряет из виду прогресс, ради которого их и открывал. */}
        {summary ? <span className="section__summary">{summary}</span> : null}

        {reference ? (
          <button
            className={`section__help${helpOpen ? ' section__help--on' : ''}`}
            type="button"
            title="справка по разделу"
            aria-expanded={helpOpen}
            aria-label={`Справка: ${title}`}
            onClick={() => setHelpOpen((current) => !current)}
          >
            ?
          </button>
        ) : null}
      </h2>

      {/* Справка показывается даже у свёрнутого раздела: заглянуть в список
          матчеров, не разворачивая редактор скрипта, — обычное дело. */}
      {reference && helpOpen ? <ReferenceBlock groups={reference} /> : null}

      {shown ? (
        <>
          {lead ? <p className="panel__lead">{lead}</p> : null}
          {children}
        </>
      ) : null}
    </>
  );
}
