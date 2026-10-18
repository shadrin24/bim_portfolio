import type { ModelAggregate, ModelElement } from '../../../content/types';
import { cx } from '../../../utils/cx';
import style from './AggregateBlock.module.css';

type AggregateBlockProps = {
  aggregate: ModelAggregate;
  elements: ModelElement[];
  selectedIds?: string[] | null;
  highlightActive?: boolean;
  onToggleHighlight?: () => void;
  onSelectElement?: (ids: string[]) => void;
};

type ListRow = {
  key: string;
  ids: string[];
  /** Позиция / марка — отдельная колонка, не участвует в переносе текста */
  mark: string | null;
  name: string;
  meta: string | null;
  value: string;
  selected: boolean;
};

const formatValue = (value: number, unit?: string) => {
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
  return unit ? `${rounded} ${unit}` : rounded;
};

const isExistingPhase = (el: ModelElement) =>
  Boolean(el.phase && /существующ/i.test(el.phase));

const withExistingMark = (label: string, el: ModelElement) =>
  isExistingPhase(el) ? `${label} (сущ.)` : label;

/** DN через пробел в конец общей строки. */
const withDn = (label: string, diameterMm: number | null | undefined) =>
  diameterMm != null ? `${label} DN ${diameterMm}` : label;

const formatMark = (mark: string | null | undefined) => {
  const m = mark?.trim();
  if (!m) return null;
  return m.endsWith('.') ? m : `${m}.`;
};

const markSortKey = (mark: string | null) => {
  const raw = mark?.replace(/\.$/, '').trim() ?? '';
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n)) return { n, s: raw };
  return { n: Number.POSITIVE_INFINITY, s: raw };
};

const elementLabelParts = (el: ModelElement) => {
  const mark = formatMark(el.mark);
  const family = el.family?.trim();
  let rest: string;
  if (el.mepKind === 'fitting' || el.mepKind === 'valve') {
    rest = family || el.category || el.id.slice(0, 8);
  } else {
    rest = family || el.type || el.category || el.id.slice(0, 8);
  }
  return {
    mark,
    name: withExistingMark(withDn(rest, el.diameterMm), el),
  };
};

const elementMetric = (el: ModelElement, unit?: string) => {
  if (unit === 'шт.') return '1 шт.';
  if (unit === 'м' && el.length != null) return formatValue(el.length, 'м');
  if (el.volume != null) return formatValue(el.volume, 'м³');
  if (el.length != null) return formatValue(el.length, 'м');
  return '—';
};

/** По марке (1, 2, 3…), без марки — в конец. */
const sortByMarkAsc = (rows: ModelElement[]) =>
  [...rows].sort((a, b) => {
    const am = markSortKey(a.mark ?? null);
    const bm = markSortKey(b.mark ?? null);
    if (am.n !== bm.n) return am.n - bm.n;
    if (am.s !== bm.s) return am.s.localeCompare(bm.s, 'ru');
    const an = elementLabelParts(a).name;
    const bn = elementLabelParts(b).name;
    return an.localeCompare(bn, 'ru');
  });

/** Последняя стадия (больший phaseIndex) — сверху. */
const sortByPhaseLatestFirst = (rows: ModelElement[]) =>
  [...rows].sort((a, b) => {
    const ai = typeof a.phaseIndex === 'number' ? a.phaseIndex : -1;
    const bi = typeof b.phaseIndex === 'number' ? b.phaseIndex : -1;
    if (bi !== ai) return bi - ai;
    return elementLabelParts(a).name.localeCompare(elementLabelParts(b).name, 'ru');
  });

const roundLen = (n: number) => Math.round(n * 1000) / 1000;

const sortRowsByMarkThenDn = (rows: ListRow[]) =>
  rows.sort((a, b) => {
    const am = markSortKey(a.mark);
    const bm = markSortKey(b.mark);
    if (am.n !== bm.n) return am.n - bm.n;
    if (am.s !== bm.s) return am.s.localeCompare(bm.s, 'ru');
    const aDn = a.name.match(/DN ([\d.]+)/)?.[1];
    const bDn = b.name.match(/DN ([\d.]+)/)?.[1];
    const ad = aDn != null ? Number(aDn) : -1;
    const bd = bDn != null ? Number(bDn) : -1;
    if (ad !== bd) return ad - bd;
    return a.name.localeCompare(b.name, 'ru');
  });

