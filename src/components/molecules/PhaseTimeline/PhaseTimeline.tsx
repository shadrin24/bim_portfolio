import type { ModelPhase } from '../../../content/types';
import { cx } from '../../../utils/cx';
import style from './PhaseTimeline.module.css';

export type PhaseTimelineLayer = {
  id: string;
  label: string;
  phases: ModelPhase[];
};

type PhaseTimelineProps = {
  layers: PhaseTimelineLayer[];
  activeLayerId: string;
  onActiveLayerChange: (layerId: string) => void;
  /** Выбранные стадии активного слоя; при mode=all все выглядят выделенными */
  selectedPhaseIndices: number[];
  /** all — вся модель слоя; none — ничего; partial — selectedPhaseIndices */
  selectionMode: 'all' | 'none' | 'partial';
  onTogglePhase: (layerId: string, index: number) => void;
  onToggleAll: (layerId: string) => void;
};

const PhaseTimeline = ({
  layers,
  activeLayerId,
  onActiveLayerChange,
  selectedPhaseIndices,
  selectionMode,
  onTogglePhase,
  onToggleAll,
}: PhaseTimelineProps) => {
  const active = layers.find((l) => l.id === activeLayerId) ?? layers[0];
  const phases = active?.phases ?? [];
  const layerId = active?.id ?? activeLayerId;

  if (!layers.length) {
    return (
      <section className={style.panel} aria-label="Стадии строительства">
        <div className={style.header}>
          <h3 className={style.heading}>Стадии</h3>
        </div>
        <p className={style.empty}>В индексе нет стадий — выгрузите properties.json заново.</p>
      </section>
    );
  }

  const ordered = [...phases].sort((a, b) => a.index - b.index);
  const selected = new Set(selectedPhaseIndices);
  const showAll = selectionMode === 'all';
  const isPhaseActive = (index: number) => showAll || selected.has(index);

  return (
    <section className={style.panel} aria-label="Стадии строительства">
      <div className={style.header}>
        <h3 className={style.heading}>Стадии</h3>
        {layers.length > 1 && (
          <div className={style.tabs} role="tablist" aria-label="Раздел стадий">
            {layers.map((layer) => {
              const activeTab = layer.id === layerId;
              return (
                <button
                  key={layer.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab}
                  className={cx(style.tab, activeTab && style.tabActive)}
                  onClick={() => onActiveLayerChange(layer.id)}
                >
                  {layer.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!ordered.length ? (
        <p className={style.empty}>Нет стадий для {active?.label ?? 'слоя'}.</p>
      ) : (
        <ul className={style.list} role="tabpanel">
          <li className={style.item}>
            <button
              type="button"
              className={cx(style.btn, showAll && style.btnActive)}
              onClick={() => onToggleAll(layerId)}
              aria-pressed={showAll}
            >
              Вся модель
            </button>
          </li>
          {ordered.map((phase) => (
            <li key={`${layerId}-${phase.index}`} className={style.item}>
              <button
                type="button"
                className={cx(style.btn, isPhaseActive(phase.index) && style.btnActive)}
                onClick={() => onTogglePhase(layerId, phase.index)}
                aria-pressed={isPhaseActive(phase.index)}
              >
                {phase.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default PhaseTimeline;
