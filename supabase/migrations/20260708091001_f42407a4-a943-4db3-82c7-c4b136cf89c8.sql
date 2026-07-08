
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS target_program text,
  ADD COLUMN IF NOT EXISTS learning_goals text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS self_assessment text,
  ADD COLUMN IF NOT EXISTS learning_barriers text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS available_time text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
