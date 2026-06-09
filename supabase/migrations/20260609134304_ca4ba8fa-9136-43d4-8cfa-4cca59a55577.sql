
-- 1. Enum for user role
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('student', 'teacher');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.user_role,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- 3. Students table (teacher's roster)
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  grade int CHECK (grade BETWEEN 1 AND 11),
  subjects text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers view own students" ON public.students;
CREATE POLICY "Teachers view own students" ON public.students
  FOR SELECT TO authenticated USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers insert own students" ON public.students;
CREATE POLICY "Teachers insert own students" ON public.students
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers update own students" ON public.students;
CREATE POLICY "Teachers update own students" ON public.students
  FOR UPDATE TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Teachers delete own students" ON public.students;
CREATE POLICY "Teachers delete own students" ON public.students
  FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- updated_at trigger (reuses existing set_updated_at function)
DROP TRIGGER IF EXISTS students_set_updated_at ON public.students;
CREATE TRIGGER students_set_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS students_teacher_id_idx ON public.students(teacher_id);
