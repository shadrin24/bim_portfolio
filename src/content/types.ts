export type Partner = {
  name: string;
  logo?: string;
};

export type PartnersContent = {
  items: Partner[];
};

export type Review = {
  id: string;
  quote: string;
  author: string;
  position: string;
  company: string;
};

export type ReviewsContent = {
  items: Review[];
};

export type Stat = {
  value: number;
  suffix?: string;
  label: string;
};

export type StatsContent = {
  items: Stat[];
};

export const WhyUsIconKey = {
  Clock: 'clock',
  Shield: 'shield',
  Price: 'price',
} as const;

export type WhyUsIconKey = (typeof WhyUsIconKey)[keyof typeof WhyUsIconKey];

export type WhyUsFeature = {
  icon: WhyUsIconKey;
  title: string;
  items: string[];
};

export type WhyUsContent = {
  eyebrow: string;
  title: string;
  features: WhyUsFeature[];
};

export type HomeSection1Content = {
  title: string;
  subtitle: string;
  subtitleVariant: 'default' | 'white';
  tagline: string;
  image: string;
};

export type HomeSection2Content = {
  title: string;
  subtitle: string;
  descriptions: string[];
  image: string;
};

export type HomeSection3Content = {
  title: string;
  descriptions: string[];
};

export type HomeContent = {
  section1: HomeSection1Content;
  section2: HomeSection2Content;
  section3: HomeSection3Content;
};

export const ServiceIconKey = {
  Design: 'design',
  Pump: 'pump',
  Wrench: 'wrench',
  Document: 'document',
  Gear: 'gear',
  Automation: 'automation',
} as const;

export type ServiceIconKey = (typeof ServiceIconKey)[keyof typeof ServiceIconKey];

export type Service = {
  title: string;
  description?: string;
  icon?: ServiceIconKey;
};

export type ServicesContent = {
  eyebrow: string;
  title: string;
  descriptions: string[];
  items: Service[];
};

export type EquipmentItem = {
  name: string;
  description: string;
  logo?: string;
  certificate?: string;
};

export type EquipmentContent = {
  eyebrow: string;
  title: string;
  descriptions: string[];
  items: EquipmentItem[];
};

export type ScheduleRow = {
  days: string;
  hours: string;
};

export type ContactsContent = {
  eyebrow: string;
  title: string;
  address: string;
  email: string;
  phone: string;
  schedule: ScheduleRow[];
  mapEmbedUrl?: string;
};

export const ProjectDiscipline = {
  AR: 'АР',
  KR: 'КР',
  OV: 'ОВ',
  VK: 'ВК',
  TX: 'ТХ',
} as const;

export type ProjectDiscipline = (typeof ProjectDiscipline)[keyof typeof ProjectDiscipline];

/** Слой модели (КР, ТХ, …) — включаются вместе или по отдельности */
export type ProjectLayer = {
  id: string;
  label: string;
  modelUrl?: string;
  propertiesUrl?: string;
  demoScene?: boolean;
};

export type ProjectKpi = {
  label: string;
  value: number;
  unit?: string;
  /** Ключ агрегата из properties.json (например concreteFoundationsVolume) */
  aggregateKey?: string;
};

/** Лист Revit: растр всего листа + SVG hit-оверлей (`data-element-id` = UniqueId) */
export type ProjectSheet = {
  id: string;
  title: string;
  number?: string;
  /** PNG всего листа (штамп, аннотации, виды) */
  imageUrl: string;
  /** Прозрачный SVG-оверлей для клика по элементам модели */
  svgUrl: string;
  /** Слой модели: kr | tx */
  layer?: string;
};

export type Project = {
  slug: string;
  /** Полное название объекта (после пароля) */
  title: string;
  /** Публичное название без привязки к объекту (до пароля) */
  publicTitle?: string;
  address?: string;
  stage?: string;
  disciplines?: ProjectDiscipline[];
  /** Слои 3D (КР / ТХ). Если нет — используется modelUrl проекта как один слой */
  layers?: ProjectLayer[];
  cover?: string;
  description?: string;
  modelUpdatedAt?: string;
  /** Путь к геометрии, например /models/kns-pilot/model.glb */
  modelUrl?: string;
  /** Путь к индексу свойств, например /models/kns-pilot/properties.json */
  propertiesUrl?: string;
  /** Режим демо-геометрии three.js, если glTF ещё не выгружен */
  demoScene?: boolean;
  /** Запасные KPI (если нет индекса или для превью в списке) */
  kpis?: ProjectKpi[];
  /** Листы документации (SVG с кликабельными UniqueId) */
  sheets?: ProjectSheet[];
};

export type ModelElement = {
  id: string;
  /** Раздел строкой: КР, ТХ, … */
  section?: string | null;
  /** Внутренний id слоя для viewer: kr | tx */
  layer?: string | null;
  category: string;
  family?: string;
  type?: string;
  level?: string;
  /** Стадия создания (PHASE_CREATED) */
  phase?: string | null;
  /** Индекс стадии в документе: больше = позже; в списках сортируем убыванию */
  phaseIndex?: number | null;
  material?: string;
  /** Нормализованная марка бетона: B25, B7.5, … */
  concreteGrade?: string | null;
  volume?: number;
  /** Длина, м (бордюры / трубопроводы) */
  length?: number | null;
  /** Диаметр, мм (ТХ) */
  diameterMm?: number | null;
  /** Имя системы (ТХ) */
  system?: string | null;
  /** pipe | fitting | valve | equipment | other */
  mepKind?: string | null;
  mark?: string;
  comment?: string;
  params?: Record<string, string | number | boolean | null>;
};

export type ModelPhase = {
  index: number;
  name: string;
};

export type ModelAggregate = {
  key: string;
  label: string;
  value: number;
  unit?: string;
  /** Элементы, входящие в агрегат — для списка и подсветки в 3D */
  elementIds?: string[];
};

/** Отметка земли из Levels Revit — та же ось Y (м), что в model.glb */
export type ModelGround = {
  levelName: string;
  elevationM: number;
};

export type PropertiesIndex = {
  exportedAt: string;
  source?: string;
  /** Раздел выгрузки строкой (КР, ТХ) */
  section?: string | null;
  /** kr | tx | merged */
  layer?: string | null;
  ground?: ModelGround | null;
  /** Стадии документа по порядку Revit (последняя = max index) */
  phases?: ModelPhase[];
  elements: ModelElement[];
  aggregates: ModelAggregate[];
};
