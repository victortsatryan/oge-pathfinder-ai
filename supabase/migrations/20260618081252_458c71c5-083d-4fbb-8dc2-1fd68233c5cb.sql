
DROP POLICY IF EXISTS "Owner or teacher view lesson overrides" ON public.lesson_overrides;
DROP POLICY IF EXISTS "Owner or teacher insert lesson overrides" ON public.lesson_overrides;
DROP POLICY IF EXISTS "Owner or teacher update lesson overrides" ON public.lesson_overrides;
DROP POLICY IF EXISTS "Owner or teacher delete lesson overrides" ON public.lesson_overrides;

CREATE POLICY "Owner or linked teacher view lesson overrides" ON public.lesson_overrides
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.student_profiles sp
      WHERE sp.user_id = lesson_overrides.user_id
        AND public.is_teacher_of_student(auth.uid(), sp.id)
    )
  );

CREATE POLICY "Owner or linked teacher insert lesson overrides" ON public.lesson_overrides
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.student_profiles sp
      WHERE sp.user_id = lesson_overrides.user_id
        AND public.is_teacher_of_student(auth.uid(), sp.id)
    )
  );

CREATE POLICY "Owner or linked teacher update lesson overrides" ON public.lesson_overrides
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.student_profiles sp
      WHERE sp.user_id = lesson_overrides.user_id
        AND public.is_teacher_of_student(auth.uid(), sp.id)
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.student_profiles sp
      WHERE sp.user_id = lesson_overrides.user_id
        AND public.is_teacher_of_student(auth.uid(), sp.id)
    )
  );

CREATE POLICY "Owner or linked teacher delete lesson overrides" ON public.lesson_overrides
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.student_profiles sp
      WHERE sp.user_id = lesson_overrides.user_id
        AND public.is_teacher_of_student(auth.uid(), sp.id)
    )
  );

-- Allow linked students to read the teacher profile of teachers they are linked with
DROP POLICY IF EXISTS "Linked student view teacher profile" ON public.teacher_profiles;
CREATE POLICY "Linked student view teacher profile" ON public.teacher_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.teacher_student_links l
      JOIN public.student_profiles sp ON sp.id = l.student_profile_id
      WHERE l.teacher_profile_id = teacher_profiles.id
        AND l.status = 'active'
        AND sp.user_id = auth.uid()
    )
  );
