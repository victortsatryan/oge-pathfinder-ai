-- Extracted PDF material belongs to the established Pathy materials library.
-- Keep source-bound metadata without changing visibility of existing rows.
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS extractor_metadata jsonb;

COMMENT ON COLUMN public.materials.extractor_metadata IS
  'Original Extractor unit, source SHA-256, page anchors, and manual-review status. Import never authorizes publication.';

CREATE UNIQUE INDEX IF NOT EXISTS materials_extractor_unit_unique
  ON public.materials ((extractor_metadata ->> 'unit_id'))
  WHERE (extractor_metadata ->> 'unit_id') IS NOT NULL;

-- Existing RLS remains in force. No public grants or policy relaxation.
