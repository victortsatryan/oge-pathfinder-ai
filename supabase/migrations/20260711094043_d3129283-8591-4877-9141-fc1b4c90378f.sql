
-- diagnostic_test_tasks: restrict to authenticated
DROP POLICY IF EXISTS diag_test_tasks_select_all ON public.diagnostic_test_tasks;
CREATE POLICY diag_test_tasks_select_authenticated
  ON public.diagnostic_test_tasks
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.diagnostic_test_tasks FROM anon;

-- program_topics: restrict to authenticated
DROP POLICY IF EXISTS program_topics_select_all ON public.program_topics;
CREATE POLICY program_topics_select_authenticated
  ON public.program_topics
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.program_topics FROM anon;

-- topic_prerequisites: restrict to authenticated
DROP POLICY IF EXISTS topic_prerequisites_select_all ON public.topic_prerequisites;
CREATE POLICY topic_prerequisites_select_authenticated
  ON public.topic_prerequisites
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.topic_prerequisites FROM anon;

-- students: require teacher or admin role in addition to ownership
DROP POLICY IF EXISTS "Teachers view own students" ON public.students;
DROP POLICY IF EXISTS "Teachers insert own students" ON public.students;
DROP POLICY IF EXISTS "Teachers update own students" ON public.students;
DROP POLICY IF EXISTS "Teachers delete own students" ON public.students;

CREATE POLICY "Teachers view own students"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = teacher_id
    AND (public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Teachers insert own students"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = teacher_id
    AND (public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Teachers update own students"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = teacher_id
    AND (public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  )
  WITH CHECK (
    auth.uid() = teacher_id
    AND (public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Teachers delete own students"
  ON public.students
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = teacher_id
    AND (public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  );
