CREATE POLICY "student_profiles_select_linked_teacher"
  ON public.student_profiles FOR SELECT
  TO authenticated
  USING (public.is_teacher_of_student(auth.uid(), id));