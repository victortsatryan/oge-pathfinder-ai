# Pathy Content Extractor — completion checklist (updated 2026-11-08)

This is the canonical active sequence, retained in the app repo so the work is not lost.

## 1. Deploy Python Worker + connect HTTPS URL/token — DONE
- Cloud Run `pathy-extractor-worker` in `pathy-extractor-513715`, `europe-west3`.
- `/health` and bearer boundary passed staging verification.
- Pathy user configured server secrets; at least one live 5.25 MB source was subsequently processed.
- **Ops limit:** one always-allocated instance incurs ongoing costs; worker jobs live on ephemeral local storage and do not survive service restart.

## 2. Real E2E: upload → extraction → Supabase → UI — TECHNICAL PIPELINE ACCEPTED; ROLE UI RECEIPT OPEN
- Actual book: `1881_Учебник-Русский-язык-10-11-класс-Гольцова-Шамшин-Мищерина-часть-1.pdf`.
- Pathy job `7aa99060-02c6-435d-87a9-743f3b207a7e`, status `published`.
- 91 original materials published, 68 skipped, **0 failed** after source-bound dedup audit; all 159 raw source units preserved. Source-key uniqueness replaces OCR title collision.
- All 91 source OCR blocks retain their original classification/IDs; 39 short and 3 oversized blocks are flagged for editorial quality review. 14 additional conservatively segmented paragraphs remain published, but the 14 automatically-created OCR-heading topics and their links were **retracted** after methodology correction; all original topic IDs and audit metadata were preserved. Four ambiguous numbered paragraphs await review.
- Actual upload, worker processing, Supabase persistence, publication, database creation and historical provenance are proven; live, post-approval canonical topic→material links remain to be demonstrated. Teacher/admin/student live UI visibility, production publish revision and authenticated lesson rendering still need a real signed-in acceptance receipt; do not conflate technical E2E with final release acceptance.

## 3. Curriculum integration — WORKING CATALOG READY; METHODOLOGY APPROVAL & FINAL E2E OPEN
- Keep conceptual **curriculum themes** separate from **exam question numbers** (ЕГЭ / ОГЭ).
- Admin and teacher must be able to create subjects' curricular themes without overwriting legacy topics.
- One published material may link to multiple topics; distinguish primary legacy `materials.topic_id` from additive `material_topic_links`.
- Use existing `topic_prerequisites` for prerequisites (currently empty); model further relations (related / assessed_by / reinforces) with explicit provenance and review, no guessed grading keys.
- Show actual published materials in an independent catalog; do not conflate with CSV/PCS imports, source registry, or community candidates.
- **Revised rule:** source headings/notes/exercises NEVER create new curriculum topics. 224 normalized draft topics in 11 sections are seeded from Russian federal working programmes for grades 1–11, with broader grade bands and unapproved aliases. This is an editor-normalized draft, not a verbatim official codifier or validated year-by-year syllabus. See `docs/ru-curriculum-methodology-v01.md`.
- Admin-only approval per theme. Automatic mapping uses only exact, unambiguous matches with an APPROVED existing topic; all OCR typos, ambiguous matches, and draft-only matches await review.
- The 14 Goltsova source sections currently have `topic_id=null`, their false links were removed, and original OCR and provenance remain unchanged. No active learner lesson depends on those old links.
- New routes accept only approved source-linked topics (never raw OCR headings); **no** topic has yet been methodologically approved. Exam question mappings and prerequisite graph are future methodological work.
- After approving and mapping a known sample topic, validate in one real signed-in student lesson, then generate a new learning path. Existing 78 lessons were deliberately untouched: no retrospective user-progress changes. Never auto-modify existing mastery, attempts, grading, teacher assignments, calendar or user history.

## 4. 201-case Review — PENDING
- Locate and provide the actual 201-case source-bound review file for the user's manual inspection.
- Import approved decisions safely preserving source SHA, unit IDs, raw OCR, author and timestamp.
- Do not invent or pre-accept human review decisions.

## 5. Independent quality & release gates — PENDING
- Independent optical/source sample validation including Doshinsky multi-column and answer table boundaries.
- Carry forward two previously unresolved edge cases.
- Seven duplicate-key publication errors reconciled into audited, preserved skipped units; verify repeat-upload/idempotency as final smoke gate.
- Confirm supported formats, student/teacher/admin permissions, source provenance, idempotency, and topic/lesson/calendar E2E.
- Four historical ZIP archives are *not* release blockers; unpacked materials in repository supersede them.

## Copyright/provenance caution
- Goltsova OCR includes a 2014 copyright notice while the job was marked `public_domain`. This database label alone is **not** evidence of public-domain status. Verify authorization to distribute before public release.

## Release discipline
- Python extractor private repository and rules in GitHub are source of truth for parser changes.
- Pathy app repository `victortsatryan/oge-pathfinder-ai` holds UI/backend integrations.
- Never bulk reassign unrelated curriculum materials, generate graded tasks from unverified answers, or modify user progress.
