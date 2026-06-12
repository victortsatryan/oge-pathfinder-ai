
-- =========================================================
-- Шаг 1. Ядро Student Profile.
-- Расширение subjects/topics + 4 новые таблицы + базовый seed тем.
-- =========================================================

-- ---------- 1. subjects: добавить универсальные поля ----------
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS is_school_subject boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exam_type text,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ru',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- backfill exam_type из exam_code (OGE-MATH -> OGE)
UPDATE public.subjects
SET exam_type = split_part(exam_code, '-', 1)
WHERE exam_type IS NULL AND exam_code IS NOT NULL;

-- ---------- 2. topics: вложенность + описание + уровень ----------
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS parent_topic_id uuid REFERENCES public.topics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_standard text;

CREATE INDEX IF NOT EXISTS idx_topics_parent_topic_id ON public.topics(parent_topic_id);

-- ---------- 3. student_profiles ----------
CREATE TABLE IF NOT EXISTS public.student_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  grade text,
  age integer,
  country text,
  language text NOT NULL DEFAULT 'ru',
  learning_goal text,
  target_exam text,
  target_date date,
  target_score text,
  preferred_intensity text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_profiles_user_id_unique UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_profiles TO authenticated;
GRANT ALL ON public.student_profiles TO service_role;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_profiles_select_own" ON public.student_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "student_profiles_insert_own" ON public.student_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "student_profiles_update_own" ON public.student_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "student_profiles_delete_own" ON public.student_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER student_profiles_set_updated_at
  BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 4. student_subjects ----------
CREATE TABLE IF NOT EXISTS public.student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  goal text,
  target_level text,
  target_score text,
  status text NOT NULL DEFAULT 'active',
  started_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_subjects_status_check
    CHECK (status IN ('active','paused','completed','archived')),
  CONSTRAINT student_subjects_unique UNIQUE (student_profile_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_student_subjects_profile ON public.student_subjects(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject ON public.student_subjects(subject_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_subjects TO authenticated;
GRANT ALL ON public.student_subjects TO service_role;
ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_subjects_select_own" ON public.student_subjects
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );
CREATE POLICY "student_subjects_insert_own" ON public.student_subjects
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );
CREATE POLICY "student_subjects_update_own" ON public.student_subjects
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );
CREATE POLICY "student_subjects_delete_own" ON public.student_subjects
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );

CREATE TRIGGER student_subjects_set_updated_at
  BEFORE UPDATE ON public.student_subjects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 5. student_topic_progress ----------
CREATE TABLE IF NOT EXISTS public.student_topic_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,

  mastery_score integer NOT NULL DEFAULT 0,
  diagnostic_score integer,
  practice_score integer,
  confidence_level integer,

  status text NOT NULL DEFAULT 'not_started',

  last_activity_at timestamptz,
  attempts_count integer NOT NULL DEFAULT 0,
  mistakes_count integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stp_status_check CHECK (status IN
    ('not_started','weak','learning','stable','mastered','needs_review')),
  CONSTRAINT stp_mastery_range CHECK (mastery_score BETWEEN 0 AND 100),
  CONSTRAINT stp_unique UNIQUE (student_profile_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_stp_profile ON public.student_topic_progress(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_stp_subject ON public.student_topic_progress(subject_id);
CREATE INDEX IF NOT EXISTS idx_stp_topic ON public.student_topic_progress(topic_id);
CREATE INDEX IF NOT EXISTS idx_stp_status ON public.student_topic_progress(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_topic_progress TO authenticated;
GRANT ALL ON public.student_topic_progress TO service_role;
ALTER TABLE public.student_topic_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stp_select_own" ON public.student_topic_progress
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );
CREATE POLICY "stp_insert_own" ON public.student_topic_progress
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );
CREATE POLICY "stp_update_own" ON public.student_topic_progress
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );
CREATE POLICY "stp_delete_own" ON public.student_topic_progress
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );

CREATE TRIGGER stp_set_updated_at
  BEFORE UPDATE ON public.student_topic_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Авто-вычисление status по mastery_score
CREATE OR REPLACE FUNCTION public.stp_compute_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN ('needs_review') OR TG_OP = 'INSERT' THEN
    -- needs_review задаётся вручную, остальное считаем по баллу
    IF NEW.status IS DISTINCT FROM 'needs_review' THEN
      NEW.status := CASE
        WHEN NEW.mastery_score = 0 THEN 'not_started'
        WHEN NEW.mastery_score BETWEEN 1 AND 49 THEN 'weak'
        WHEN NEW.mastery_score BETWEEN 50 AND 69 THEN 'learning'
        WHEN NEW.mastery_score BETWEEN 70 AND 84 THEN 'stable'
        WHEN NEW.mastery_score BETWEEN 85 AND 100 THEN 'mastered'
        ELSE NEW.status
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stp_status_auto
  BEFORE INSERT OR UPDATE OF mastery_score ON public.student_topic_progress
  FOR EACH ROW EXECUTE FUNCTION public.stp_compute_status();

-- ---------- 6. student_mistakes ----------
CREATE TABLE IF NOT EXISTS public.student_mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  task_id uuid,
  mistake_type text NOT NULL,
  mistake_description text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mistake_type_check CHECK (mistake_type IN (
    'concept_gap','careless_error','calculation_error','grammar_error',
    'misread_task','no_strategy','vocabulary_gap','memory_gap','other'
  ))
);

CREATE INDEX IF NOT EXISTS idx_mistakes_profile ON public.student_mistakes(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_topic ON public.student_mistakes(topic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_mistakes TO authenticated;
GRANT ALL ON public.student_mistakes TO service_role;
ALTER TABLE public.student_mistakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mistakes_select_own" ON public.student_mistakes
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );
CREATE POLICY "mistakes_insert_own" ON public.student_mistakes
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );
CREATE POLICY "mistakes_update_own" ON public.student_mistakes
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );
CREATE POLICY "mistakes_delete_own" ON public.student_mistakes
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.student_profiles sp
            WHERE sp.id = student_profile_id AND sp.user_id = auth.uid())
  );

-- ---------- 7. Seed: базовые темы по 4 предметам ----------
INSERT INTO public.topics (subject_id, title, sort_order, level)
SELECT s.id, t.title, t.sort_order, 1
FROM public.subjects s
JOIN (VALUES
  ('mathematics','Числа и вычисления',10),
  ('mathematics','Алгебраические выражения',20),
  ('mathematics','Уравнения и неравенства',30),
  ('mathematics','Функции и графики',40),
  ('mathematics','Геометрия',50),
  ('mathematics','Вероятность и статистика',60),

  ('russian','Орфография',10),
  ('russian','Пунктуация',20),
  ('russian','Грамматика',30),
  ('russian','Синтаксис',40),
  ('russian','Анализ текста',50),
  ('russian','Сочинение',60),

  ('english','Grammar',10),
  ('english','Vocabulary',20),
  ('english','Reading',30),
  ('english','Listening',40),
  ('english','Writing',50),
  ('english','Speaking',60),

  ('biology','Клетка',10),
  ('biology','Организм человека',20),
  ('biology','Растения',30),
  ('biology','Животные',40),
  ('biology','Экология',50),
  ('biology','Генетика и эволюция',60)
) AS t(slug, title, sort_order) ON t.slug = s.slug
ON CONFLICT (subject_id, title) DO NOTHING;

-- ---------- 8. subjects: проставить категорию/описание ----------
UPDATE public.subjects SET category = 'school', is_school_subject = true
WHERE category IS NULL;
