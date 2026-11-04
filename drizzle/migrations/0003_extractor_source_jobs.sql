CREATE TABLE public.extractor_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_sha256 text NOT NULL UNIQUE CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  subject_id uuid,
  author text,
  rights_basis text NOT NULL DEFAULT 'unknown' CHECK (rights_basis IN ('unknown','own','licensed','public_domain')),
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','worker_not_configured','queued','processing','succeeded','failed','published')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  external_job_id text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  result jsonb,
  unit_decisions jsonb NOT NULL DEFAULT '{}'::jsonb,
  publish_report jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.extractor_jobs TO authenticated;
GRANT ALL ON public.extractor_jobs TO service_role;
ALTER TABLE public.extractor_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY extractor_jobs_admin_select ON public.extractor_jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY extractor_jobs_admin_insert ON public.extractor_jobs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE POLICY extractor_jobs_admin_update ON public.extractor_jobs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY extractor_sources_admin_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'extractor-sources' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY extractor_sources_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'extractor-sources' AND public.has_role(auth.uid(), 'admin'));