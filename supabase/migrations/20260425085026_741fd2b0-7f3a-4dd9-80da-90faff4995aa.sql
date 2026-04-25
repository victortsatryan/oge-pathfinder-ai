-- 1. Extend diagnostic_type enum
ALTER TYPE diagnostic_type ADD VALUE IF NOT EXISTS 'weekly_subject';
ALTER TYPE diagnostic_type ADD VALUE IF NOT EXISTS 'external';

-- 2. External diagnostic results
CREATE TABLE IF NOT EXISTS public.external_diagnostic_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  source_name TEXT NOT NULL,
  taken_on DATE NOT NULL DEFAULT CURRENT_DATE,
  score NUMERIC,
  max_score NUMERIC,
  score_percent NUMERIC,
  weak_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  strong_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.external_diagnostic_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own external results"
  ON public.external_diagnostic_results FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own external results"
  ON public.external_diagnostic_results FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own external results"
  ON public.external_diagnostic_results FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own external results"
  ON public.external_diagnostic_results FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER set_external_results_updated_at
  BEFORE UPDATE ON public.external_diagnostic_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_external_results_user ON public.external_diagnostic_results(user_id, taken_on DESC);
CREATE INDEX IF NOT EXISTS idx_external_results_subject ON public.external_diagnostic_results(subject_id);

-- 3. Index to find tasks by topic quickly
CREATE INDEX IF NOT EXISTS idx_tasks_topic_pub ON public.tasks(topic_id) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_tasks_subject_pub ON public.tasks(subject_id) WHERE is_published = true;

-- 4. Index diagnostic_sessions for history queries
CREATE INDEX IF NOT EXISTS idx_diag_sessions_user_date ON public.diagnostic_sessions(user_id, created_at DESC);
