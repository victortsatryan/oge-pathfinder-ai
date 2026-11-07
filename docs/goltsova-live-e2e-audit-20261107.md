# Live Goltsova E2E audit — 2026-11-07

- Source job: `7aa99060-02c6-435d-87a9-743f3b207a7e`.
- Source OCR SHA-256: `5eebab6c023971fc733c59b258c5cedaf76b2764c4e1353b1bb7a75927acf589`.
- Original extraction 159 units: 91 published, 61 skipped, 7 unique-title conflicts.
- Audit: five duplicate one-character `|` units, one short line beginning `1`, one repeated 33-character exception. All seven shorter than 100 characters and unsuitable as independent classroom materials. Their raw rows and original error explanations are preserved; reclassified as `skipped` with `audit_excluded_short_or_duplicate_ocr` in the `publish_error` field.
- Reconciled report: 91 published, 68 skipped, 0 failed. All original 159 units remain in `extractor_job_units`.
- 39/91 published source rows are shorter than 100 characters; 3/91 longer than 12,000. Quality flags added to existing `extractor_metadata` without changing original raw content, visibility, or student progress: 39 `needs_review_short_ocr`, 3 `needs_review_merged_sections`, 49 `source_ocr_unverified`.
- Source-bound headings in merged OCR: approximately 18 distinct paragraph numbers from §§1–15, 30, 32 and 54. Contradictory headings, truncated headings or sections out of safe size bounds must remain unlinked pending editorial review. Only reproducible high-confidence paragraph boundaries are automatically linked.
- Fixes in code: preserve unique source units via `extractor_metadata.unit_key`, stop treating identical OCR headings as global duplicates, propagate an explicit OCR quality flag, present an automatic § segmentation preview and create a curriculum topic + linked textbook paragraph for each eligible section. The app must never generate graded answer keys from this material.
- Verification limits: database queries prove originals and publication report persisted. An interactive role-specific end-to-end upload and student lesson/view requires actual signed-in application test. Do not mark the entire release fully accepted on database queries alone.
- Rights check: the job was tagged `public_domain` by the publishing operator, but the OCR shows a 2014 copyright notice. Legal permission to distribute the source must be verified separately; the database value does **not** establish public-domain status.
