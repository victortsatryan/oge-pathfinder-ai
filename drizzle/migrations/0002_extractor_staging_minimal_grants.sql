REVOKE ALL ON public.extractor_staging_units FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.extractor_staging_units FROM authenticated;
GRANT SELECT, INSERT ON public.extractor_staging_units TO authenticated;
GRANT ALL ON public.extractor_staging_units TO service_role;