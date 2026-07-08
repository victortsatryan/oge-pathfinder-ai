
CREATE POLICY "community_library_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-library' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "community_library_select_own_or_admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community-library' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "community_library_delete_own_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-library' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
