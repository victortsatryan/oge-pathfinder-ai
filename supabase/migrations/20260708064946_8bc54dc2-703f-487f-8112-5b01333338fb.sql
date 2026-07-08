
DROP POLICY IF EXISTS "materials insert own" ON public.materials;
CREATE POLICY "materials insert own" ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "task_solutions insert own" ON public.task_solutions;
CREATE POLICY "task_solutions insert own" ON public.task_solutions
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "tests insert own" ON public.tests;
CREATE POLICY "tests insert own" ON public.tests
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
