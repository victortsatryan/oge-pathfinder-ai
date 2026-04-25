UPDATE storage.buckets SET public = false WHERE id = 'diagnostic-uploads';

DROP POLICY IF EXISTS "Diagnostic uploads are publicly readable" ON storage.objects;

CREATE POLICY "Users read own diagnostic files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'diagnostic-uploads'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );