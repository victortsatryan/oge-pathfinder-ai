
CREATE TABLE public.content_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  content_kind text NOT NULL DEFAULT 'text',
  education_system text,
  grade text,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  subtopic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  material_type text,
  file_url text,
  file_path text,
  link_url text,
  content_text text,
  contains text[] NOT NULL DEFAULT ARRAY[]::text[],
  level text,
  usefulness text,
  status text NOT NULL DEFAULT 'draft',
  learning_objective_id uuid REFERENCES public.learning_objectives(id) ON DELETE SET NULL,
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_candidates_author ON public.content_candidates(author_id);
CREATE INDEX idx_content_candidates_status ON public.content_candidates(status);
CREATE INDEX idx_content_candidates_subject ON public.content_candidates(subject_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_candidates TO authenticated;
GRANT ALL ON public.content_candidates TO service_role;

ALTER TABLE public.content_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can view own candidates"
  ON public.content_candidates FOR SELECT TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Admins can view all candidates"
  ON public.content_candidates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors can insert own candidates"
  ON public.content_candidates FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can update own draft/submitted candidates"
  ON public.content_candidates FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND status IN ('draft','submitted'))
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Admins can update any candidate"
  ON public.content_candidates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors can delete own draft candidates"
  ON public.content_candidates FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND status = 'draft');

CREATE POLICY "Admins can delete any candidate"
  ON public.content_candidates FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER content_candidates_updated_at
  BEFORE UPDATE ON public.content_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
