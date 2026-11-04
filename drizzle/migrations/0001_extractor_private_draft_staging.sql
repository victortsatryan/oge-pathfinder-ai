CREATE TABLE public.extractor_staging_units (
 unit_id text PRIMARY KEY,
 source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
 source_pages jsonb NOT NULL,
 kind text NOT NULL,
 title text NOT NULL,
 content_text text NOT NULL,
 payload jsonb NOT NULL,
 payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
 is_public boolean NOT NULL DEFAULT false CHECK (is_public = false),
 imported_by uuid NOT NULL,
 imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.extractor_staging_units TO authenticated;
GRANT ALL ON public.extractor_staging_units TO service_role;
ALTER TABLE public.extractor_staging_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY extractor_staging_admin_read ON public.extractor_staging_units FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY extractor_staging_admin_insert ON public.extractor_staging_units FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND imported_by = auth.uid() AND status = 'draft' AND is_public = false);
CREATE INDEX extractor_staging_source_pages ON public.extractor_staging_units(source_sha256);
COMMENT ON TABLE public.extractor_staging_units IS 'Private immutable Extractor audit drafts; no automatic material, topic, task or assignment creation. OCR decisions are not applied to payload.';