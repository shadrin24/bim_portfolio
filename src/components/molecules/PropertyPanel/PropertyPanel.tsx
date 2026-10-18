import type { ModelElement } from '../../../content/types';
import style from './PropertyPanel.module.css';

type PropertyPanelProps = {
  element: ModelElement | null;
  onClose?: () => void;
};

const isFilled = (value: string | number | boolean | null | undefined) => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

const isTxElement = (element: ModelElement) =>
  element.layer === 'tx' || element.section === 'ТХ' || element.section === 'TX';

const rows = (element: ModelElement) => {
  const sectionLabel =
    element.section ??
    (element.layer === 'tx' ? 'ТХ' : element.layer === 'kr' ? 'КР' : element.layer);
  const isTx = isTxElement(element);

  const candidates: Array<{ label: string; value: string | null | undefined }> = [
    { label: 'Раздел', value: sectionLabel },
    { label: 'Категория', value: element.category },
    { label: 'Семейство', value: element.family },
    { label: 'Тип', value: element.type },
    { label: 'Уровень', value: element.level },
    { label: 'Материал', value: element.material },
    { label: 'Марка бетона', value: element.concreteGrade },
    {
      label: 'Длина',
      value: element.length != null ? `${element.length} м` : null,
    },
    {
      label: 'Диаметр',
      value: element.diameterMm != null ? `${element.diameterMm} мм` : null,
    },
    { label: 'Марка', value: element.mark },
    { label: 'Комментарий', value: element.comment },
  ];

  if (!isTx) {
    candidates.splice(
      5,
      0,
      { label: 'Система', value: element.system },
      {
        label: 'Объём',
        value: element.volume != null ? `${element.volume} м³` : null,
      },
    );
  }

  const items = candidates
    .filter((row) => isFilled(row.value))
    .map((row) => ({ label: row.label, value: String(row.value).trim() }));

  if (element.params) {
    for (const [key, value] of Object.entries(element.params)) {
      if (!isFilled(value)) continue;
      if (isTx && /^(объ[её]м|volume|система|system)$/i.test(key.trim())) continue;
      items.push({ label: key, value: String(value).trim() });
    }
  }

  return items;
};

const PropertyPanel = ({ element, onClose }: PropertyPanelProps) => (
  <aside className={style.panel} aria-label="Свойства элемента">
    <div className={style.header}>
      <h3 className={style.title}>{element ? element.mark || element.type || element.id : 'Свойства'}</h3>
      {onClose && (
        <button type="button" className={style.close} onClick={onClose} aria-label="Закрыть панель">
          ×
        </button>
      )}
    </div>

    {!element ? (
      <p className={style.empty}>Кликните по элементу модели, чтобы увидеть свойства.</p>
    ) : (
      <dl className={style.list}>
        {rows(element).map((row) => (
          <div key={row.label} className={style.row}>
            <dt className={style.label}>{row.label}</dt>
            <dd className={style.value}>{row.value}</dd>
          </div>
        ))}
      </dl>
    )}
  </aside>
);

export default PropertyPanel;
