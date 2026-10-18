import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Title from '../../components/atoms/Title/Title';
import AggregateBlock from '../../components/molecules/AggregateBlock/AggregateBlock';
import PageContainer from '../../components/molecules/PageContainer/PageContainer';
import PhaseTimeline from '../../components/molecules/PhaseTimeline/PhaseTimeline';
import PropertyPanel from '../../components/molecules/PropertyPanel/PropertyPanel';
import SectionHeading from '../../components/molecules/SectionHeading/SectionHeading';
import { loadProjectBySlug } from '../../content/loadProjects';
import type { ModelAggregate, ModelPhase, ProjectLayer } from '../../content/types';
import { useMergedPropertiesIndexes } from '../../hooks/useMergedPropertiesIndexes';
import { cx } from '../../utils/cx';
import style from './ProjectDetail.module.css';

const ModelViewer = lazy(() => import('../../components/organisms/ModelViewer/ModelViewer'));
const SheetViewer = lazy(() => import('../../components/organisms/SheetViewer/SheetViewer'));

/** Листы (PNG+SVG hit). Включить, когда доработаем выравнивание оверлея. */
const ENABLE_SHEET_VIEWER = false;

const phaseParamKey = (layerId: string) => `phase_${layerId}`;

type LayerPhaseSelection = {
  mode: 'all' | 'none' | 'partial';
  indices: number[];
};

const parseLayerPhaseSelection = (
  searchParams: URLSearchParams,
  layerId: string,
  allIndices: number[],
): LayerPhaseSelection => {
  const allowed = new Set(allIndices);
  const raw = searchParams.getAll(phaseParamKey(layerId));
  if (raw.includes('none')) {
    return { mode: 'none', indices: [] };
  }
  const indices = [
    ...new Set(
      raw
        .map((v) => Number.parseInt(v, 10))
        .filter((n) => Number.isFinite(n) && allowed.has(n)),
    ),
  ].sort((a, b) => a - b);
  if (indices.length === 0) {
    return { mode: 'all', indices: allIndices };
  }
  if (
    indices.length === allIndices.length &&
    allIndices.every((i, idx) => indices[idx] === i)
  ) {
    return { mode: 'all', indices: allIndices };
  }
  return { mode: 'partial', indices };
};

/** Стадии, которые не показываем в 3D и в таймлайне */
const HIDDEN_PHASE_NAMES = new Set(['Новая конструкция']);

const KR_AGGREGATE_KEYS = ['concreteB25', 'concreteB75', 'curbsLength'] as const;
const TX_AGGREGATE_KEYS = [
  'equipmentCount',
  'valvesCount',
  'fittingsCount',
  'pipesLength',
] as const;
const AGGREGATE_ORDER = [...KR_AGGREGATE_KEYS, ...TX_AGGREGATE_KEYS] as const;

type SpecTabId = 'kr' | 'tx';

const isKrAggregateKey = (key: string) =>
  key.startsWith('concrete') || key === 'curbsLength';

const FALLBACK_LABELS: Record<string, { label: string; unit: string }> = {
  concreteB25: { label: 'Бетон B25', unit: 'м³' },
  concreteB75: { label: 'Бетон B7.5', unit: 'м³' },
  curbsLength: { label: 'Длина бордюров', unit: 'м' },
  pipesLength: { label: 'Длина трубопроводов', unit: 'м' },
  fittingsCount: { label: 'Фитинги', unit: 'шт.' },
  valvesCount: { label: 'Запорная арматура', unit: 'шт.' },
  equipmentCount: { label: 'Оборудование', unit: 'шт.' },
};

const resolveProjectLayers = (project: {
  layers?: ProjectLayer[];
  disciplines?: string[];
  modelUrl?: string;
  propertiesUrl?: string;
  demoScene?: boolean;
}): ProjectLayer[] => {
  if (project.layers?.length) return project.layers;
  const labels = project.disciplines?.length ? project.disciplines : ['КР'];
  return labels.map((label, i) => ({
    id: label.toLowerCase(),
    label,
    ...(i === 0
      ? {
          modelUrl: project.modelUrl,
          propertiesUrl: project.propertiesUrl,
          demoScene: project.demoScene,
        }
      : {}),
  }));
};

