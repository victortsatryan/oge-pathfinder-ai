-- Keep historical subject IDs, topics, student progress, and materials intact.
-- The current release subject is "Русский язык"; the legacy generic "Русский"
-- must not appear as a second choice in subject selectors.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.subjects
    WHERE id = '8ee8190d-fd18-4a08-916a-7f8258c3cd7e'::uuid
      AND name = 'Русский язык' AND is_public = true
  ) THEN
    RAISE EXCEPTION 'Canonical Russian language subject missing; refusing to archive legacy subject';
  END IF;

  UPDATE public.subjects
  SET is_public = false
  WHERE id = '22222222-2222-4222-8222-222222222222'::uuid
    AND name = 'Русский'
    AND is_public = true;
END $$;
