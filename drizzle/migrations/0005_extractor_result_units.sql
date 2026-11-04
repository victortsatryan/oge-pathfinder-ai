ALTER TABLE public.extractor_jobs DROP CONSTRAINT IF EXISTS extractor_jobs_status_check;
ALTER TABLE public.extractor_jobs ADD CONSTRAINT extractor_jobs_status_check CHECK (status IN ('uploaded','worker_not_configured','queued','processing','fetching_result','succeeded','failed','publishing','published'));
ALTER TABLE public.extractor_jobs ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.extractor_jobs ADD COLUMN IF NOT EXISTS result_next_offset integer;
ALTER TABLE public.extractor_jobs ADD COLUMN IF NOT EXISTS result_total_units integer;
ALTER TABLE public.extractor_jobs ADD COLUMN IF NOT EXISTS result_summary jsonb;

CREATE TABLE public.extractor_job_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.extractor_jobs(id) ON DELETE CASCADE,
  unit_id text NOT NULL,
  position integer NOT NULL,
  raw jsonb NOT NULL,
  publish_state text NOT NULL DEFAULT 'pending' CHECK (publish_state IN ('pending','published','existing','skipped','failed')),
  publish_error text,
  material_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, unit_id)
);
CREATE INDEX extractor_job_units_job_pos ON public.extractor_job_units(job_id, position);
GRANT SELECT, INSERT, UPDATE ON public.extractor_job_units TO authenticated;
GRANT ALL ON public.extractor_job_units TO service_role;
ALTER TABLE public.extractor_job_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY extractor_job_units_admin_select ON public.extractor_job_units FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY extractor_job_units_admin_insert ON public.extractor_job_units FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY extractor_job_units_admin_update ON public.extractor_job_units FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));