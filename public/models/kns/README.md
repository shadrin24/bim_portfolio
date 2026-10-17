# Модель КНС

| Файл | Назначение |
|------|------------|
| `properties.json` | Индекс КР |
| `model.glb` | Геометрия КР |
| `properties-tx.json` | Индекс ТХ |
| `model-tx.glb` | Геометрия ТХ |
| `cover.png` | Обложка |
| `sheets/kr/*.png` | Вид листа КР (штамп, аннотации, виды) |
| `sheets/kr/*.svg` | Hit-оверлей КР (`data-element-id`) |
| `sheets/tx/*.png` | Вид листа ТХ |
| `sheets/tx/*.svg` | Hit-оверлей ТХ |

`elements[].id` = Revit `UniqueId` = имя mesh в glb = `data-element-id` на SVG.

Экспорт: pyRevit **Vodnal → BIM Web → «Лист»** → раздел КР/ТХ → выбор листов из списка (`bim_web_sheet.py`).
