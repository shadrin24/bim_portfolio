# BIM Portfolio

Lean Vite + React портфолио: на главной — **карточки проектов**, клик открывает 3D с свойствами и KPI.

## Запуск

```bash
npm install
npm run dev
```

- `/` — список проектов  
- `/proekty/kns` — **Типовая КНС** (стадии КР/ТХ, 3D, свойства, KPI)

## Данные модели

`public/models/kns/` — `model.glb`, `model-tx.glb`, `properties.json`, `properties-tx.json`, `cover.png`.

Новый проект: добавьте `src/content/projects/<slug>.json` и ассеты в `public/models/<slug>/`.

## Сборка

```bash
npm run build
npm run preview
```
