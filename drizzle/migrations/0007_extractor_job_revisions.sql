ALTER TABLE public.extractor_jobs ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.extractor_jobs ADD COLUMN IF NOT EXISTS parent_job_id uuid NULL REFERENCES public.extractor_jobs(id) ON DELETE RESTRICT;
ALTER TABLE public.extractor_jobs ADD COLUMN IF NOT EXISTS worker_rule_version text NULL;
ALTER TABLE public.extractor_jobs ADD CONSTRAINT extractor_jobs_revision_check CHECK (revision >= 1);
-- Revision 1 is the root upload; every later revision points to its root.
ALTER TABLE public.extractor_jobs ADD CONSTRAINT extractor_jobs_revision_parent_check CHECK ((revision = 1) = (parent_job_id IS NULL));
-- Reprocess revisions are audit-only: they can never enter publishing.
ALTER TABLE public.extractor_jobs ADD CONSTRAINT extractor_jobs_revision_no_publish_check CHECK (revision = 1 OR status NOT IN ('publishing', 'published'));
ALTER TABLE public.extractor_jobs ADD CONSTRAINT extractor_jobs_file_sha256_revision_key UNIQUE (file_sha256, revision);
ALTER TABLE public.extractor_jobs DROP CONSTRAINT IF EXISTS extractor_jobs_file_sha256_key;
CREATE INDEX IF NOT EXISTS extractor_jobs_parent_job_id_idx ON public.extractor_jobs(parent_job_id);
COMMENT ON COLUMN public.extractor_jobs.revision IS 'Processing revision of the same source SHA; 1 = original upload, >1 = admin reprocess (never publishable without separate approval).';
COMMENT ON COLUMN public.extractor_jobs.worker_rule_version IS 'Worker OCR correction version verified via GET /health before dispatch of a reprocess revision.';