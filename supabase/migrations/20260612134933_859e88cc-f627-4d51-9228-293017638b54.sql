
-- =========================================================
-- Step 3: Universal diagnostic linked to student progress
-- =========================================================

-- 1) tasks: add task_type + learning_objective_id (topic_id, difficulty already exist)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_type text,
  ADD COLUMN IF NOT EXISTS learning_objective_id uuid REFERENCES public.learning_objectives(id) ON DELETE SET NULL;

-- 2) diagnostic_sessions: extend with universal fields
ALTER TABLE public.diagnostic_sessions
  ADD COLUMN IF NOT EXISTS student_profile_id uuid REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS student_subject_id uuid REFERENCES public.student_subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS diagnostic_test_id uuid,
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.subject_programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS score_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS ai_summary text;

-- 3) diagnostic_tests
CREATE TABLE IF NOT EXISTS public.diagnostic_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.subject_programs(id) ON DELETE SET NULL,
  diagnostic_type text NOT NULL DEFAULT 'entry',
  duration_minutes integer,
  source_name text,
  source_url text,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_tests TO authenticated;
GRANT SELECT ON public.diagnostic_tests TO anon;
GRANT ALL ON public.diagnostic_tests TO service_role;

ALTER TABLE public.diagnostic_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diagnostic_tests_select_public"
  ON public.diagnostic_tests FOR SELECT
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "diagnostic_tests_modify_own"
  ON public.diagnostic_tests FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE TRIGGER trg_diagnostic_tests_updated_at
  BEFORE UPDATE ON public.diagnostic_tests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Back-fill the FK on diagnostic_sessions.diagnostic_test_id
ALTER TABLE public.diagnostic_sessions
  ADD CONSTRAINT diagnostic_sessions_diagnostic_test_id_fkey
  FOREIGN KEY (diagnostic_test_id)
  REFERENCES public.diagnostic_tests(id) ON DELETE SET NULL;

-- 4) diagnostic_test_tasks
CREATE TABLE IF NOT EXISTS public.diagnostic_test_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_test_id uuid NOT NULL REFERENCES public.diagnostic_tests(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diagnostic_test_id, task_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_test_tasks TO authenticated;
GRANT SELECT ON public.diagnostic_test_tasks TO anon;
GRANT ALL ON public.diagnostic_test_tasks TO service_role;

ALTER TABLE public.diagnostic_test_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diag_test_tasks_select_all"
  ON public.diagnostic_test_tasks FOR SELECT USING (true);

CREATE POLICY "diag_test_tasks_modify_own_test"
  ON public.diagnostic_test_tasks FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.diagnostic_tests dt WHERE dt.id = diagnostic_test_id AND dt.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.diagnostic_tests dt WHERE dt.id = diagnostic_test_id AND dt.created_by = auth.uid()));

-- 5) diagnostic_answers
CREATE TABLE IF NOT EXISTS public.diagnostic_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_session_id uuid NOT NULL REFERENCES public.diagnostic_sessions(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  student_answer text,
  is_correct boolean,
  points_awarded integer NOT NULL DEFAULT 0,
  max_points integer NOT NULL DEFAULT 1,
  checked_by text NOT NULL DEFAULT 'auto',
  mistake_type text,
  mistake_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diagnostic_session_id, task_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_answers TO authenticated;
GRANT ALL ON public.diagnostic_answers TO service_role;

ALTER TABLE public.diagnostic_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diag_answers_select_own"
  ON public.diagnostic_answers FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.diagnostic_sessions s
    WHERE s.id = diagnostic_session_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "diag_answers_modify_own"
  ON public.diagnostic_answers FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.diagnostic_sessions s
    WHERE s.id = diagnostic_session_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.diagnostic_sessions s
    WHERE s.id = diagnostic_session_id AND s.user_id = auth.uid()
  ));

CREATE TRIGGER trg_diagnostic_answers_updated_at
  BEFORE UPDATE ON public.diagnostic_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) diagnostic_topic_results
