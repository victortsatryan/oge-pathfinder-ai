
-- 1. Extend materials
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS license_type text,
  ADD COLUMN IF NOT EXISTS license_note text,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'materials_status_check') THEN
    ALTER TABLE public.materials
      ADD CONSTRAINT materials_status_check
      CHECK (status IN ('draft','reviewed','published','archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_materials_status ON public.materials(status);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_materials_dedup
  ON public.materials (subject_id, COALESCE(topic_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(title), COALESCE(source_url, ''));

-- Admin manage policies on materials
DROP POLICY IF EXISTS "materials admin manage" ON public.materials;
CREATE POLICY "materials admin manage" ON public.materials
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow read of all published materials regardless of owner
DROP POLICY IF EXISTS "materials read published" ON public.materials;
CREATE POLICY "materials read published" ON public.materials
  FOR SELECT TO authenticated
  USING (status = 'published' OR is_public = true OR created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- 2. Admin manage on structural tables (subjects/programs/topics/learning_objectives)
DROP POLICY IF EXISTS "subjects admin manage" ON public.subjects;
CREATE POLICY "subjects admin manage" ON public.subjects
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "topics admin manage" ON public.topics;
CREATE POLICY "topics admin manage" ON public.topics
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "subject_programs admin manage" ON public.subject_programs;
CREATE POLICY "subject_programs admin manage" ON public.subject_programs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "learning_objectives admin manage" ON public.learning_objectives;
CREATE POLICY "learning_objectives admin manage" ON public.learning_objectives
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3. content_sources
CREATE TABLE IF NOT EXISTS public.content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  base_url text,
  source_type text NOT NULL DEFAULT 'other'
    CHECK (source_type IN ('official','open_education','textbook','video_platform','practice_bank','encyclopedia','other')),
  description text,
  license_note text,
  is_approved boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_sources TO authenticated;
GRANT ALL ON public.content_sources TO service_role;

ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_sources read approved" ON public.content_sources
  FOR SELECT TO authenticated
  USING (is_approved = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "content_sources admin manage" ON public.content_sources
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER content_sources_set_updated_at
  BEFORE UPDATE ON public.content_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. content_import_logs
CREATE TABLE IF NOT EXISTS public.content_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type text NOT NULL,
  file_name text,
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started','completed','failed','partially_completed')),
  total_rows integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  errors jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.content_import_logs TO authenticated;
GRANT ALL ON public.content_import_logs TO service_role;

ALTER TABLE public.content_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_import_logs admin only" ON public.content_import_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
