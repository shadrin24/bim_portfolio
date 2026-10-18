# BIM Portfolio

Lean Vite + React портфолио: на главной — **карточки проектов**, клик открывает 3D с свойствами, листами и KPI.

## Запуск

```bash
npm install
npm run dev
```

- `/` — список проектов  
- `/proekty/kns` — **Типовая КНС** (стадии КР/ТХ, 3D, листы, свойства, KPI)

## Данные модели

`public/models/kns/` — `model.glb`, `model-tx.glb`, `properties.json`, `properties-tx.json`, `icon.png`, `sheets/kr|tx/*`.

Новый проект: добавьте `src/content/projects/<slug>.json` и ассеты в `public/models/<slug>/`.

### Листы

В JSON `sheets[]`:

```json
{
  "id": "kr-01",
  "number": "КР-01",
  "title": "План",
  "layer": "kr",
  "imageUrl": "/models/kns/sheets/kr/kr-01.png",
  "svgUrl": "/models/kns/sheets/kr/kr-01.svg"
}
```

- **PNG** — весь лист как в Revit (штамп, аннотации, виды).
- **SVG** — прозрачный hit-оверлей: `data-element-id="<UniqueId>"` для клика ↔ 3D (`?element=`).

## Выгрузка листа из Revit

Кнопка pyRevit: **Vodnal → BIM Web → «Лист»**.

1. Укажите раздел **КР** или **ТХ**.
2. Отметьте листы в списке (мультивыбор).
3. Выберите папку (`bim_portfolio / kns` и т.п.).
4. Файлы: `sheets/<kr|tx>/<номер>.png` + `.svg`.
5. Добавьте записи в `sheets[]` проекта (алерт кнопки печатает готовый JSON).

Логика: `Vodnal.extension/lib/bim_web_sheet.py`.

## Сборка

```bash
npm run build
npm run preview
```