CREATE TABLE IF NOT EXISTS public.diagnostic_topic_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_session_id uuid NOT NULL REFERENCES public.diagnostic_sessions(id) ON DELETE CASCADE,
  student_profile_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  max_score integer NOT NULL DEFAULT 0,
  score_percent integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  detected_weaknesses text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diagnostic_session_id, topic_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_topic_results TO authenticated;
GRANT ALL ON public.diagnostic_topic_results TO service_role;

ALTER TABLE public.diagnostic_topic_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diag_topic_results_select_own"
  ON public.diagnostic_topic_results FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_profiles sp
    WHERE sp.id = student_profile_id AND sp.user_id = auth.uid()
  ));

CREATE POLICY "diag_topic_results_modify_own"
  ON public.diagnostic_topic_results FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_profiles sp
    WHERE sp.id = student_profile_id AND sp.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.student_profiles sp
    WHERE sp.id = student_profile_id AND sp.user_id = auth.uid()
  ));

CREATE TRIGGER trg_diagnostic_topic_results_updated_at
  BEFORE UPDATE ON public.diagnostic_topic_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- SEED: 8 stub tasks per subject linked to topics, then a test per subject
-- =========================================================

-- Math
INSERT INTO public.tasks (subject_id, topic_id, task_key, prompt, answer_type, options, correct_answer, difficulty, task_type)
SELECT '11111111-1111-4111-8111-111111111111'::uuid, x.topic_id, x.task_key, x.prompt, 'single', x.options::jsonb, x.correct::jsonb, 'medium'::difficulty_level, 'multiple_choice'
FROM (VALUES
  ('acc68d26-0c0d-4ac1-a4fb-f14e876056a8'::uuid,'math-d-001','Вычислите: 12 + 5 · 4','["28","32","48","20"]','"32"'),
  ('d128e1af-d253-49a6-849a-7b25b4e2b2fd'::uuid,'math-d-002','Упростите: 3a + 2a − a','["3a","4a","5a","6a"]','"4a"'),
  ('28c52147-f316-4579-855a-633913dca613'::uuid,'math-d-003','Решите уравнение: 2x + 6 = 0','["-6","-3","3","6"]','"-3"'),
  ('51111111-1111-4111-8111-111111111111'::uuid,'math-d-004','Сколько корней у уравнения x² + 4 = 0?','["0","1","2","бесконечно"]','"0"'),
  ('05c608fd-3143-4620-a75c-1b4980e87216'::uuid,'math-d-005','Чему равно f(2), если f(x) = x² − 1?','["1","3","4","5"]','"3"'),
  ('14b2cdb1-dc69-4491-ae8f-3460290a0981'::uuid,'math-d-006','Поезд прошёл 240 км за 4 ч. Скорость?','["50 км/ч","60 км/ч","70 км/ч","80 км/ч"]','"60 км/ч"'),
  ('9592ebea-8881-4559-bfcc-bcc37e69ba96'::uuid,'math-d-007','Сумма углов треугольника равна:','["90°","180°","270°","360°"]','"180°"'),
  ('93548fdc-3810-4965-b988-cf9c2089daff'::uuid,'math-d-008','Вероятность выпадения «орла»:','["0","0.25","0.5","1"]','"0.5"')
) AS x(topic_id, task_key, prompt, options, correct)
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.task_key = x.task_key);

