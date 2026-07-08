ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS education_system text,
  ADD COLUMN IF NOT EXISTS custom_learning_goal text,
  ADD COLUMN IF NOT EXISTS custom_learning_barrier text,
  ADD COLUMN IF NOT EXISTS onboarding_summary text;