
-- Extend lesson_status enum
ALTER TYPE public.lesson_status ADD VALUE IF NOT EXISTS 'planned';
ALTER TYPE public.lesson_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE public.lesson_status ADD VALUE IF NOT EXISTS 'skipped';
ALTER TYPE public.lesson_status ADD VALUE IF NOT EXISTS 'rescheduled';

-- 1. learning_paths
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  goal text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'draft',
  generated_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_paths_profile ON public.learning_paths(student_profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_paths TO authenticated;
GRANT ALL ON public.learning_paths TO service_role;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lp owner all" ON public.learning_paths FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER learning_paths_set_updated_at BEFORE UPDATE ON public.learning_paths
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. learning_path_items
CREATE TABLE IF NOT EXISTS public.learning_path_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.subject_programs(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  learning_objective_id uuid REFERENCES public.learning_objectives(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority integer NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0,
  planned_date date,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lpi_path ON public.learning_path_items(learning_path_id);
CREATE INDEX IF NOT EXISTS idx_lpi_user_date ON public.learning_path_items(user_id, planned_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_path_items TO authenticated;
GRANT ALL ON public.learning_path_items TO service_role;
ALTER TABLE public.learning_path_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lpi owner all" ON public.learning_path_items FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER lpi_set_updated_at BEFORE UPDATE ON public.learning_path_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Extend lessons
ALTER TABLE public.lessons
  ALTER COLUMN plan_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS student_profile_id uuid REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS learning_path_id uuid REFERENCES public.learning_paths(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learning_path_item_id uuid REFERENCES public.learning_path_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.subject_programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learning_objective_id uuid REFERENCES public.learning_objectives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.lessons ALTER COLUMN slot_number DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lessons_path_item ON public.lessons(learning_path_item_id);
CREATE INDEX IF NOT EXISTS idx_lessons_profile ON public.lessons(student_profile_id);

-- 4. lesson_materials
CREATE TABLE IF NOT EXISTS public.lesson_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, material_id)
);
CREATE INDEX IF NOT EXISTS idx_lm_lesson ON public.lesson_materials(lesson_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_materials TO authenticated;
GRANT ALL ON public.lesson_materials TO service_role;
ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lm owner all" ON public.lesson_materials FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. lesson_tasks
CREATE TABLE IF NOT EXISTS public.lesson_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT true,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_lt_lesson ON public.lesson_tasks(lesson_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_tasks TO authenticated;
GRANT ALL ON public.lesson_tasks TO service_role;
ALTER TABLE public.lesson_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lt owner all" ON public.lesson_tasks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 6. lesson_results
CREATE TABLE IF NOT EXISTS public.lesson_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  max_score integer NOT NULL DEFAULT 0,
  score_percent integer NOT NULL DEFAULT 0,
  completed_tasks integer NOT NULL DEFAULT 0,
  correct_tasks integer NOT NULL DEFAULT 0,
  wrong_tasks integer NOT NULL DEFAULT 0,
  summary text,
  ai_recommendation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_results TO authenticated;
GRANT ALL ON public.lesson_results TO service_role;
ALTER TABLE public.lesson_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lr owner all" ON public.lesson_results FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER lesson_results_set_updated_at BEFORE UPDATE ON public.lesson_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Extend task_attempts
ALTER TABLE public.task_attempts
  ADD COLUMN IF NOT EXISTS student_profile_id uuid REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS learning_objective_id uuid REFERENCES public.learning_objectives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS points_awarded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_points integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS checked_by text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS mistake_type text,
  ADD COLUMN IF NOT EXISTS mistake_description text;

-- 8. calendar_events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'lesson',
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  diagnostic_session_id uuid REFERENCES public.diagnostic_sessions(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  start_time time,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ce_user_date ON public.calendar_events(user_id, event_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce owner all" ON public.calendar_events FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER calendar_events_set_updated_at BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