-- Russian
INSERT INTO public.tasks (subject_id, topic_id, task_key, prompt, answer_type, options, correct_answer, difficulty, task_type)
SELECT '22222222-2222-4222-8222-222222222222'::uuid, x.topic_id, x.task_key, x.prompt, 'single', x.options::jsonb, x.correct::jsonb, 'medium'::difficulty_level, 'multiple_choice'
FROM (VALUES
  ('43629179-7712-468c-8e94-8a2588576fdf'::uuid,'rus-d-001','В каком слове пишется буква «и»?','["пр_ехать","пр_лечь","пр_морский","пр_клонить"]','"пр_морский"'),
  ('856f0168-135e-460f-8e4f-e460ebbb4916'::uuid,'rus-d-002','Где нужна запятая? «Я пришёл() и увидел.»','["перед и","после увидел","не нужна","в начале"]','"не нужна"'),
  ('93a36817-5e6f-4e3a-8e2a-60026ab81ba0'::uuid,'rus-d-003','Часть речи слова «бегущий»:','["глагол","причастие","деепричастие","прилагательное"]','"причастие"'),
  ('ac841cd0-6495-45ea-8462-7a20a611a86a'::uuid,'rus-d-004','Грамматическая основа: «Учитель вошёл в класс.»','["учитель вошёл","вошёл в","в класс","учитель в класс"]','"учитель вошёл"'),
  ('715ce1b2-c13b-41ae-9db0-ae665cb0ebd5'::uuid,'rus-d-005','Главная мысль текста — это:','["тема","идея","сюжет","композиция"]','"идея"'),
  ('d1c3af4d-0a3f-447a-aa47-5fedae39adcb'::uuid,'rus-d-006','«Море смеялось» — это:','["метафора","олицетворение","эпитет","сравнение"]','"олицетворение"'),
  ('53333333-3333-4333-8333-333333333333'::uuid,'rus-d-007','В сжатом изложении главное — это:','["детали","сюжет","основная мысль","диалоги"]','"основная мысль"'),
  ('57af04f3-c1c7-4d96-83e3-abef5ea97f23'::uuid,'rus-d-008','Аргумент в сочинении — это:','["вопрос","довод","эпитет","цитата без пояснения"]','"довод"')
) AS x(topic_id, task_key, prompt, options, correct)
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.task_key = x.task_key);

-- English
INSERT INTO public.tasks (subject_id, topic_id, task_key, prompt, answer_type, options, correct_answer, difficulty, task_type)
SELECT '33333333-3333-4333-8333-333333333333'::uuid, x.topic_id, x.task_key, x.prompt, 'single', x.options::jsonb, x.correct::jsonb, 'medium'::difficulty_level, 'multiple_choice'
FROM (VALUES
  ('56666666-6666-4666-8666-666666666666'::uuid,'eng-d-001','She ___ to school every day.','["go","goes","going","gone"]','"goes"'),
  ('56666666-6666-4666-8666-666666666666'::uuid,'eng-d-002','I ___ never been to Paris.','["has","have","had","having"]','"have"'),
  ('597bc652-9453-4c64-a883-b44c653fcc5b'::uuid,'eng-d-003','Synonym of «happy»:','["sad","angry","joyful","tired"]','"joyful"'),
  ('55555555-5555-4555-8555-555555555555'::uuid,'eng-d-004','From «decide» make a noun:','["deciding","decision","decisive","decided"]','"decision"'),
  ('84d7de16-d748-4263-a197-222ecf88524d'::uuid,'eng-d-005','«Tom is a teacher.» Tom is a:','["doctor","student","teacher","driver"]','"teacher"'),
  ('4c324ebf-80cb-4669-a396-af936206f8b9'::uuid,'eng-d-006','Listening: «I live in London.» Where?','["Paris","London","Berlin","Rome"]','"London"'),
  ('11a695b7-173e-49f7-a901-5474612a30d9'::uuid,'eng-d-007','A short personal letter usually starts with:','["Dear","Hello","Yours","Best"]','"Dear"'),
  ('726cb7f3-fb1f-4307-bdb5-c7a66aa0db8c'::uuid,'eng-d-008','«How are you?» — typical reply:','["I am 15.","Fine, thanks.","Goodbye.","Yes."]','"Fine, thanks."')
) AS x(topic_id, task_key, prompt, options, correct)
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.task_key = x.task_key);

