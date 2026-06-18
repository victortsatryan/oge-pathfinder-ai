
-- 1. ai_response_cache: restrict SELECT to admins only
DROP POLICY IF EXISTS "Cache readable by authenticated" ON public.ai_response_cache;
CREATE POLICY "Cache readable by admins"
  ON public.ai_response_cache FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. materials: replace broad SELECT policies with strict published+public
DROP POLICY IF EXISTS "materials read public" ON public.materials;
DROP POLICY IF EXISTS "materials read published" ON public.materials;

CREATE POLICY "materials read published"
  ON public.materials FOR SELECT
  TO authenticated
  USING (
    (status = 'published' AND is_public = true)
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3. teacher_notes: student can read only while an active link exists
DROP POLICY IF EXISTS "tn_student_read" ON public.teacher_notes;
CREATE POLICY "tn_student_read"
  ON public.teacher_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.student_profiles sp
        JOIN public.teacher_student_links l
          ON l.student_profile_id = sp.id
       WHERE sp.id = teacher_notes.student_profile_id
         AND sp.user_id = auth.uid()
         AND l.teacher_profile_id = teacher_notes.teacher_profile_id
         AND l.status = 'active'
    )
  );
