-- Students may read only administrator-approved curriculum tags.
-- Draft catalog is visible solely to admin/teacher editors.
DROP POLICY IF EXISTS "curriculum_meta_editors_read" ON public.curriculum_topic_meta;
CREATE POLICY "curriculum_meta_approved_or_editor_read"
ON public.curriculum_topic_meta FOR SELECT TO authenticated
USING (
  review_status='approved'
  OR public.has_role(auth.uid(),'admin'::public.app_role)
  OR public.has_role(auth.uid(),'teacher'::public.app_role)
);
