ALTER TABLE public.extractor_job_units ADD COLUMN IF NOT EXISTS reviewed_text text;
ALTER TABLE public.extractor_job_units ADD COLUMN IF NOT EXISTS review_choice text CHECK (review_choice IN ('accept_corrected','keep_original','reject'));
ALTER TABLE public.extractor_job_units ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.extractor_job_units ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.extractor_job_units ADD CONSTRAINT extractor_job_units_corrected_has_text CHECK (review_choice IS DISTINCT FROM 'accept_corrected' OR length(btrim(coalesce(reviewed_text,''))) > 0);