import type { ModelAggregate, ModelElement } from '../../../content/types';
import { cx } from '../../../utils/cx';
import style from './AggregateBlock.module.css';

type AggregateBlockProps = {
  aggregate: ModelAggregate;
  elements: ModelElement[];
  selectedId?: string | null;
  highlightActive?: boolean;
  onToggleHighlight?: () => void;
  onSelectElement?: (id: string) => void;
};

const formatValue = (value: number, unit?: string) => {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
  return unit ? `${rounded} ${unit}` : rounded;
};

const elementLabel = (el: ModelElement) =>
  el.mark || el.family || el.type || el.category || el.id.slice(0, 8);

/** Вторая строка: DN / система / тип. */
const elementMeta = (el: ModelElement) => {
  const bits: string[] = [];
  if (el.diameterMm != null) bits.push(`DN ${el.diameterMm}`);
  if (el.system) bits.push(el.system);
  if (bits.length) return bits.join(' · ');
  const label = elementLabel(el);
  if (el.type && el.type !== label) return el.type;
  if (el.level && el.level !== label) return el.level;
  return null;
};

const elementMetric = (el: ModelElement, unit?: string) => {
  if (unit === 'шт.') return '1 шт.';
  if (unit === 'м' && el.length != null) return formatValue(el.length, 'м');
  if (el.volume != null) return formatValue(el.volume, 'м³');
  if (el.length != null) return formatValue(el.length, 'м');
  return '—';
};

/** Последняя стадия (больший phaseIndex) — сверху. */
const sortByPhaseLatestFirst = (rows: ModelElement[]) =>
  [...rows].sort((a, b) => {
    const ai = typeof a.phaseIndex === 'number' ? a.phaseIndex : -1;
    const bi = typeof b.phaseIndex === 'number' ? b.phaseIndex : -1;
    if (bi !== ai) return bi - ai;
    const an = elementLabel(a);
    const bn = elementLabel(b);
    return an.localeCompare(bn, 'ru');
  });

const AggregateBlock = ({
  aggregate,
  elements,
  selectedId = null,
  highlightActive = false,
  onToggleHighlight,
  onSelectElement,
}: AggregateBlockProps) => {
  const ids = aggregate.elementIds ?? [];
  const rows = sortByPhaseLatestFirst(
    ids
      .map((id) => elements.find((el) => el.id === id))
      .filter((el): el is ModelElement => Boolean(el)),
  );

  return (
    <section className={cx(style.block, highlightActive && style.active)}>
      <button
        type="button"
        className={style.header}
        onClick={onToggleHighlight}
        aria-pressed={highlightActive}
      >
        <span className={style.label}>{aggregate.label}</span>
        <span className={style.total}>{formatValue(aggregate.value, aggregate.unit)}</span>
      </button>

      {rows.length === 0 ? (
        <p className={style.empty}>Нет элементов в выборке</p>
      ) : (
        <ul className={style.list}>
          {rows.map((el) => {
            const meta = elementMeta(el);
            return (
              <li key={el.id}>
                <button
                  type="button"
                  className={cx(style.item, selectedId === el.id && style.itemSelected)}
                  onClick={() => onSelectElement?.(el.id)}
                >
                  <span className={style.itemName}>{elementLabel(el)}</span>
                  {meta ? <span className={style.itemMeta}>{meta}</span> : null}
                  <span className={style.itemValue}>{elementMetric(el, aggregate.unit)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default AggregateBlock;
