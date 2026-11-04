GRANT SELECT, INSERT ON public.tasks TO authenticated;
CREATE POLICY tasks_admin_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));