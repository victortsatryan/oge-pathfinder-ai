ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS subjects text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS experience_years integer;