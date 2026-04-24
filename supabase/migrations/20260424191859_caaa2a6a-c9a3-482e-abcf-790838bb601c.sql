-- Catalog of external learning sources (theory/practice)
CREATE TABLE public.learning_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('theory', 'practice', 'mixed')),
  description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_learning_sources_subject ON public.learning_sources(subject_id);
CREATE INDEX idx_learning_sources_kind ON public.learning_sources(source_kind);

ALTER TABLE public.learning_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learning sources are readable by authenticated users"
  ON public.learning_sources FOR SELECT TO authenticated
  USING (is_published = true);

CREATE TRIGGER learning_sources_set_updated_at
  BEFORE UPDATE ON public.learning_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link concrete theory/task blocks from sources to user's lessons
CREATE TABLE public.lesson_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.learning_sources(id) ON DELETE CASCADE,
  block_kind TEXT NOT NULL CHECK (block_kind IN ('theory', 'practice')),
  block_title TEXT NOT NULL,
  block_url TEXT NOT NULL,
  note TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_resources_lesson ON public.lesson_resources(lesson_id);
CREATE INDEX idx_lesson_resources_user ON public.lesson_resources(user_id);

ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lesson resources"
  ON public.lesson_resources FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lesson resources"
  ON public.lesson_resources FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lesson resources"
  ON public.lesson_resources FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lesson resources"
  ON public.lesson_resources FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER lesson_resources_set_updated_at
  BEFORE UPDATE ON public.lesson_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();