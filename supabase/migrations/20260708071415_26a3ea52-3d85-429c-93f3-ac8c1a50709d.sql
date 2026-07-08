CREATE OR REPLACE FUNCTION public.student_linked_to_teacher_profile(_teacher_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_student_links l
    JOIN public.student_profiles sp ON sp.id = l.student_profile_id
    WHERE l.teacher_profile_id = _teacher_profile_id
      AND l.status = 'active'
      AND sp.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_my_teacher_profile(_teacher_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_profiles
    WHERE id = _teacher_profile_id AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Linked student view teacher profile" ON public.teacher_profiles;
CREATE POLICY "Linked student view teacher profile"
ON public.teacher_profiles
FOR SELECT
USING (public.student_linked_to_teacher_profile(id));

DROP POLICY IF EXISTS tsl_teacher_all ON public.teacher_student_links;
CREATE POLICY tsl_teacher_all
ON public.teacher_student_links
FOR ALL
USING (public.is_my_teacher_profile(teacher_profile_id))
WITH CHECK (public.is_my_teacher_profile(teacher_profile_id));