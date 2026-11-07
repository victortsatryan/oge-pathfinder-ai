# Extractor v0.6 final verification — 2026-11-07

## Live read-only observations
- Worker configuration: `PATHY_EXTRACTOR_API_URL=false`, `PATHY_EXTRACTOR_API_TOKEN=false` both in the configured project secret listing and sandbox server environment. No health request was attempted without configuration; no job was created.
- RLS enabled (not FORCE RLS) on all four extractor tables. Jobs/units: admin-only SELECT/INSERT/UPDATE policies; no DELETE policy. Decisions: admin-only ALL. Staging: admin-only SELECT/INSERT, draft/private constraints, no UPDATE/DELETE policy.
- Actual jobs/units grants are broader than checked-in grant blocks: anon/authenticated have SELECT/INSERT/UPDATE/DELETE privileges, but RLS has no anon policies and restricts authenticated callers to admins. Not changed. Decisions exclude anon; staging excludes anon and authenticated UPDATE/DELETE.
- Storage `extractor-sources` is private, maximum 167,772,160 bytes (160 MiB), no MIME allowlist. Object INSERT/SELECT require admin role and exact bucket. All other object policies were inspected and are scoped to different buckets; no alternative extractor access policy found. No UPDATE/DELETE policy for this bucket.
- Unique job source SHA; unique `(job_id, unit_id)` with FK cascade to jobs; staging identity `unit_id`; decisions identity `(source_sha256, decision_id)`. Material stable extractor key has a unique expression index.
- Before and after checks: jobs 0, job units 0, source objects 0, old decisions 912, staging drafts 2. No production writes, migrations, grant changes, user creation, deployment or publication performed.
- Authenticated owner's upload page loads at `/admin/content/upload`, shows worker not configured and an empty job list. No runtime page errors. Signed-out preview does not expose admin job data. The frontend still offers dev-open navigation, but extractor server operations always require validated bearer claims and admin `has_role`; no dev bypass was found in those operations.

## Confirmed code issues and minimal corrections
- Unknown worker states previously silently became queued; now rejected.
- Result parser previously silently dropped damaged entries and accepted missing/invalid source SHA, invalid totals, missing IDs and cross-source units. Now rejected before ingestion.
- Pagination now validates contiguous offsets, bounded page size and stable totals using the actual cursor/source expected by the server handler.
- Publication rechecks each unit source identity, handles concurrent unique-key duplicate inserts as existing, and refuses completion if the pending-count query fails. No existing materials/tasks are updated.
- The unused grading helper previously returned true for a purported grading flag plus answer. It now always denies v0.6 grading authority; the actual publisher already inserts only learning materials.

## Automated validation (isolated, not LIVE E2E)
Run `bunx vitest run --config vitest.extractor.config.ts`.
- Final result: 56 tests across 5 files passed; `oj typecheck -b --noEmit` passed.
- Existing pipeline and staging-schema tests retained.
- Six regression cases were run before the fix and failed as expected, then passed after correction.
- Contract tests: format, malformed payload, source/unit SHA, stable identity, pagination gaps/totals, known rights, declared file extensions including explicit HTML rejection, grading denial.
- Actual auth middleware tested with mocked request and claims verifier: absent/malformed bearer and invalid claims deny in dev. This is not a live token-verification test.
- Actual job/review/publication handler bodies tested with mocked RPC wrapper, in-memory database and mocked worker HTTP: student/teacher role denial before writes, unknown-rights denial, disconnected-worker status, flagged gate, corrected vs original text, teacher-private exclusion, attribution, publication in two batches, replay idempotency, and two result pages (45 units) with replay.
- These tests invoke the real handler bodies but intentionally do not exercise hosted RPC serialization, live database transactions/RLS or the real Python service. Test config excludes the app RPC compiler so handlers stay callable in isolation; unexpected tables fail, all HTTP is stubbed.
- Preview harness reports build OK after code edits; no manual build or deployment was run.

## Format and downstream limits
- Declared accepted extensions: PDF/DOCX/TXT/MD/XLSX/CSV/PNG/JPG/JPEG. HTML is rejected. Per-format real extraction is untested without the Python service. DOCX/XLSX header validation identifies ZIP, not full document validity; text checks reject NUL only.
- SHA of the full source is calculated in browser and passed to the worker. Pathy checks object size/header and returned identity; actual worker download/hash enforcement is not tested here.
- `publishExtractorJob` creates standalone `materials` with `topic_id=null`; attribution and related-unit IDs are metadata. `/material/$materialId` is the signed-in reading screen. Topic-based lesson assembly in `src/lib/lesson.functions.ts` selects materials by topic and separate published tasks. Extractor output has no automatic topic/task/lesson/calendar linkage; no graded tasks are created.
- Live student/teacher RLS denial and live anonymous API denial were not exercised with separate accounts. The live policies were inspected; role/auth behavior is covered in isolation. No personal accounts were created.

## Live E2E blockers
Worker URL/token and reachable deployment are absent. No actual worker code/result/source is available in this checkout. Health, download/hash verification, real extraction, hosted result pagination, real review/publication through Cloud and the full 435-page source remain untested. No LIVE E2E PASS is claimed.