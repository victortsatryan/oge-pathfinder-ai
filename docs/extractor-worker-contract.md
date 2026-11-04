# Pathy Content Extractor worker — HTTP contract expected by Pathy

The Python repository (victortsatryan/pathy-content-extractor, branch fix/doshinsky-structure-lexical-20261104) is private and was NOT readable from the Pathy build environment. This contract is what Pathy's server adapter (`src/lib/extractor/jobs.functions.ts`) calls. A thin HTTP wrapper around the existing Python CLI must implement it; the extractor code itself is not changed.

Secrets (Project Settings → Secrets): `PATHY_EXTRACTOR_API_URL`, `PATHY_EXTRACTOR_API_TOKEN`. Without them jobs get status `worker_not_configured` and nothing is processed.

## POST {URL}/v1/jobs
`Authorization: Bearer <token>`, multipart: `file`, `source_sha256`, `pathy_job_id`, optional `author`.
Response 2xx: `{ "job_id": "..." }`.

## GET {URL}/v1/jobs/{job_id}
Response: `{ "status": "queued|running|succeeded|failed", "progress": 0..100 or 0..1, "error"?: string, "result"?: {...} }`.
`result` holds the Canonical JSON. Units are read from `result.units`, `result.canonical.units` or `result.canonical_json.units`. Per unit Pathy reads: `unit_id`, `title`, `kind`, `content_text`, `pages[]`, `source.author`, `review_status`, `needs_structure_review`, `confidence` (or `quality.confidence`), `issues[]`/`flags[]`, `answer`/`correct_answer`, `topic_id`, `explanation`. The full unit is kept as provenance in `materials.extractor_metadata.original_unit`.

## Classification
Confident = has id/title/text/pages, no structure-review flag, review_status not in needs_review/needs_structure_review/low_confidence/conflict/unresolved/ocr_conflict, confidence ≥ 0.85 when given, no issues. Others need an admin Accept/Reject. A task is created only with explicit answer + existing topic_id.