/** Трубы с одинаковым DN и длиной — одна строка с количеством. */
const groupPipesByDnAndLength = (
  pipes: ModelElement[],
  selectedSet: Set<string>,
): ListRow[] => {
  const groups = new Map<string, ModelElement[]>();
  for (const el of pipes) {
    const dn = el.diameterMm ?? '—';
    const len = el.length != null ? roundLen(el.length) : '—';
    const type = el.type?.trim() || el.family?.trim() || '';
    const mark = el.mark?.trim() || '';
    const existing = isExistingPhase(el) ? '1' : '0';
    const key = `${mark}|${dn}|${len}|${type}|${existing}`;
    const list = groups.get(key);
    if (list) list.push(el);
    else groups.set(key, [el]);
  }

  const rows: ListRow[] = [];
  for (const [key, items] of groups) {
    const sample = items[0];
    const count = items.length;
    const len = sample.length != null ? roundLen(sample.length) : null;
    const typeName = sample.type?.trim() || sample.family?.trim() || 'Труба';
    const totalLen = len != null ? len * count : null;
    rows.push({
      key,
      ids: items.map((el) => el.id),
      mark: formatMark(sample.mark),
      name: withExistingMark(withDn(typeName, sample.diameterMm), sample),
      meta: null,
      value:
        totalLen != null
          ? count > 1
            ? `${formatValue(totalLen, 'м')} (${count}×${formatValue(len!, 'м')})`
            : formatValue(totalLen, 'м')
          : '—',
      selected: items.some((el) => selectedSet.has(el.id)),
    });
  }

  return sortRowsByMarkThenDn(rows);
};

/** Одинаковые марка / семейство / тип — одна строка. */
const groupByMarkFamilyType = (
  items: ModelElement[],
  selectedSet: Set<string>,
): ListRow[] => {
  const groups = new Map<string, ModelElement[]>();
  for (const el of items) {
    const mark = el.mark?.trim() || '';
    const family = el.family?.trim() || '';
    const type = el.type?.trim() || '';
    const dn = el.diameterMm ?? '—';
    const existing = isExistingPhase(el) ? '1' : '0';
    const key = `${mark}|${family}|${type}|${dn}|${existing}`;
    const list = groups.get(key);
    if (list) list.push(el);
    else groups.set(key, [el]);
  }

  const rows: ListRow[] = [];
  for (const [key, group] of groups) {
    const sample = group[0];
    const count = group.length;
    const rest = [sample.family?.trim(), sample.type?.trim()].filter(Boolean).join(' ');
    const body = rest || sample.category || sample.id.slice(0, 8);
    rows.push({
      key,
      ids: group.map((el) => el.id),
      mark: formatMark(sample.mark),
      name: withExistingMark(withDn(body, sample.diameterMm), sample),
      meta: null,
      value: `${count} шт.`,
      selected: group.some((el) => selectedSet.has(el.id)),
    });
  }

  return sortRowsByMarkThenDn(rows);
};

const buildRows = (
  aggregate: ModelAggregate,
  elements: ModelElement[],
  selectedIds: string[] | null,
): ListRow[] => {
  const selectedSet = new Set(selectedIds ?? []);
  const ids = aggregate.elementIds ?? [];
  const resolved = ids
    .map((id) => elements.find((el) => el.id === id))
    .filter((el): el is ModelElement => Boolean(el));

  const sortByMark =
    aggregate.key === 'equipmentCount' ||
    aggregate.key === 'valvesCount' ||
    aggregate.key === 'fittingsCount' ||
    aggregate.unit === 'шт.';
  const list = sortByMark ? sortByMarkAsc(resolved) : sortByPhaseLatestFirst(resolved);

  const isPipes =
    aggregate.key === 'pipesLength' ||
    (aggregate.unit === 'м' && list.every((el) => el.mepKind === 'pipe' || el.length != null));

  if (isPipes && list.length > 0) {
    return groupPipesByDnAndLength(list, selectedSet);
  }

  if (
    (aggregate.key === 'equipmentCount' ||
      aggregate.key === 'valvesCount' ||
      aggregate.key === 'fittingsCount') &&
    list.length > 0
  ) {
    return groupByMarkFamilyType(list, selectedSet);
  }

  return list.map((el) => {
    const parts = elementLabelParts(el);
    return {
      key: el.id,
      ids: [el.id],
      mark: parts.mark,
      name: parts.name,
      meta: null,
      value: elementMetric(el, aggregate.unit),
      selected: selectedSet.has(el.id),
    };
  });
};

const AggregateBlock = ({
  aggregate,
  elements,
  selectedIds = null,
  highlightActive = false,
  onToggleHighlight,
  onSelectElement,
}: AggregateBlockProps) => {
  const rows = buildRows(aggregate, elements, selectedIds);

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
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                className={cx(
                  style.item,
                  row.selected && style.itemSelected,
                  !row.mark && style.itemNoMark,
                )}
                onClick={() => onSelectElement?.(row.ids)}
              >
                {row.mark ? <span className={style.itemMark}>{row.mark}</span> : null}
                <span className={style.itemName}>{row.name}</span>
                {row.meta ? <span className={style.itemMeta}>{row.meta}</span> : null}
                <span className={style.itemValue}>{row.value}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default AggregateBlock;
