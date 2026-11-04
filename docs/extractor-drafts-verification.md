# Extractor drafts — verification, 2026-11-04

## Scope
- Existing Pathy project only. New `/admin/content/extractor` tab inside the existing Studio shell.
- PCS import page and `src/lib/pcs/*` unchanged.
- Immutable `extractor_staging_units`, not materials/tasks/topics. Original JSON payload retained; no OCR rewriting or publishing.
- Format discriminator: `format: "pathy-extractor-audit-staging-v1"`. Source hash accepted as `source.sha256` or `source.source_sha256`; pages are a nonempty array of positive integers. Unsupported shapes produce explicit errors, not silent conversions. No real Extractor v0.6 file was supplied, so exact compatibility with its emitted field shapes remains unverified.
- Global unique unit_id. Identical original payload is `existing`; changed payload with same id is `failed`, with no overwrite. SHA and pages preserved and included in comparison. Duplicate ids inside the uploaded file all fail.
- Admin-confirmed import inserts each unit independently. Batch limit 20, split additionally by bytes; server cap 3 MB per batch. Oversize individual units are reported as failed.
- RPC errors are visible. Network interruption can leave saved units; re-preview resolves their status safely.

## Confirmed
- Harness reports `build OK`, including type validation.
- 15 focused validation/batching tests pass.
- Authenticated administrator: valid+invalid JSON preview -> explicit confirmation -> persisted draft read back -> original payload/link inspection -> same file repeat reports existing=1, failed=1. No page errors.
- Desktop 1280px and mobile 390px checked; no horizontal overflow on mobile.
- 912 manual decisions: text_layer=850, ocr=46, custom=16, unresolved=0. Displayed as decisions, not applied edits.
- Two sources displayed with unapproved status and rights warnings.
- Staging SELECT/INSERT RLS uses `has_role(auth.uid(), 'admin')`; insert checks current importer identity and private draft state. No UPDATE/DELETE policies. Minimal grants enforced by follow-up migration after effective privileges showed platform defaults.
- Actual PCS code unchanged; PCS runtime import not executed to avoid changing educational content.

## Limits and test artifacts
- Two clearly titled synthetic service drafts remain in private staging (`pathy-extractor-smoke-20261104-1` and `...-2`), never in educational content. Not deleted, per non-destructive workflow.
- Non-admin access is enforced by server guard and verified database policies/grants; a separate non-admin session was not minted for an end-to-end denial check.
- Link inspection resolves only explicit top-level `topic_id` / `task_id` UUIDs and related teacher assignments; name similarity never creates a link. No real linked Extractor sample supplied.

## Concrete files
- `src/routes/_authenticated.admin.content.tsx` — added navigation only.
- `src/routes/_authenticated.admin.content.extractor.tsx` — access, upload, preview, per-unit report, saved originals, source/OCR display and read-only links.
- `src/lib/extractor/schema.ts` — input validation, duplicate/hash helpers, batching.
- `src/lib/extractor/extractor.functions.ts` — admin-only preview, import and reads.
- `tests/extractor-schema.test.ts` — safety rules.
- `drizzle/migrations/0001_extractor_private_draft_staging.sql`, `0002_extractor_staging_minimal_grants.sql` — private staging and permissions.
- Generated migration metadata, `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts`.
- `package.json`, `bun.lockb` — test runner dependency.
- `AGENTS.md`, `roadmap.md`, this verification document.