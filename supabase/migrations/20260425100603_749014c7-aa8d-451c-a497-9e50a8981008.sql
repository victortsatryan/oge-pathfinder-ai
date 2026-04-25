-- 1. Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. lesson_overrides
CREATE TABLE IF NOT EXISTS public.lesson_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_key text NOT NULL,
  title text,
  topic text,
  lesson_date date,
  slot_number smallint,
  difficulty text,
  status text,
  teacher_note text,
  theory_markdown text,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_key)
);

ALTER TABLE public.lesson_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner or teacher view lesson overrides" ON public.lesson_overrides;
CREATE POLICY "Owner or teacher view lesson overrides" ON public.lesson_overrides
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "Owner or teacher insert lesson overrides" ON public.lesson_overrides;
CREATE POLICY "Owner or teacher insert lesson overrides" ON public.lesson_overrides
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "Owner or teacher update lesson overrides" ON public.lesson_overrides;
CREATE POLICY "Owner or teacher update lesson overrides" ON public.lesson_overrides
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'teacher'));

DROP POLICY IF EXISTS "Owner or teacher delete lesson overrides" ON public.lesson_overrides;
CREATE POLICY "Owner or teacher delete lesson overrides" ON public.lesson_overrides
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'teacher'));

DROP TRIGGER IF EXISTS set_lesson_overrides_updated_at ON public.lesson_overrides;
CREATE TRIGGER set_lesson_overrides_updated_at
  BEFORE UPDATE ON public.lesson_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS lesson_overrides_user_idx ON public.lesson_overrides(user_id);
CREATE INDEX IF NOT EXISTS lesson_overrides_date_idx ON public.lesson_overrides(user_id, lesson_date);