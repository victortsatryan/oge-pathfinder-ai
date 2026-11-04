# Pathy ↔ Pathy Content Extractor v0.6 worker contract

Implementation on the worker side: `pathy_extractor/worker_service_v06.py` + `integration_export_v06.py`
(branch `fix/doshinsky-structure-lexical-20261104`, `Dockerfile.worker`). Pathy side:
`src/lib/extractor/jobs.functions.ts` (server only) and `src/lib/extractor/pipeline.ts`.

## Configuration (Pathy secrets, server only)
- `PATHY_EXTRACTOR_API_URL` — external `https://` base URL (localhost / http rejected).
- `PATHY_EXTRACTOR_API_TOKEN` — sent as `Authorization: Bearer <token>` on every request.
Without them jobs get status `worker_not_configured`; nothing is simulated. Every call has a 20 s timeout.

## 1. Create job — `POST /v1/jobs` (`application/json`, no multipart)
```json
{ "job_id": "<Pathy extractor_jobs.id>", "source_url": "<signed HTTPS URL, 3600 s>", "source_sha256": "<64 hex>", "filename": "<original name>" }
```
Pathy creates the URL with `storage.from("extractor-sources").createSignedUrl(storage_path, 3600)`.
The worker downloads the file itself and must verify `source_sha256`. Pathy never downloads the full file.
Response `202`: `{ job_id, status: "queued", stage: "queued", source_sha256, filename, units: null, error: null }`.
Pathy requires `job_id` to equal the one it sent.

## 2. Status — `GET /v1/jobs/{job_id}`
`{ job_id, status: "queued"|"running"|"succeeded"|"failed", stage, source_sha256, filename, units: <summary>|null, error }`.
There is no `result` field.

## 3. Result pages — `GET /v1/jobs/{job_id}/result?offset=N&limit=40` (limit ≤ 50)
```json
{ "format": "pathy-extraction-result-v1", "source": { "sha256": "...", "filename": "..." },
  "summary": { "total_units": 1450 }, "units": [ { "unit_id", "kind", "material_type", "title", "content_text", "pages",
  "source", "review_status": "needs_review|auto_extracted_unverified", "review_reasons": [], "requires_manual_review": false,
  "usable_for_learning": true, "usable_for_grading": false, "role": "student_material|teacher_private",
  "related_unit_ids": [], "answer": null } ], "next_offset": 40, "source_provenance": {}, "policy": {} }
```
Pathy pulls up to 8 pages per poll (status `fetching_result`), stores units in `extractor_job_units`
(unique `job_id, unit_id`), checks `source.sha256` on every page, and marks the job `succeeded` only when
`next_offset = null` and the stored count equals `summary.total_units`. Otherwise `failed`.

## Pathy rules
- `role != "student_material"` (e.g. `teacher_private`) → never published, admin "accept" cannot override.
- `usable_for_learning != true` or empty text → not published.
- `requires_manual_review`, `review_status = needs_review`, any `review_reasons`, or no pages → admin review.
- Everything else publishes as a learning material without manual review (source label, "not verified for grading").
- No graded tasks are created: v0.6 sends `usable_for_grading: false`, `answer: null`.
- Author only from `unit.source.author` or the admin's input; never a default.
- Material identity: `extractor_metadata.unit_key = "<source sha256>:<unit_id>"`; `related_unit_ids` kept in metadata.
- Publication runs in batches of 30 per call (client loops), idempotent, only INSERTs; rights basis must be known.
- Materials are visible only to signed-in Pathy users.

## Upload
Browser computes SHA-256, uploads via resumable TUS (6 MB chunks) to the private bucket (limit 160 MB) at
`<sha256>/<name>`. Server checks path/SHA prefix, object size and magic bytes (first 512 bytes), not the full hash.
