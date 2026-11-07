# Extractor drafts
- [x] Add validated local JSON preview with explicit errors and duplicate detection.
- [x] Add admin-only staging storage and idempotent per-unit batch import.
- [x] Show saved drafts, OCR decisions, source rights and read-only existing links.
- [x] Verify focused tests, authenticated UI, permissions and build; commit changes.

# Extractor v0.6 final integration verification
- [x] Read-only audit live schema, RLS, storage, roles and worker configuration.
- [x] Reproduce and minimally fix confirmed result-contract failures; 56 isolated tests passed.
- [x] Verify preview without writes; record live vs mock limitations and commit.
- [ ] Live Python worker E2E — blocked by absent worker URL/token and deployment; no production job created.