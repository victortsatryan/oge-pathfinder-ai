-- Add attachment fields to external_diagnostic_results
ALTER TABLE public.external_diagnostic_results
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS raw_text text,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_kind text;

-- Create storage bucket for diagnostic uploads (photos / files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('diagnostic-uploads', 'diagnostic-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can manage files only inside their own user-id folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Diagnostic uploads are publicly readable'
  ) THEN
    CREATE POLICY "Diagnostic uploads are publicly readable"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'diagnostic-uploads');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users upload own diagnostic files'
  ) THEN
    CREATE POLICY "Users upload own diagnostic files"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'diagnostic-uploads'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users update own diagnostic files'
  ) THEN
    CREATE POLICY "Users update own diagnostic files"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'diagnostic-uploads'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users delete own diagnostic files'
  ) THEN
    CREATE POLICY "Users delete own diagnostic files"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'diagnostic-uploads'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;