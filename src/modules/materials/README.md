# Module: materials

Шаг 4. Материалы и задания. См. `ARCHITECTURE.md`.

## Сущности (БД)

- `materials` — теория, видео, статьи, схемы, упражнения, разборы.
  Связаны с `subject_id`, `program_id?`, `topic_id?`, `learning_objective_id?`.
- `material_tags` — свободные теги.
- `tasks` (существующая) — расширена `title`, `source_name`,
  `estimated_time_minutes`, `program_id`.
- `task_solutions` — пошаговые/видео разборы заданий.
- `tests` — универсальные тесты (diagnostic, practice, weekly, …).
- `test_tasks` — связка теста с заданиями.

## Серверные функции

`src/lib/materials.functions.ts`:
- `listMaterials({ subject_id?, topic_id?, material_type?, search? })`
- `getTopicOverview({ topic_id })` — материалы + задания + тесты темы.
- `getRecommendedMaterials({ topic_id, mastery_score? })` — подбор по
  уровню освоения:
  - `<30` → теория + видео + параграф + схема (сложность ≤2)
  - `30–70` → теория + упражнения + статьи (сложность ≤3)
  - `>70` → упражнения + тесты + разборы (сложность ≤5)
- `listSubjectsForFilter()` — для фильтра в `/student/materials`.

## Экраны

- `/student/materials` — каталог материалов с фильтрами.
- `/student/topics/$topicId` — учебная страница темы: рекомендации,
  материалы по типам, задания, тесты.

## Источники

Хранятся `source_name` + `source_url`. Контент внешних сайтов
не копируется — только ссылки и метаданные. Внутренние материалы могут
хранить `content_text`.

## Связь с диагностикой

`diagnostic_tests` остаётся для существующего движка диагностики.
Новые `tests` — общий контейнер. Постепенный переезд: на следующем шаге
диагностический сценарий будет собираться из общей `tests` + `test_tasks`.