-- Biology
INSERT INTO public.tasks (subject_id, topic_id, task_key, prompt, answer_type, options, correct_answer, difficulty, task_type)
SELECT '44444444-4444-4444-8444-444444444444'::uuid, x.topic_id, x.task_key, x.prompt, 'single', x.options::jsonb, x.correct::jsonb, 'medium'::difficulty_level, 'multiple_choice'
FROM (VALUES
  ('abf7a9ec-a56d-40a2-a36f-0f9bed9f55cf'::uuid,'bio-d-001','Основная единица живого:','["ткань","орган","клетка","система"]','"клетка"'),
  ('9f01d806-2664-4faa-92ab-967691e5c6fa'::uuid,'bio-d-002','Фотосинтез происходит в:','["митохондриях","хлоропластах","ядре","рибосомах"]','"хлоропластах"'),
  ('13170565-4ed2-4a42-bcf8-263de0c0822d'::uuid,'bio-d-003','Холоднокровные животные:','["птицы","рыбы","млекопитающие","человек"]','"рыбы"'),
  ('d8b65edf-14ed-4341-8e27-46e3fc476c74'::uuid,'bio-d-004','Орган дыхания у человека:','["сердце","печень","лёгкие","почки"]','"лёгкие"'),
  ('58888888-8888-4888-8888-888888888888'::uuid,'bio-d-005','Наследственность изучает:','["экология","генетика","ботаника","зоология"]','"генетика"'),
  ('d6e48f6d-d0b6-442d-9cfd-5cdda2bff0cc'::uuid,'bio-d-006','Автор теории эволюции:','["Менделеев","Дарвин","Павлов","Ньютон"]','"Дарвин"'),
  ('ab86bc6d-0d99-4df7-82c2-62300a3f96f8'::uuid,'bio-d-007','Сообщество живых организмов и среды:','["вид","популяция","экосистема","биом"]','"экосистема"'),
  ('0efa7471-15f5-43df-af08-ae17d17a1502'::uuid,'bio-d-008','Биологи изучают живое с помощью:','["только опытов","только книг","наблюдений и опытов","только теории"]','"наблюдений и опытов"')
) AS x(topic_id, task_key, prompt, options, correct)
WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.task_key = x.task_key);

-- Create entry diagnostics per subject (linked to oge-9 program when present)
INSERT INTO public.diagnostic_tests (title, description, subject_id, program_id, diagnostic_type, duration_minutes, is_public)
SELECT s.name || ' — входная диагностика',
       'Стартовая диагностика по предмету «' || s.name || '» для оценки уровня и слабых тем.',
       s.id,
       p.id,
       'entry',
       30,
       true
FROM public.subjects s
LEFT JOIN public.subject_programs p ON p.subject_id = s.id AND p.slug = 'oge-9'
WHERE NOT EXISTS (
  SELECT 1 FROM public.diagnostic_tests dt
  WHERE dt.subject_id = s.id AND dt.diagnostic_type = 'entry'
);

-- Bind tasks to corresponding entry diagnostics
INSERT INTO public.diagnostic_test_tasks (diagnostic_test_id, task_id, order_index, points)
SELECT dt.id, t.id,
       row_number() OVER (PARTITION BY dt.id ORDER BY t.task_key) - 1,
       1
FROM public.diagnostic_tests dt
JOIN public.tasks t ON t.subject_id = dt.subject_id AND t.task_key LIKE
  CASE dt.subject_id::text
    WHEN '11111111-1111-4111-8111-111111111111' THEN 'math-d-%'
    WHEN '22222222-2222-4222-8222-222222222222' THEN 'rus-d-%'
    WHEN '33333333-3333-4333-8333-333333333333' THEN 'eng-d-%'
    WHEN '44444444-4444-4444-8444-444444444444' THEN 'bio-d-%'
  END
WHERE dt.diagnostic_type = 'entry'
  AND NOT EXISTS (
    SELECT 1 FROM public.diagnostic_test_tasks dtt
    WHERE dtt.diagnostic_test_id = dt.id AND dtt.task_id = t.id
  );
