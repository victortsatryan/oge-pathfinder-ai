DROP POLICY IF EXISTS learning_objectives_select_public ON public.learning_objectives;
CREATE POLICY learning_objectives_select_public ON public.learning_objectives
FOR SELECT USING (
  (is_public = true AND status = 'published')
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);