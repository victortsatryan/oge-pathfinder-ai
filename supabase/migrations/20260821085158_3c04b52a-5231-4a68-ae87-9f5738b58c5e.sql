-- 1) Re-point EGE practice materials from the generic "Практика" topic
--    to the concrete "Задание N ЕГЭ" topics of the same subject.
WITH numbered AS (
  SELECT m.id,
         (regexp_match(m.title, '^Задание\s+(\d+)'))[1]::int AS n,
         m.subject_id
  FROM public.materials m
  WHERE m.material_type = 'task'
    AND m.title ~ '^Задание\s+\d+'
),
target AS (
  SELECT n.id, t.id AS topic_id
  FROM numbered n
  JOIN public.topics t
    ON t.subject_id = n.subject_id
   AND t.title = 'Задание ' || n.n::text || ' ЕГЭ'
)
UPDATE public.materials m
SET topic_id = target.topic_id
FROM target
WHERE m.id = target.id
  AND (m.topic_id IS DISTINCT FROM target.topic_id);

-- 2) Student-side management of the teacher link
CREATE POLICY "tsl_student_insert" ON public.teacher_student_links
  FOR INSERT TO authenticated
  WITH CHECK (
    student_profile_id IN (
      SELECT id FROM public.student_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tsl_student_delete" ON public.teacher_student_links
  FOR DELETE TO authenticated
  USING (
    student_profile_id IN (
      SELECT id FROM public.student_profiles WHERE user_id = auth.uid()
    )
  );

-- 3) Lookup a teacher by email without exposing auth data
CREATE OR REPLACE FUNCTION public.find_teacher_by_email(_email text)
RETURNS TABLE (teacher_profile_id uuid, display_name text, specialization text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tp.id, tp.display_name, tp.specialization
  FROM public.teacher_profiles tp
  JOIN auth.users u ON u.id = tp.user_id
  WHERE lower(u.email) = lower(btrim(_email))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_teacher_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_teacher_by_email(text) TO authenticated, service_role;