# Pathy Content Extractor — completion checklist (2026-11-07)

This is the canonical active sequence, retained in the app repo so the work is not lost.

## 1. Deploy Python Worker + connect HTTPS URL/token — DONE
- Cloud Run `pathy-extractor-worker` in `pathy-extractor-513715`, `europe-west3`.
- `/health` and bearer boundary passed staging verification.
- Pathy user configured server secrets; at least one live 5.25 MB source was subsequently processed.
- **Ops limit:** one always-allocated instance incurs ongoing costs; worker jobs live on ephemeral local storage and do not survive service restart.

## 2. Real E2E: upload → extraction → Supabase → UI — PARTIALLY ACCEPTED
- Actual book: `1881_Учебник-Русский-язык-10-11-класс-Гольцова-Шамшин-Мищерина-часть-1.pdf`.
- Pathy job `7aa99060-02c6-435d-87a9-743f3b207a7e`, status `published`.
- 91 materials published, 61 skipped, 7 failed publication due to `uniq_materials_dedup`.
- All 91 published materials have `topic_id = null`, so no topic-based lesson membership was verified; some OCR blocks are extremely short, requiring editorial review.
- Do **not** count this as completed educational E2E until lesson/route visibility and role access have been tested with a real signed-in user.

## 3. Automatic curricular linking — IN PROGRESS
- Keep conceptual **curriculum themes** separate from **exam question numbers** (ЕГЭ / ОГЭ).
- Admin and teacher must be able to create subjects' curricular themes without overwriting legacy topics.
- One published material may link to multiple topics; distinguish primary legacy `materials.topic_id` from additive `material_topic_links`.
- Use existing `topic_prerequisites` for prerequisites (currently empty); model further relations (related / assessed_by / reinforces) with explicit provenance and review, no guessed grading keys.
- Show actual published materials in an independent catalog; do not conflate with CSV/PCS imports, source registry, or community candidates.
- Confident automated link should require verifiable headings/structure, match the correct subject, and support review; never guess from a 1-character OCR fragment or assign the whole textbook to one EGE question.
- Validate in one real student lesson, then across a learning path. Do not auto-modify existing mastery, attempts, grading, teacher assignments, calendar or user history.

## 4. 201-case Review — PENDING
- Locate and provide the actual 201-case source-bound review file for the user's manual inspection.
- Import approved decisions safely preserving source SHA, unit IDs, raw OCR, author and timestamp.
- Do not invent or pre-accept human review decisions.

## 5. Independent quality & release gates — PENDING
- Independent optical/source sample validation including Doshinsky multi-column and answer table boundaries.
- Carry forward two previously unresolved edge cases.
- Resolve 7 duplicate-key publication errors without losing raw source units.
- Confirm supported formats, student/teacher/admin permissions, source provenance, idempotency, and topic/lesson/calendar E2E.
- Four historical ZIP archives are *not* release blockers; unpacked materials in repository supersede them.

## Release discipline
- Python extractor private repository and rules in GitHub are source of truth for parser changes.
- Pathy app repository `victortsatryan/oge-pathfinder-ai` holds UI/backend integrations.
- Never bulk reassign unrelated curriculum materials, generate graded tasks from unverified answers, or modify user progress.
