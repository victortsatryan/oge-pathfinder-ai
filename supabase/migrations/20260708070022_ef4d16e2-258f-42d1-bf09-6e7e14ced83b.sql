DROP POLICY IF EXISTS "task_solutions read" ON public.task_solutions;
CREATE POLICY "task_solutions read published or own" ON public.task_solutions
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_solutions.task_id AND t.is_published = true
  )
);