# Plan: Admin Materials Upload System for Pathy.ai

## Scope
Build an admin-only system to upload and structure school materials (CSV/JSON import + manual form), wired into the existing `materials` / `subjects` / `topics` / `learning_objectives` schema. No user-facing upload or sharing.

## 1. Database migration

Single migration covering:

### `materials` — verify/extend
Existing table has 20 cols. Add any missing fields from spec:
- `grade text`, `language text default 'ru'`, `license_type text`, `license_note text`, `image_url text`, `source_name text`, `estimated_time_minutes int`, `status text default 'draft'` (constrained to `draft|reviewed|published|archived`).
- Ensure FKs: `subject_id`, `program_id → subject_programs`, `topic_id`, `learning_objective_id`.
- Unique-ish dedup index: `(subject_id, topic_id, lower(title), coalesce(source_url,''))`.

### `content_sources` — new
Fields per spec. GRANTs + RLS:
- `SELECT` to `authenticated` (read approved sources).
- `ALL` to admins via `has_role(auth.uid(),'admin')`.

### `content_import_logs` — new
Fields per spec. RLS: only admins read/write.

### App role
Confirm `app_role` enum has `admin`. If not present, add. (Existing `has_role` function already exists.)

## 2. Server functions (`src/lib/admin-materials.functions.ts`)

All gated by `requireSupabaseAuth` + admin role check via `has_role` RPC.

- `previewImport({ rows })` — parse rows, resolve subject/program/topic/subtopic/LO (create-if-missing in dry-run = false; in preview mode just count). Returns `{ toCreate, toUpdate, toSkip, errors, sample }`.
- `runImport({ rows, fileName, format })` — for each row:
  1. upsert subject by title
  2. upsert program by (subject, title)
  3. upsert topic by (subject, title); subtopic as child topic with `parent_topic_id` (use existing topics table — check if parent col exists, else store subtopic as topic with note)
  4. upsert learning_objective by (topic, title)
  5. dedup material by `(subject_id, topic_id, lower(title), source_url)` → insert or update
  6. accumulate counts, errors
  7. write `content_import_logs` row
- `listImportLogs()` — admin list.
- `createMaterialManual(input)` — single insert with the same resolution logic.
- `listContentSources()` / `upsertContentSource()`.

## 3. Admin UI

New route group `src/routes/_authenticated/admin/...`:
- `admin.tsx` — layout, checks `has_role('admin')` client-side; redirects non-admins.
- `admin.materials.import.tsx` — file picker (CSV/JSON), preview table (first 10 rows), summary card (create/update/skip/errors), "Import" button, import history table below.
- `admin.materials.new.tsx` — manual form (all spec fields, cascading selects for subject→program→topic→LO).
- `admin.sources.tsx` — list/create content sources.

Add admin entry in the user menu (visible only if admin).

CSV parsing: use `papaparse` (add via `bun add papaparse @types/papaparse`).

## 4. Lessons / AI integration (light wiring)

- Existing `src/lib/materials.functions.ts`: ensure `listMaterialsForTopic` filters `status = 'published'`. Add empty-state hint in student materials route.
- AI prompt builders (`oge-ai.functions.ts` / `oge-assistant.functions.ts`): when fetching context for a topic, pull `published` materials first; if none, instruct AI to say "в базе нет подходящих материалов".

(Deep AI/lesson refactor out of scope — minimal hooks only.)

## 5. Out of scope (this step)
- MVP content seeding (section 15) — provide CSV template + docs; bulk content load is a follow-up.
- Public sharing, user uploads.
- File storage uploads (PDF/image upload UI) — only URL references for now; storage bucket can come later.

## Technical notes
- Subtopics: existing `topics` table is flat. Use `parent_topic_id` if column exists; otherwise add it in this migration (`topics.parent_topic_id uuid references topics(id)`).
- Admin check pattern: server-side `has_role(userId,'admin')` RPC inside every admin server fn; client-side hide UI via a `useIsAdmin()` hook calling a small `amIAdmin` server fn.
- Import runs synchronously per request; large files chunked client-side into batches of 200 rows before calling `runImport`.

Proceed?