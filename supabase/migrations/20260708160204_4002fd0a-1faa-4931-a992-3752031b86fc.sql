
-- Seed missing 9th-grade subjects, program links, one physics topic, and a sample physics diagnostic
DO $$
DECLARE
  v_phys uuid;
  v_chem uuid;
  v_inf  uuid;
  v_hist uuid;
  v_soc  uuid;
  v_geo  uuid;
  v_lit  uuid;
  v_ru   uuid;
  v_math uuid;
  v_en   uuid;
  v_bio  uuid;
  v_topic uuid;
  v_test uuid;
  v_task uuid;
BEGIN
  -- Insert subjects if missing
  INSERT INTO public.subjects (slug, name, description, category, exam_type, sort_order)
  VALUES
    ('physics',        'Физика',          'Школьный предмет',       'science',    'OGE', 50),
    ('chemistry',      'Химия',           'Школьный предмет',       'science',    'OGE', 60),
    ('informatics',    'Информатика',     'Школьный предмет',       'science',    'OGE', 70),
    ('history',        'История',         'Школьный предмет',       'humanities', 'OGE', 80),
    ('social_studies', 'Обществознание',  'Школьный предмет',       'humanities', 'OGE', 90),
    ('geography',      'География',       'Школьный предмет',       'science',    'OGE', 100),
    ('literature',     'Литература',      'Школьный предмет',       'humanities', 'OGE', 110)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_phys FROM public.subjects WHERE slug = 'physics';
  SELECT id INTO v_chem FROM public.subjects WHERE slug = 'chemistry';
  SELECT id INTO v_inf  FROM public.subjects WHERE slug = 'informatics';
  SELECT id INTO v_hist FROM public.subjects WHERE slug = 'history';
  SELECT id INTO v_soc  FROM public.subjects WHERE slug = 'social_studies';
  SELECT id INTO v_geo  FROM public.subjects WHERE slug = 'geography';
  SELECT id INTO v_lit  FROM public.subjects WHERE slug = 'literature';
  SELECT id INTO v_ru   FROM public.subjects WHERE slug = 'russian';
  SELECT id INTO v_math FROM public.subjects WHERE slug = 'mathematics';
  SELECT id INTO v_en   FROM public.subjects WHERE slug = 'english';
  SELECT id INTO v_bio  FROM public.subjects WHERE slug = 'biology';

  -- Make sure existing 9th-grade subjects are also marked as OGE for the onboarding filter
  UPDATE public.subjects SET exam_type = 'OGE'
    WHERE slug IN ('russian','mathematics','english','biology') AND (exam_type IS NULL OR exam_type = '');

  -- Program per new subject: Russian school 9 (OGE optional)
  INSERT INTO public.subject_programs (subject_id, slug, title, grade, program_type, exam_type, language)
  VALUES
    (v_phys, 'oge-9', 'Физика — 9 класс (ОГЭ)',         '9', 'ru_school', 'OGE', 'ru'),
    (v_chem, 'oge-9', 'Химия — 9 класс (ОГЭ)',          '9', 'ru_school', 'OGE', 'ru'),
    (v_inf,  'oge-9', 'Информатика — 9 класс (ОГЭ)',    '9', 'ru_school', 'OGE', 'ru'),
    (v_hist, 'oge-9', 'История — 9 класс (ОГЭ)',        '9', 'ru_school', 'OGE', 'ru'),
    (v_soc,  'oge-9', 'Обществознание — 9 класс (ОГЭ)', '9', 'ru_school', 'OGE', 'ru'),
    (v_geo,  'oge-9', 'География — 9 класс (ОГЭ)',      '9', 'ru_school', 'OGE', 'ru'),
    (v_lit,  'oge-9', 'Литература — 9 класс (ОГЭ)',     '9', 'ru_school', 'OGE', 'ru')
  ON CONFLICT (subject_id, slug) DO NOTHING;

  -- Minimal physics 9 topic + sample diagnostic
  IF NOT EXISTS (SELECT 1 FROM public.topics WHERE subject_id = v_phys AND pcs_key = 'phys.mechanics.basics') THEN
    INSERT INTO public.topics (subject_id, title, pcs_key, topic_type, level, sort_order)
    VALUES (v_phys, 'Механика: основы', 'phys.mechanics.basics', 'topic', 2, 1)
    RETURNING id INTO v_topic;
  ELSE
    SELECT id INTO v_topic FROM public.topics WHERE subject_id = v_phys AND pcs_key = 'phys.mechanics.basics';
  END IF;

  -- Sample diagnostic (idempotent by title)
  SELECT id INTO v_test FROM public.diagnostic_tests
    WHERE subject_id = v_phys AND title = 'Физика — входная диагностика (9 класс)';
  IF v_test IS NULL THEN
    INSERT INTO public.diagnostic_tests (title, description, subject_id, diagnostic_type, duration_minutes, is_public)
    VALUES (
      'Физика — входная диагностика (9 класс)',
      'Короткий вход: проверяем базовые понятия механики.',
      v_phys, 'entry', 15, true
    ) RETURNING id INTO v_test;

    -- Task 1
    INSERT INTO public.tasks (subject_id, topic_id, task_key, prompt, answer_type, options, correct_answer, explanation, difficulty)
    VALUES (
      v_phys, v_topic, 'phys.oge9.mech.q1',
      'Тело движется равномерно со скоростью 5 м/с. Какой путь оно пройдёт за 4 секунды?',
      'single',
      '["10 м","15 м","20 м","25 м"]'::jsonb,
      '"20 м"'::jsonb,
      'S = v · t = 5 · 4 = 20 м.',
      'easy'
    ) RETURNING id INTO v_task;
    INSERT INTO public.diagnostic_test_tasks (diagnostic_test_id, task_id, order_index, points) VALUES (v_test, v_task, 1, 1);

    -- Task 2
    INSERT INTO public.tasks (subject_id, topic_id, task_key, prompt, answer_type, options, correct_answer, explanation, difficulty)
    VALUES (
      v_phys, v_topic, 'phys.oge9.mech.q2',
      'В каких единицах измеряется сила в системе СИ?',
      'single',
      '["Джоуль","Ньютон","Ватт","Паскаль"]'::jsonb,
      '"Ньютон"'::jsonb,
      'Сила в СИ измеряется в ньютонах (Н).',
      'easy'
    ) RETURNING id INTO v_task;
    INSERT INTO public.diagnostic_test_tasks (diagnostic_test_id, task_id, order_index, points) VALUES (v_test, v_task, 2, 1);

    -- Task 3
    INSERT INTO public.tasks (subject_id, topic_id, task_key, prompt, answer_type, options, correct_answer, explanation, difficulty)
    VALUES (
      v_phys, v_topic, 'phys.oge9.mech.q3',
      'Автомобиль массой 1000 кг движется с ускорением 2 м/с². Какая сила действует на автомобиль?',
      'single',
      '["500 Н","1000 Н","2000 Н","4000 Н"]'::jsonb,
      '"2000 Н"'::jsonb,
      'F = m · a = 1000 · 2 = 2000 Н.',
      'medium'
    ) RETURNING id INTO v_task;
    INSERT INTO public.diagnostic_test_tasks (diagnostic_test_id, task_id, order_index, points) VALUES (v_test, v_task, 3, 1);
  END IF;
END $$;
