
-- Teacher profile
CREATE TABLE public.teacher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  specialization text,
  bio text,
  timezone text,
  language text NOT NULL DEFAULT 'ru',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_profiles TO authenticated;
GRANT ALL ON public.teacher_profiles TO service_role;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tp_own ON public.teacher_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER teacher_profiles_set_updated_at BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Teacher ↔ Student link
CREATE TABLE public.teacher_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_profile_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  started_at date DEFAULT CURRENT_DATE,
  ended_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_profile_id, student_profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_student_links TO authenticated;
GRANT ALL ON public.teacher_student_links TO service_role;
ALTER TABLE public.teacher_student_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY tsl_teacher_all ON public.teacher_student_links FOR ALL TO authenticated
  USING (teacher_profile_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = auth.uid()))
  WITH CHECK (teacher_profile_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = auth.uid()));
CREATE POLICY tsl_student_read ON public.teacher_student_links FOR SELECT TO authenticated
  USING (student_profile_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid()));
CREATE TRIGGER tsl_set_updated_at BEFORE UPDATE ON public.teacher_student_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: check teacher access to a student profile
CREATE OR REPLACE FUNCTION public.is_teacher_of_student(_user_id uuid, _student_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_student_links l
    JOIN public.teacher_profiles t ON t.id = l.teacher_profile_id
    WHERE t.user_id = _user_id
      AND l.student_profile_id = _student_profile_id
      AND l.status = 'active'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_teacher_of_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student(uuid, uuid) TO authenticated, service_role;

-- Teacher notes
CREATE TABLE public.teacher_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_profile_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  note_type text NOT NULL DEFAULT 'observation',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_notes TO authenticated;
GRANT ALL ON public.teacher_notes TO service_role;
ALTER TABLE public.teacher_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tn_teacher_all ON public.teacher_notes FOR ALL TO authenticated
  USING (teacher_profile_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = auth.uid()))
  WITH CHECK (teacher_profile_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = auth.uid()));
CREATE POLICY tn_student_read ON public.teacher_notes FOR SELECT TO authenticated
  USING (student_profile_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid()));
CREATE TRIGGER tn_set_updated_at BEFORE UPDATE ON public.teacher_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Teacher assignments
CREATE TABLE public.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_profile_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  comment text,
  status text NOT NULL DEFAULT 'assigned',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_assignments TO authenticated;
GRANT ALL ON public.teacher_assignments TO service_role;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ta_teacher_all ON public.teacher_assignments FOR ALL TO authenticated
  USING (teacher_profile_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = auth.uid()))
  WITH CHECK (teacher_profile_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = auth.uid()));
CREATE POLICY ta_student_rw ON public.teacher_assignments FOR SELECT TO authenticated
  USING (student_profile_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid()));
CREATE POLICY ta_student_update_status ON public.teacher_assignments FOR UPDATE TO authenticated
  USING (student_profile_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid()))
  WITH CHECK (student_profile_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid()));
CREATE TRIGGER ta_set_updated_at BEFORE UPDATE ON public.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Teacher activity log
CREATE TABLE public.teacher_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_profile_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  student_profile_id uuid REFERENCES public.student_profiles(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.teacher_activity_log TO authenticated;
GRANT ALL ON public.teacher_activity_log TO service_role;
ALTER TABLE public.teacher_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tal_teacher_all ON public.teacher_activity_log FOR ALL TO authenticated
  USING (teacher_profile_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = auth.uid()))
  WITH CHECK (teacher_profile_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = auth.uid()));

-- Teacher AI suggestions
CREATE TABLE public.teacher_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_profile_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  student_profile_id uuid REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  scenario text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'suggested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_ai_suggestions TO authenticated;
GRANT ALL ON public.teacher_ai_suggestions TO service_role;
ALTER TABLE public.teacher_ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tas_teacher_all ON public.teacher_ai_suggestions FOR ALL TO authenticated
  USING (teacher_profile_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = auth.uid()))
  WITH CHECK (teacher_profile_id IN (SELECT id FROM public.teacher_profiles WHERE user_id = auth.uid()));
CREATE TRIGGER tas_set_updated_at BEFORE UPDATE ON public.teacher_ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_tsl_teacher ON public.teacher_student_links(teacher_profile_id);
CREATE INDEX idx_tsl_student ON public.teacher_student_links(student_profile_id);
CREATE INDEX idx_tn_student ON public.teacher_notes(student_profile_id);
CREATE INDEX idx_ta_student ON public.teacher_assignments(student_profile_id);
CREATE INDEX idx_tal_teacher ON public.teacher_activity_log(teacher_profile_id, created_at DESC);
