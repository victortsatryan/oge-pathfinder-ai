
-- 1. Extend tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS estimated_time_minutes integer,
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.subject_programs(id) ON DELETE SET NULL;

-- 2. materials
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.subject_programs(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  learning_objective_id uuid REFERENCES public.learning_objectives(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  material_type text NOT NULL,
  source_name text,
  source_url text,
  content_text text,
  video_url text,
  image_url text,
  difficulty integer NOT NULL DEFAULT 1,
  estimated_time_minutes integer,
  language text NOT NULL DEFAULT 'ru',
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_materials_subject ON public.materials(subject_id);
CREATE INDEX IF NOT EXISTS idx_materials_topic ON public.materials(topic_id);
CREATE INDEX IF NOT EXISTS idx_materials_type ON public.materials(material_type);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials read public" ON public.materials FOR SELECT TO authenticated
  USING (is_public = true OR created_by = auth.uid());
CREATE POLICY "materials insert own" ON public.materials FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);
CREATE POLICY "materials update own" ON public.materials FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "materials delete own" ON public.materials FOR DELETE TO authenticated
  USING (created_by = auth.uid());
CREATE TRIGGER materials_set_updated_at BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. material_tags
CREATE TABLE IF NOT EXISTS public.material_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_material_tags_tag ON public.material_tags(tag);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_tags TO authenticated;
GRANT ALL ON public.material_tags TO service_role;
ALTER TABLE public.material_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_tags read" ON public.material_tags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.materials m WHERE m.id = material_id
    AND (m.is_public = true OR m.created_by = auth.uid())));
CREATE POLICY "material_tags write own" ON public.material_tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.materials m WHERE m.id = material_id AND m.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.materials m WHERE m.id = material_id AND m.created_by = auth.uid()));

-- 4. task_solutions
CREATE TABLE IF NOT EXISTS public.task_solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  solution_text text,
  solution_steps jsonb,
  video_solution_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_solutions_task ON public.task_solutions(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_solutions TO authenticated;
GRANT ALL ON public.task_solutions TO service_role;
ALTER TABLE public.task_solutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_solutions read" ON public.task_solutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_solutions insert own" ON public.task_solutions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);
CREATE POLICY "task_solutions update own" ON public.task_solutions FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "task_solutions delete own" ON public.task_solutions FOR DELETE TO authenticated
  USING (created_by = auth.uid());
CREATE TRIGGER task_solutions_set_updated_at BEFORE UPDATE ON public.task_solutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. tests (universal)
CREATE TABLE IF NOT EXISTS public.tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.subject_programs(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  test_type text NOT NULL DEFAULT 'practice',
  duration_minutes integer,
  difficulty integer NOT NULL DEFAULT 1,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tests_subject ON public.tests(subject_id);
CREATE INDEX IF NOT EXISTS idx_tests_topic ON public.tests(topic_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests TO authenticated;
GRANT ALL ON public.tests TO service_role;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tests read public" ON public.tests FOR SELECT TO authenticated
  USING (is_public = true OR created_by = auth.uid());
CREATE POLICY "tests insert own" ON public.tests FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);
CREATE POLICY "tests update own" ON public.tests FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "tests delete own" ON public.tests FOR DELETE TO authenticated
  USING (created_by = auth.uid());
CREATE TRIGGER tests_set_updated_at BEFORE UPDATE ON public.tests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. test_tasks
CREATE TABLE IF NOT EXISTS public.test_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_test_tasks_test ON public.test_tasks(test_id);
CREATE INDEX IF NOT EXISTS idx_test_tasks_task ON public.test_tasks(task_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_tasks TO authenticated;
GRANT ALL ON public.test_tasks TO service_role;
ALTER TABLE public.test_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "test_tasks read" ON public.test_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_id
    AND (t.is_public = true OR t.created_by = auth.uid())));
CREATE POLICY "test_tasks write own" ON public.test_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_id AND t.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_id AND t.created_by = auth.uid()));