const ProjectDetail = () => {
  const { slug = '' } = useParams();
  const project = loadProjectBySlug(slug);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIds = searchParams.getAll('element');
  const selectedId = selectedIds[0] ?? null;
  const highlightKey = searchParams.get('highlight');

  const projectLayers = useMemo(
    () => (project ? resolveProjectLayers(project) : []),
    [project],
  );

  const propertyUrls = useMemo(() => {
    const fromLayers = projectLayers
      .map((l) => l.propertiesUrl)
      .filter((u): u is string => Boolean(u));
    if (fromLayers.length) return [...new Set(fromLayers)];
    return project?.propertiesUrl ? [project.propertiesUrl] : [];
  }, [projectLayers, project?.propertiesUrl]);

  const primaryPropertiesUrl = propertyUrls[0];

  const { data: index, loading: indexLoading, error: indexError } =
    useMergedPropertiesIndexes(propertyUrls);

  const selectedElement = useMemo(() => {
    if (!selectedId || !index) return null;
    return index.elements.find((el) => el.id === selectedId) ?? null;
  }, [selectedId, index]);

  const aggregates = useMemo((): ModelAggregate[] => {
    const fromIndex = index?.aggregates ?? [];
    const byKey = new Map(fromIndex.map((a) => [a.key, a]));
    const hasKr = fromIndex.some((a) => isKrAggregateKey(a.key));
    const txKeySet = new Set<string>(TX_AGGREGATE_KEYS);
    const hasTx = fromIndex.some((a) => txKeySet.has(a.key));

    return AGGREGATE_ORDER.map((key) => {
      const found = byKey.get(key);
      if (found) return found;
      const isKr = isKrAggregateKey(key);
      if (isKr && !hasKr) return null;
      if (!isKr && !hasTx) return null;
      const fb = FALLBACK_LABELS[key];
      return {
        key,
        label: fb.label,
        value: 0,
        unit: fb.unit,
        elementIds: [],
      };
    }).filter((a): a is ModelAggregate => Boolean(a));
  }, [index]);

  const krAggregates = useMemo(
    () => aggregates.filter((a) => isKrAggregateKey(a.key)),
    [aggregates],
  );
  const txAggregates = useMemo(
    () => aggregates.filter((a) => !isKrAggregateKey(a.key)),
    [aggregates],
  );

  const [specTab, setSpecTab] = useState<SpecTabId>('tx');

  useEffect(() => {
    if (krAggregates.length && !txAggregates.length) setSpecTab('kr');
    else if (txAggregates.length && !krAggregates.length) setSpecTab('tx');
  }, [krAggregates.length, txAggregates.length]);

  const visibleAggregates = specTab === 'kr' ? krAggregates : txAggregates;
  const showSpecTabs = krAggregates.length > 0 && txAggregates.length > 0;

  const highlightIds = useMemo(() => {
    if (!highlightKey || !index) return null;
    const agg = index.aggregates.find((a) => a.key === highlightKey);
    if (agg?.elementIds?.length) return agg.elementIds;
    return null;
  }, [highlightKey, index]);

  const groundElevationM = index?.ground?.elevationM ?? null;

  const hiddenElementIds = useMemo(() => {
    if (!index?.elements?.length) return null;
    const ids = index.elements
      .filter((el) => el.phase != null && HIDDEN_PHASE_NAMES.has(el.phase))
      .map((el) => el.id);
    return ids.length ? ids : null;
  }, [index]);

  const phaseIndexById = useMemo(() => {
    if (!index?.elements?.length) return null;
    const map: Record<string, number> = {};
    for (const el of index.elements) {
      if (el.phase != null && HIDDEN_PHASE_NAMES.has(el.phase)) continue;
      if (typeof el.phaseIndex === 'number') map[el.id] = el.phaseIndex;
    }
    return Object.keys(map).length ? map : null;
  }, [index]);

  const phasesByLayer = useMemo(() => {
    const map = new Map<string, ModelPhase[]>();
    if (!index?.phases?.length || !index.elements?.length) return map;
    const phaseByIndex = new Map(index.phases.map((p) => [p.index, p]));
    const usedByLayer = new Map<string, Set<number>>();

    for (const el of index.elements) {
      if (typeof el.phaseIndex !== 'number') continue;
      if (el.phase != null && HIDDEN_PHASE_NAMES.has(el.phase)) continue;
      const layerId = el.layer || 'default';
      let set = usedByLayer.get(layerId);
      if (!set) {
        set = new Set();
        usedByLayer.set(layerId, set);
      }
      set.add(el.phaseIndex);
    }

    for (const [layerId, used] of usedByLayer) {
      const phases = [...used]
        .map((i) => phaseByIndex.get(i))
        .filter(
          (p): p is ModelPhase =>
            Boolean(p) && !HIDDEN_PHASE_NAMES.has(p!.name),
        )
        .sort((a, b) => a.index - b.index);
      map.set(layerId, phases);
    }
    return map;
  }, [index]);

  const timelineLayers = useMemo(
    () =>
      projectLayers
        .map((layer) => ({
          id: layer.id,
          label: layer.label,
          phases: phasesByLayer.get(layer.id) ?? [],
        }))
        .filter((l) => l.phases.length > 0),
    [projectLayers, phasesByLayer],
  );

  const [activePhaseLayerId, setActivePhaseLayerId] = useState('');

  useEffect(() => {
    if (!timelineLayers.length) {
      setActivePhaseLayerId('');
      return;
    }
    if (!timelineLayers.some((l) => l.id === activePhaseLayerId)) {
      setActivePhaseLayerId(timelineLayers[0].id);
    }
  }, [timelineLayers, activePhaseLayerId]);

  const phaseSelectionByLayer = useMemo(() => {
    const result: Record<string, LayerPhaseSelection> = {};
    for (const layer of timelineLayers) {
      const allIndices = layer.phases.map((p) => p.index).sort((a, b) => a - b);
      result[layer.id] = parseLayerPhaseSelection(searchParams, layer.id, allIndices);
    }
    return result;
  }, [searchParams, timelineLayers]);

  const writeLayerPhaseParams = useCallback(
    (layerId: string, indices: number[] | 'all' | 'none') => {
      const key = phaseParamKey(layerId);
      const next = new URLSearchParams(searchParams);
      next.delete(key);
      next.delete('phase');
      if (indices === 'none') {
        next.append(key, 'none');
      } else if (indices !== 'all') {
        for (const n of [...indices].sort((a, b) => a - b)) {
          next.append(key, String(n));
        }
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const onTogglePhase = useCallback(
    (layerId: string, phaseIndex: number) => {
      const layer = timelineLayers.find((l) => l.id === layerId);
      if (!layer) return;
      const allIndices = layer.phases.map((p) => p.index).sort((a, b) => a - b);
      const selection = phaseSelectionByLayer[layerId] ?? {
        mode: 'all' as const,
        indices: allIndices,
      };

      if (selection.mode === 'all') {
        writeLayerPhaseParams(
          layerId,
          allIndices.filter((i) => i !== phaseIndex),
        );
        return;
      }
      const current = new Set(selection.indices);
      if (current.has(phaseIndex)) current.delete(phaseIndex);
      else current.add(phaseIndex);
      const next = [...current].sort((a, b) => a - b);
      if (next.length === 0) {
        writeLayerPhaseParams(layerId, 'none');
        return;
      }
      if (
        next.length === allIndices.length &&
        allIndices.every((i, idx) => next[idx] === i)
      ) {
        writeLayerPhaseParams(layerId, 'all');
        return;
      }
      writeLayerPhaseParams(layerId, next);
    },
    [timelineLayers, phaseSelectionByLayer, writeLayerPhaseParams],
  );

  const onToggleAll = useCallback(
    (layerId: string) => {
      const selection = phaseSelectionByLayer[layerId];
      writeLayerPhaseParams(layerId, selection?.mode === 'all' ? 'none' : 'all');
    },
    [phaseSelectionByLayer, writeLayerPhaseParams],
  );

  const visiblePhasesByLayer = useMemo(() => {
    if (!timelineLayers.length) return null;
    const map: Record<string, number[] | null> = {};
    let allFullyOn = true;
    for (const layer of timelineLayers) {
      const sel = phaseSelectionByLayer[layer.id];
      if (!sel || sel.mode === 'all') {
        map[layer.id] = null;
      } else if (sel.mode === 'none') {
        map[layer.id] = [];
        allFullyOn = false;
      } else {
        map[layer.id] = sel.indices;
        allFullyOn = false;
      }
    }
    return allFullyOn ? null : map;
  }, [timelineLayers, phaseSelectionByLayer]);

  const activePhaseSelection = phaseSelectionByLayer[activePhaseLayerId] ?? {
    mode: 'all' as const,
    indices: [] as number[],
  };

  const allLayerIds = useMemo(() => projectLayers.map((l) => l.id), [projectLayers]);

  const layerSelection = useMemo(() => {
    const allowed = new Set(allLayerIds);
    const raw = searchParams.getAll('layer');
    if (raw.includes('none')) {
      return { mode: 'none' as const, ids: [] as string[] };
    }
    const ids = [...new Set(raw.filter((id) => allowed.has(id)))];
    if (ids.length === 0) {
      return { mode: 'all' as const, ids: allLayerIds };
    }
    if (ids.length === allLayerIds.length && allLayerIds.every((id) => ids.includes(id))) {
      return { mode: 'all' as const, ids: allLayerIds };
    }
    return { mode: 'partial' as const, ids };
  }, [searchParams, allLayerIds]);

  const writeLayerParams = useCallback(
    (ids: string[] | 'all' | 'none') => {
      const next = new URLSearchParams(searchParams);
      next.delete('layer');
      if (ids === 'none') {
        next.append('layer', 'none');
      } else if (ids !== 'all') {
        for (const id of ids) next.append('layer', id);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const onToggleLayer = useCallback(
    (layerId: string) => {
      if (layerSelection.mode === 'all') {
        writeLayerParams(allLayerIds.filter((id) => id !== layerId));
        return;
      }
      const current = new Set(layerSelection.ids);
      if (current.has(layerId)) current.delete(layerId);
      else current.add(layerId);
      const next = [...current];
      if (next.length === 0) {
        writeLayerParams('none');
        return;
      }
      if (next.length === allLayerIds.length && allLayerIds.every((id) => next.includes(id))) {
        writeLayerParams('all');
        return;
      }
      writeLayerParams(next);
    },
    [layerSelection, allLayerIds, writeLayerParams],
  );

  const visibleLayerIds = useMemo(() => {
    if (layerSelection.mode === 'all') return null;
    if (layerSelection.mode === 'none') return [];
    return layerSelection.ids;
  }, [layerSelection]);

  const viewerLayers = useMemo(
    () =>
      projectLayers.map((l) => ({
        id: l.id,
        modelUrl: l.modelUrl,
        demoScene: l.demoScene,
      })),
    [projectLayers],
  );

  const groundElementIds = useMemo(() => {
    if (!index || groundElevationM != null) return [];
    const textOf = (el: {
      mark?: string | null;
      comment?: string | null;
      family?: string | null;
      category?: string | null;
      type?: string | null;
    }) => [el.mark, el.comment, el.family, el.category, el.type].filter(Boolean).join(' ');
    const apronIds = index.elements
      .filter((el) => /отмостк/i.test(textOf(el)))
      .map((el) => el.id);
    if (apronIds.length) return apronIds;
    const curbIds = index.aggregates.find((a) => a.key === 'curbsLength')?.elementIds ?? [];
    const curbFallback = index.elements
      .filter((el) => /борд|поребрик|curb/i.test(textOf(el)))
      .map((el) => el.id);
    return [...new Set([...curbIds, ...curbFallback])];
  }, [index, groundElevationM]);

  const onSelect = useCallback(
    (elementId: string | null) => {
      const next = new URLSearchParams(searchParams);
      next.delete('element');
      if (elementId) next.append('element', elementId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const onToggleHighlight = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('element');
    if (next.get('highlight') === key) next.delete('highlight');
    else next.set('highlight', key);
    setSearchParams(next, { replace: true });
  };

  const onSelectFromList = (ids: string[]) => {
    const next = new URLSearchParams(searchParams);
    next.delete('element');
    for (const id of ids) next.append('element', id);
    next.delete('highlight');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!project) return;
    document.title = `${project.title} — BIM Portfolio`;
  }, [project]);

  if (!project) {
    return (
      <PageContainer>
        <SectionHeading eyebrow="Проекты" title="Проект не найден" align="left" />
        <p className={style.meta}>
          Проверьте адрес или вернитесь к{' '}
          <Link to="/" className={style.backInline}>
            списку проектов
          </Link>
          .
        </p>
        <button type="button" className={style.backBtn} onClick={() => navigate('/')}>
          К списку проектов
        </button>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className={style.hero}>
        <Link to="/" className={style.back}>
          ← Все проекты
        </Link>

        <div className={style.titleRow}>
          <span className={style.projectEyebrow}>Проект</span>
          <div className={style.projectTitleRow}>
            <Title level={2} className={style.projectTitle}>
              {project.title}
            </Title>
            {projectLayers.length > 0 && (
              <div className={style.layerToggles} role="group" aria-label="Слои модели">
                {projectLayers.map((layer) => {
                  const active =
                    layerSelection.mode === 'all' || layerSelection.ids.includes(layer.id);
                  const hasModel = Boolean(layer.modelUrl || layer.demoScene);
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      className={cx(style.layerBtn, active && style.layerBtnActive)}
                      onClick={() => onToggleLayer(layer.id)}
                      aria-pressed={active}
                      title={
                        hasModel
                          ? `Показать / скрыть слой ${layer.label}`
                          : `${layer.label}: геометрия будет добавлена`
                      }
                    >
                      {layer.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className={style.workspace}>
          <div className={style.phases}>
            <PhaseTimeline
              layers={timelineLayers}
              activeLayerId={activePhaseLayerId || timelineLayers[0]?.id || ''}
              onActiveLayerChange={setActivePhaseLayerId}
              selectedPhaseIndices={activePhaseSelection.indices}
              selectionMode={activePhaseSelection.mode}
              onTogglePhase={onTogglePhase}
              onToggleAll={onToggleAll}
            />
          </div>
          <div className={style.viewer}>
            {primaryPropertiesUrl && indexLoading ? (
              <div className={style.viewerFallback}>Загрузка 3D-вьюера…</div>
            ) : (
              <Suspense fallback={<div className={style.viewerFallback}>Загрузка 3D-вьюера…</div>}>
                <ModelViewer
                  key={
                    groundElevationM != null
                      ? `elev:${groundElevationM}`
                      : groundElementIds.join('|') || 'default'
                  }
                  layers={viewerLayers}
                  modelUrl={project.modelUrl}
                  demoScene={project.demoScene}
                  selectedId={selectedId}
                  selectedIds={selectedIds.length ? selectedIds : null}
                  highlightIds={highlightIds}
                  phaseIndexById={phaseIndexById}
                  visiblePhasesByLayer={visiblePhasesByLayer}
                  visibleLayerIds={visibleLayerIds}
                  groundElevationM={groundElevationM}
                  groundElementIds={groundElementIds}
                  hiddenIds={hiddenElementIds}
                  onSelect={onSelect}
                />
              </Suspense>
            )}
          </div>
          <div className={style.side}>
            <PropertyPanel element={selectedElement} onClose={() => onSelect(null)} />
          </div>
        </div>
      </div>

      <div className={style.details}>
        <div className={style.metaRow}>
          {project.address && <span className={style.meta}>{project.address}</span>}
          {project.stage && <span className={style.meta}>{project.stage}</span>}
          {project.modelUpdatedAt && (
            <span className={style.meta}>Модель обновлена: {project.modelUpdatedAt}</span>
          )}
          {index?.exportedAt && (
            <span className={style.meta}>
              Индекс: {new Date(index.exportedAt).toLocaleString('ru-RU')}
            </span>
          )}
        </div>

        {indexLoading && <p className={style.meta}>Загрузка свойств модели…</p>}
        {indexError && <p className={style.error}>Индекс свойств: {indexError}</p>}

        {ENABLE_SHEET_VIEWER && project.sheets && project.sheets.length > 0 && (
          <section className={style.sheets}>
            <SectionHeading eyebrow="Документация" title="Листы" align="left" />
            <Suspense fallback={<p className={style.meta}>Загрузка листов…</p>}>
              <SheetViewer
                sheets={project.sheets}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            </Suspense>
          </section>
        )}

        {aggregates.length > 0 && (
          <section className={style.specs}>
            <div className={style.specsHeader}>
              <span className={style.specsEyebrow}>Модель</span>
              <div className={style.specsTitleRow}>
                <Title level={2} className={style.specsTitle}>
                  Спецификации
                </Title>
                {showSpecTabs && (
                  <div className={style.specTabs} role="tablist" aria-label="Раздел спецификации">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={specTab === 'kr'}
                      className={cx(style.specTab, specTab === 'kr' && style.specTabActive)}
                      onClick={() => setSpecTab('kr')}
                    >
                      КР
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={specTab === 'tx'}
                      className={cx(style.specTab, specTab === 'tx' && style.specTabActive)}
                      onClick={() => setSpecTab('tx')}
                    >
                      ТХ
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className={style.aggregates}>
              {visibleAggregates.map((aggregate) => (
                <AggregateBlock
                  key={aggregate.key}
                  aggregate={aggregate}
                  elements={index?.elements ?? []}
                  selectedIds={selectedIds.length ? selectedIds : null}
                  highlightActive={highlightKey === aggregate.key}
                  onToggleHighlight={() => onToggleHighlight(aggregate.key)}
                  onSelectElement={onSelectFromList}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </PageContainer>
  );
};

export default ProjectDetail;
