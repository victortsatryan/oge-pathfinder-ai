ALTER TABLE public.external_diagnostic_results
ADD COLUMN IF NOT EXISTS task_details JSONB NOT NULL DEFAULT '[]'::jsonb;