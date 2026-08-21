CREATE POLICY "stp_select_linked_teacher" ON public.student_topic_progress
  FOR SELECT TO authenticated
  USING (public.is_teacher_of_student(auth.uid(), student_profile_id));

CREATE POLICY "mistakes_select_linked_teacher" ON public.student_mistakes
  FOR SELECT TO authenticated
  USING (public.is_teacher_of_student(auth.uid(), student_profile_id));