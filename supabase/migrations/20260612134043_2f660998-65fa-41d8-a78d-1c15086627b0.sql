
-- ============================================================
-- Step 2: Universal subjects/programs/topics architecture
-- ============================================================

-- 1) Extend subjects
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS subject_type text NOT NULL DEFAULT 'standard';

-- 2) Extend topics
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS topic_type text NOT NULL DEFAULT 'topic',
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- 3) subject_programs
CREATE TABLE IF NOT EXISTS public.subject_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  slug text,
  title text NOT NULL,
  description text,
  program_type text NOT NULL DEFAULT 'school_standard',
  standard text,
  exam_type text,
  grade text,
  language text NOT NULL DEFAULT 'ru',
  created_by uuid,
  is_public boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_programs TO authenticated;
GRANT SELECT ON public.subject_programs TO anon;
GRANT ALL ON public.subject_programs TO service_role;

ALTER TABLE public.subject_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subject_programs_select_public"
  ON public.subject_programs FOR SELECT
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "subject_programs_insert_own"
  ON public.subject_programs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "subject_programs_update_own"
  ON public.subject_programs FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "subject_programs_delete_own"
  ON public.subject_programs FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

CREATE TRIGGER trg_subject_programs_updated_at
  BEFORE UPDATE ON public.subject_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) program_topics
CREATE TABLE IF NOT EXISTS public.program_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.subject_programs(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT true,
  weight integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, topic_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_topics TO authenticated;
GRANT SELECT ON public.program_topics TO anon;
GRANT ALL ON public.program_topics TO service_role;

ALTER TABLE public.program_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_topics_select_all"
  ON public.program_topics FOR SELECT USING (true);

CREATE POLICY "program_topics_modify_program_owner"
  ON public.program_topics FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subject_programs p WHERE p.id = program_id AND p.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subject_programs p WHERE p.id = program_id AND p.created_by = auth.uid()));

CREATE TRIGGER trg_program_topics_updated_at
  BEFORE UPDATE ON public.program_topics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) learning_objectives
CREATE TABLE IF NOT EXISTS public.learning_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  objective_type text NOT NULL DEFAULT 'skill',
  difficulty integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_objectives TO authenticated;
GRANT SELECT ON public.learning_objectives TO anon;
GRANT ALL ON public.learning_objectives TO service_role;

ALTER TABLE public.learning_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learning_objectives_select_public"
  ON public.learning_objectives FOR SELECT
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "learning_objectives_modify_own"
  ON public.learning_objectives FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE TRIGGER trg_learning_objectives_updated_at
  BEFORE UPDATE ON public.learning_objectives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) topic_prerequisites (with cycle prevention)
CREATE TABLE IF NOT EXISTS public.topic_prerequisites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  prerequisite_topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, prerequisite_topic_id),
  CHECK (topic_id <> prerequisite_topic_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_prerequisites TO authenticated;
GRANT SELECT ON public.topic_prerequisites TO anon;
GRANT ALL ON public.topic_prerequisites TO service_role;

ALTER TABLE public.topic_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topic_prerequisites_select_all"
  ON public.topic_prerequisites FOR SELECT USING (true);

CREATE POLICY "topic_prerequisites_modify_admin"
  ON public.topic_prerequisites FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Cycle prevention trigger
CREATE OR REPLACE FUNCTION public.tp_prevent_cycles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cycle_exists boolean;
BEGIN
  -- Walk prerequisites forward; if we reach NEW.topic_id we have a cycle
  WITH RECURSIVE chain AS (
    SELECT NEW.prerequisite_topic_id AS node
    UNION ALL
    SELECT tp.prerequisite_topic_id
      FROM public.topic_prerequisites tp
      JOIN chain c ON c.node = tp.topic_id
  )
  SELECT EXISTS (SELECT 1 FROM chain WHERE node = NEW.topic_id) INTO cycle_exists;

  IF cycle_exists THEN
    RAISE EXCEPTION 'Cycle detected in topic_prerequisites';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_topic_prereq_no_cycles
  BEFORE INSERT OR UPDATE ON public.topic_prerequisites
  FOR EACH ROW EXECUTE FUNCTION public.tp_prevent_cycles();

-- 7) student_subjects / student_topic_progress: link to program
ALTER TABLE public.student_subjects
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.subject_programs(id) ON DELETE SET NULL;

ALTER TABLE public.student_topic_progress
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.subject_programs(id) ON DELETE SET NULL;

-- ============================================================
-- SEED: missing topics, programs, program_topics
-- ============================================================

-- Top up missing topics per subject (idempotent: skip ones that already exist by title+subject)
INSERT INTO public.topics (subject_id, title, sort_order, level, topic_type, is_public)
SELECT s.id, x.title, x.sort_order, 1, 'topic', true
FROM public.subjects s
JOIN (VALUES
  ('mathematics','Текстовые задачи', 50),
  ('mathematics','Геометрия: треугольники', 70),
  ('mathematics','Геометрия: окружности', 80),
  ('mathematics','Геометрия: площади', 90),
  ('russian','Средства выразительности', 60),
  ('english','Everyday communication', 80),
  ('biology','Методы биологии', 90),
  ('biology','Эволюция', 80)
) AS x(slug, title, sort_order) ON x.slug = s.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.topics t WHERE t.subject_id = s.id AND t.title = x.title
);

-- Programs (OGE 9 class for each)
INSERT INTO public.subject_programs (subject_id, slug, title, description, program_type, exam_type, grade, is_public, sort_order)
SELECT s.id,
       'oge-9',
       s.name || ' — ОГЭ 9 класс',
       'Программа подготовки к ОГЭ по предмету «' || s.name || '».',
       'exam_prep',
       'OGE',
       '9',
       true,
       0
FROM public.subjects s
WHERE NOT EXISTS (
  SELECT 1 FROM public.subject_programs p WHERE p.subject_id = s.id AND p.slug = 'oge-9'
);

-- Bind all current public topics to the OGE-9 program of the same subject
INSERT INTO public.program_topics (program_id, topic_id, sort_order, required, weight)
SELECT p.id, t.id, COALESCE(t.sort_order, 0), true, 1
FROM public.subject_programs p
JOIN public.topics t ON t.subject_id = p.subject_id
WHERE p.slug = 'oge-9'
  AND t.is_public = true
  AND NOT EXISTS (
    SELECT 1 FROM public.program_topics pt WHERE pt.program_id = p.id AND pt.topic_id = t.id
  );
