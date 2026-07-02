# Pathy Studio v1 — план

Внутренний админ-модуль для загрузки образовательного контента в формате **PCS (Pathy Content Schema)** через JSON-файлы. Доступ только для роли `admin`.

## 1. Область работ

Новый раздел `/admin/content` с подстраницами:
- **Dashboard** — счётчики + последние импорты
- **Import** — загрузка PCS JSON, preview, валидация, коммит
- **Programs** — дерево программы (класс → предмет → раздел → тема → подтема → LO)
- **Learning Objectives** — плоский список с фильтрами
- **История импортов** — таблица `content_imports`

Существующая `/admin` (импорт материалов CSV) остаётся — Studio живёт рядом как отдельный модуль.

## 2. Схема БД (миграция)

Проверю фактическую схему `topics`, `learning_objectives`, `materials` (`supabase--read_query`), но по плану ожидается:

**Новые/расширенные таблицы:**
- `subject_sections` — раздел предмета (subject_id, program_id, title, order_index)
- `topics` — уже есть, добавить `parent_topic_id`, `section_id`, `pcs_key` если нет
- `learning_objectives` — есть; добавить `pcs_key`, `pcs_version`, `theory`, `algorithm`, `status` (draft/reviewed/published/archived), `version`
- `lo_examples` — примеры (learning_objective_id, title, statement, solution, order_index)
- `task_patterns` — шаблоны заданий (learning_objective_id, pattern_key, statement_template, answer_schema jsonb, difficulty, hints jsonb, order_index)
- `lo_sources` — источники (learning_objective_id, source_name, url, license, citation)
- `lo_diagnostic_settings` — диагностика (learning_objective_id, min_tasks, mastery_threshold, difficulty_curve jsonb)
- `content_imports` — id, filename, imported_by, imported_at, pcs_version, status, rows_created/updated/failed, error_log jsonb

Для каждой таблицы: GRANT authenticated+service_role, RLS enabled, policy `has_role(auth.uid(),'admin')` для write; для read — либо authenticated (публичное дерево программ), либо admin-only.

## 3. PCS JSON — контракт

Zod-схема в `src/lib/pcs/schema.ts`:

```ts
{
  schema_version: "1.0",
  pcs_version: string,
  education_system: string,       // напр. "RU"
  grade: number,                  // 11
  program: { key, title },
  subject: { key, title },
  section: { key, title, order? },
  topic: { key, title, order? },
  subtopic: { key, title, order? },
  learning_objective: {
    key, title, version?, status?,
    theory: string,               // markdown
    algorithm?: string,
  },
  examples?: [{ title?, statement, solution, order? }],
  task_patterns: [{ key, statement_template, answer_schema, difficulty?, hints? }],
  materials?: [{ type, title, url?, content_text?, source_name?, license_note? }],
  sources?: [{ name, url?, citation?, license? }],
  diagnostic?: { min_tasks?, mastery_threshold?, difficulty_curve? },
}
```

## 4. Server functions (`src/lib/pcs/pcs.functions.ts`)

Все с `requireSupabaseAuth` + admin-check через `has_role` RPC.

- `pcsDashboardCounts()` — счётчики.
- `pcsPreviewImport({ json })` — парсит через Zod, резолвит существующие сущности по `pcs_key`, возвращает `{ ok, summary, willCreate, willUpdate, conflicts, errors }`. Ничего не пишет.
- `pcsRunImport({ json, mode: 'update'|'new_version'|'skip' })` — в одной транзакции (через RPC `pcs_import`, plpgsql-функция) upsert-ит program → subject → section → topic → subtopic → LO, затем перезаписывает examples/task_patterns/sources/diagnostic (delete+insert внутри той же транзакции), пишет `content_imports`. Ошибка → rollback (RAISE EXCEPTION).
- `pcsListImports({ limit=20 })`.
- `pcsProgramTree()` — иерархия для дерева.
- `pcsGetLearningObjective({ id })` — карточка LO с examples/patterns/sources/diagnostic.
- `pcsListLearningObjectives({ filters })`.

Транзакцию делаю через RPC (`create function pcs_import(payload jsonb) returns jsonb language plpgsql security definer` с проверкой `has_role(auth.uid(),'admin')` внутри). Server fn просто вызывает RPC и логирует в `content_imports`.

## 5. UI

Роуты:
- `src/routes/_authenticated.admin.content.tsx` — layout с admin-check + sidebar (Dashboard / Импорт / Программы / LO / История)
- `_authenticated.admin.content.index.tsx` — Dashboard
- `_authenticated.admin.content.import.tsx` — drag-drop + preview + commit
- `_authenticated.admin.content.programs.tsx` — дерево (`Collapsible` из shadcn)
- `_authenticated.admin.content.objectives.tsx` — список LO
- `_authenticated.admin.content.objectives.$loId.tsx` — карточка (read-only)
- `_authenticated.admin.content.history.tsx` — таблица импортов

Пункт «Content Studio» появится в текущем `/admin` dashboard.

## 6. Что НЕ делаю (по ТЗ)

Ручной JSON-редактор, PDF/DOCX/URL импорт, Content Extractor, AI-генерация, редакторы теории/заданий.

## 7. Порядок выполнения

1. Прочитать актуальную схему `topics`/`learning_objectives`/`materials`/`subjects`/`subject_programs` в БД.
2. Создать миграцию (новые таблицы + расширения + RPC `pcs_import` + `content_imports` + GRANT/RLS).
3. Zod-схема PCS + server functions.
4. Роуты и UI.
5. Пример PCS JSON в `docs/pcs-example.json` для быстрого теста.
6. Smoke-тест через Playwright: залогиниться под admin, залить пример, проверить дерево и карточку LO.

Продолжать?
