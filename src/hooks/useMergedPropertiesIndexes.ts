import { useEffect, useMemo, useState } from 'react';
import type { ModelAggregate, ModelElement, ModelPhase, PropertiesIndex } from '../content/types';

/** Ключи-счётчики: после склейки пересчитываем из объединённых элементов */
const RECOMPUTE_AGG_KEYS = new Set(['levelsCount', 'elementsCount']);

const mergeAggregates = (
  parts: PropertiesIndex[],
  elements: ModelElement[],
): ModelAggregate[] => {
  const byKey = new Map<string, ModelAggregate>();

  for (const part of parts) {
    for (const agg of part.aggregates ?? []) {
      if (RECOMPUTE_AGG_KEYS.has(agg.key)) continue;
      const prev = byKey.get(agg.key);
      if (!prev) {
        byKey.set(agg.key, {
          ...agg,
          elementIds: [...(agg.elementIds ?? [])],
        });
        continue;
      }
      const ids = [...new Set([...(prev.elementIds ?? []), ...(agg.elementIds ?? [])])];
      byKey.set(agg.key, {
        ...prev,
        value: Number(((prev.value ?? 0) + (agg.value ?? 0)).toFixed(3)),
        elementIds: ids,
      });
    }
  }

  const levels = new Set(elements.map((e) => e.level).filter(Boolean));
  byKey.set('levelsCount', {
    key: 'levelsCount',
    label: 'Уровни',
    value: levels.size,
    unit: '',
    elementIds: [],
  });
  byKey.set('elementsCount', {
    key: 'elementsCount',
    label: 'Элементов в индексе',
    value: elements.length,
    unit: 'шт.',
    elementIds: [],
  });

  return [...byKey.values()];
};

/**
 * Склейка КР + ТХ.
 * Индексы фаз в разных RVT пересекаются — унифицируем по имени и ремапим phaseIndex у элементов.
 */
const mergeIndexes = (parts: PropertiesIndex[]): PropertiesIndex | null => {
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];

  const phaseByName = new Map<string, ModelPhase>();
  const elementsById = new Map<string, ModelElement>();
  let ground = parts[0].ground ?? null;
  let exportedAt = parts[0].exportedAt;
  const sources: string[] = [];
  let nextPhaseIndex = 0;

  for (const part of parts) {
    if (part.exportedAt && part.exportedAt > exportedAt) exportedAt = part.exportedAt;
    if (part.source) sources.push(part.source);
    if (part.ground?.elevationM != null) ground = part.ground;

    const localToGlobal = new Map<number, number>();
    for (const ph of part.phases ?? []) {
      const existing = phaseByName.get(ph.name);
      if (existing) {
        localToGlobal.set(ph.index, existing.index);
        continue;
      }
      const global: ModelPhase = { name: ph.name, index: nextPhaseIndex };
      nextPhaseIndex += 1;
      phaseByName.set(ph.name, global);
      localToGlobal.set(ph.index, global.index);
    }

    for (const el of part.elements ?? []) {
      const phaseIndex =
        typeof el.phaseIndex === 'number'
          ? (localToGlobal.get(el.phaseIndex) ?? el.phaseIndex)
          : el.phaseIndex;
      elementsById.set(el.id, {
        ...el,
        phaseIndex,
        layer: el.layer ?? part.layer ?? null,
        section: el.section ?? part.section ?? null,
      });
    }
  }

  const elements = [...elementsById.values()];
  const phases = [...phaseByName.values()].sort((a, b) => a.index - b.index);

  return {
    exportedAt,
    source: sources.join(' | '),
    section: 'merged',
    layer: 'merged',
    ground,
    phases,
    elements,
    aggregates: mergeAggregates(parts, elements),
  };
};

const fetchOptionalIndex = async (url: string): Promise<PropertiesIndex | null> => {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as PropertiesIndex;
};

/** Загрузка и склейка нескольких properties*.json (КР + ТХ). 404 пропускается. */
export const useMergedPropertiesIndexes = (urls: string[]) => {
  const key = urls.join('|');
  const [fetched, setFetched] = useState<{ key: string; parts: PropertiesIndex[] } | null>(
    null,
  );
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    if (!urls.length) return;
    let cancelled = false;
    const list = key.split('|').filter(Boolean);

    Promise.all(list.map((url) => fetchOptionalIndex(url)))
      .then((results) => {
        if (cancelled) return;
        const parts = results.filter((p): p is PropertiesIndex => Boolean(p));
        if (!parts.length) {
          setFailed({ key, message: 'Нет доступных properties*.json' });
          setFetched(null);
          return;
        }
        setFetched({ key, parts });
        setFailed(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFailed({
            key,
            message: err instanceof Error ? err.message : 'Ошибка загрузки индекса',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const data = useMemo(() => {
    if (!urls.length) return null;
    if (fetched?.key !== key) return null;
    return mergeIndexes(fetched.parts);
  }, [fetched, key, urls.length]);

  if (!urls.length) {
    return { data: null, loading: false, error: null };
  }

  const error = failed?.key === key ? failed.message : null;
  const loading = !data && !error;

  return { data, loading, error };
};
