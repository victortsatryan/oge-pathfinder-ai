-- Step 6: Analytics — progress history table for tracking mastery changes over time
CREATE TABLE IF NOT EXISTS public.student_progress_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  old_score integer NOT NULL DEFAULT 0,
  new_score integer NOT NULL DEFAULT 0,
  delta integer GENERATED ALWAYS AS (new_score - old_score) STORED,
  source text NOT NULL CHECK (source IN ('diagnostic','lesson','manual','teacher','ai','system')),
  source_ref_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sph_profile_created ON public.student_progress_history(student_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sph_topic ON public.student_progress_history(topic_id);
CREATE INDEX IF NOT EXISTS idx_sph_subject ON public.student_progress_history(subject_id);

GRANT SELECT, INSERT ON public.student_progress_history TO authenticated;
GRANT ALL ON public.student_progress_history TO service_role;

ALTER TABLE public.student_progress_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own progress history"
  ON public.student_progress_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Students insert own progress history"
  ON public.student_progress_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
