
-- Extend learning_objectives
ALTER TABLE public.learning_objectives
  ADD COLUMN IF NOT EXISTS theory text,
  ADD COLUMN IF NOT EXISTS algorithm text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS pcs_key text,
  ADD COLUMN IF NOT EXISTS pcs_version text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_json jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='learning_objectives_status_check') THEN
    ALTER TABLE public.learning_objectives ADD CONSTRAINT learning_objectives_status_check
      CHECK (status IN ('draft','reviewed','published','archived'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS learning_objectives_pcs_key_topic_uniq
  ON public.learning_objectives(topic_id, pcs_key) WHERE pcs_key IS NOT NULL;

-- Extend topics / subject_programs with pcs_key
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS pcs_key text;
CREATE UNIQUE INDEX IF NOT EXISTS topics_pcs_key_subject_uniq
  ON public.topics(subject_id, pcs_key) WHERE pcs_key IS NOT NULL;

ALTER TABLE public.subject_programs ADD COLUMN IF NOT EXISTS pcs_key text;
CREATE UNIQUE INDEX IF NOT EXISTS subject_programs_pcs_key_uniq
  ON public.subject_programs(pcs_key) WHERE pcs_key IS NOT NULL;

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS pcs_key text;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_pcs_key_uniq
  ON public.subjects(pcs_key) WHERE pcs_key IS NOT NULL;

-- lo_examples
CREATE TABLE IF NOT EXISTS public.lo_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id uuid NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  title text,
  statement text NOT NULL,
  solution text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lo_examples TO authenticated;
GRANT ALL ON public.lo_examples TO service_role;
ALTER TABLE public.lo_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lo_examples read" ON public.lo_examples FOR SELECT TO authenticated USING (true);
CREATE POLICY "lo_examples admin manage" ON public.lo_examples FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lo_examples_updated_at BEFORE UPDATE ON public.lo_examples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- task_patterns
CREATE TABLE IF NOT EXISTS public.task_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id uuid NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  pattern_key text,
  statement_template text NOT NULL,
  answer_schema jsonb,
  difficulty integer NOT NULL DEFAULT 1,
  hints jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.task_patterns TO authenticated;
GRANT ALL ON public.task_patterns TO service_role;
ALTER TABLE public.task_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_patterns read" ON public.task_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_patterns admin manage" ON public.task_patterns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_task_patterns_updated_at BEFORE UPDATE ON public.task_patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- lo_sources
CREATE TABLE IF NOT EXISTS public.lo_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id uuid NOT NULL REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text,
  citation text,
  license text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lo_sources TO authenticated;
GRANT ALL ON public.lo_sources TO service_role;
ALTER TABLE public.lo_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lo_sources read" ON public.lo_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "lo_sources admin manage" ON public.lo_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lo_sources_updated_at BEFORE UPDATE ON public.lo_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- lo_diagnostic_settings
CREATE TABLE IF NOT EXISTS public.lo_diagnostic_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_objective_id uuid NOT NULL UNIQUE REFERENCES public.learning_objectives(id) ON DELETE CASCADE,
  min_tasks integer NOT NULL DEFAULT 3,
  mastery_threshold integer NOT NULL DEFAULT 70,
  difficulty_curve jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lo_diagnostic_settings TO authenticated;
GRANT ALL ON public.lo_diagnostic_settings TO service_role;
ALTER TABLE public.lo_diagnostic_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lo_diagnostic read" ON public.lo_diagnostic_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "lo_diagnostic admin manage" ON public.lo_diagnostic_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lo_diag_updated_at BEFORE UPDATE ON public.lo_diagnostic_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- content_imports
CREATE TABLE IF NOT EXISTS public.content_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text,
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  pcs_version text,
  status text NOT NULL DEFAULT 'success',
  rows_created integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_failed integer NOT NULL DEFAULT 0,
  summary jsonb,
  error_log jsonb
);
GRANT SELECT, INSERT ON public.content_imports TO authenticated;
GRANT ALL ON public.content_imports TO service_role;
ALTER TABLE public.content_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_imports admin read" ON public.content_imports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "content_imports admin insert" ON public.content_imports FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- pcs_import RPC (transactional)
CREATE OR REPLACE FUNCTION public.pcs_import(payload jsonb, mode text DEFAULT 'update')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject_id uuid;
  v_program_id uuid;
  v_section_id uuid;
  v_topic_id uuid;
  v_subtopic_id uuid;
  v_lo_id uuid;
  v_created int := 0;
  v_updated int := 0;
  v_existing_lo uuid;
  j jsonb;
  item jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only admins can import content';
  END IF;

  -- SUBJECT
  j := payload->'subject';
  SELECT id INTO v_subject_id FROM public.subjects
    WHERE pcs_key = j->>'key' OR slug = j->>'key' LIMIT 1;
  IF v_subject_id IS NULL THEN
    INSERT INTO public.subjects (slug, name, pcs_key, created_by)
      VALUES (COALESCE(j->>'key', lower(replace(j->>'title',' ','_'))), j->>'title', j->>'key', auth.uid())
      RETURNING id INTO v_subject_id;
    v_created := v_created + 1;
  END IF;

  -- PROGRAM
  j := payload->'program';
  SELECT id INTO v_program_id FROM public.subject_programs
    WHERE pcs_key = j->>'key' OR (subject_id = v_subject_id AND slug = j->>'key') LIMIT 1;
  IF v_program_id IS NULL THEN
    INSERT INTO public.subject_programs (subject_id, slug, title, pcs_key, grade, created_by)
      VALUES (v_subject_id, j->>'key', j->>'title', j->>'key', payload->>'grade', auth.uid())
      RETURNING id INTO v_program_id;
    v_created := v_created + 1;
  END IF;

  -- SECTION (topic with topic_type='section')
  j := payload->'section';
  SELECT id INTO v_section_id FROM public.topics
    WHERE subject_id = v_subject_id AND pcs_key = j->>'key' AND topic_type = 'section' LIMIT 1;
  IF v_section_id IS NULL THEN
    INSERT INTO public.topics (subject_id, title, pcs_key, topic_type, level, sort_order, created_by)
      VALUES (v_subject_id, j->>'title', j->>'key', 'section', 1, COALESCE((j->>'order')::int,0), auth.uid())
      RETURNING id INTO v_section_id;
    v_created := v_created + 1;
  END IF;

  -- TOPIC
  j := payload->'topic';
  SELECT id INTO v_topic_id FROM public.topics
    WHERE subject_id = v_subject_id AND pcs_key = j->>'key' AND topic_type='topic' LIMIT 1;
  IF v_topic_id IS NULL THEN
    INSERT INTO public.topics (subject_id, title, pcs_key, topic_type, parent_topic_id, level, sort_order, created_by)
      VALUES (v_subject_id, j->>'title', j->>'key', 'topic', v_section_id, 2, COALESCE((j->>'order')::int,0), auth.uid())
      RETURNING id INTO v_topic_id;
    v_created := v_created + 1;
  END IF;

  -- SUBTOPIC
  j := payload->'subtopic';
  IF j IS NOT NULL AND j->>'key' IS NOT NULL THEN
    SELECT id INTO v_subtopic_id FROM public.topics
      WHERE subject_id = v_subject_id AND pcs_key = j->>'key' AND topic_type='subtopic' LIMIT 1;
    IF v_subtopic_id IS NULL THEN
      INSERT INTO public.topics (subject_id, title, pcs_key, topic_type, parent_topic_id, level, sort_order, created_by)
        VALUES (v_subject_id, j->>'title', j->>'key', 'subtopic', v_topic_id, 3, COALESCE((j->>'order')::int,0), auth.uid())
        RETURNING id INTO v_subtopic_id;
      v_created := v_created + 1;
    END IF;
  ELSE
    v_subtopic_id := v_topic_id;
  END IF;

  -- LEARNING OBJECTIVE
  j := payload->'learning_objective';
  SELECT id INTO v_existing_lo FROM public.learning_objectives
    WHERE topic_id = v_subtopic_id AND pcs_key = j->>'key' LIMIT 1;

  IF v_existing_lo IS NOT NULL AND mode = 'skip' THEN
    RETURN jsonb_build_object('status','skipped','learning_objective_id',v_existing_lo);
  END IF;

  IF v_existing_lo IS NULL THEN
    INSERT INTO public.learning_objectives
      (topic_id, title, description, theory, algorithm, status, pcs_key, pcs_version, version, source_json, created_by)
    VALUES
      (v_subtopic_id, j->>'title', j->>'description', j->>'theory', j->>'algorithm',
       COALESCE(j->>'status','draft'), j->>'key', payload->>'pcs_version', 1, payload, auth.uid())
    RETURNING id INTO v_lo_id;
    v_created := v_created + 1;
  ELSE
    IF mode = 'new_version' THEN
      INSERT INTO public.learning_objectives
        (topic_id, title, description, theory, algorithm, status, pcs_key, pcs_version,
         version, source_json, created_by)
      SELECT v_subtopic_id, j->>'title', j->>'description', j->>'theory', j->>'algorithm',
             COALESCE(j->>'status','draft'), (j->>'key') || '@v' || (version+1)::text, payload->>'pcs_version',
             version + 1, payload, auth.uid()
      FROM public.learning_objectives WHERE id = v_existing_lo
      RETURNING id INTO v_lo_id;
      v_created := v_created + 1;
    ELSE
      UPDATE public.learning_objectives SET
        title = j->>'title',
        description = COALESCE(j->>'description', description),
        theory = j->>'theory',
        algorithm = j->>'algorithm',
        status = COALESCE(j->>'status', status),
        pcs_version = payload->>'pcs_version',
        source_json = payload,
        updated_at = now()
      WHERE id = v_existing_lo;
      v_lo_id := v_existing_lo;
      v_updated := v_updated + 1;
    END IF;
  END IF;

  -- Replace child collections
  DELETE FROM public.lo_examples WHERE learning_objective_id = v_lo_id;
  IF payload ? 'examples' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(payload->'examples') LOOP
      INSERT INTO public.lo_examples (learning_objective_id, title, statement, solution, order_index)
      VALUES (v_lo_id, item->>'title', item->>'statement', item->>'solution', COALESCE((item->>'order')::int,0));
    END LOOP;
  END IF;

  DELETE FROM public.task_patterns WHERE learning_objective_id = v_lo_id;
  IF payload ? 'task_patterns' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(payload->'task_patterns') LOOP
      INSERT INTO public.task_patterns (learning_objective_id, pattern_key, statement_template, answer_schema, difficulty, hints, order_index)
      VALUES (v_lo_id, item->>'key', item->>'statement_template', item->'answer_schema',
              COALESCE((item->>'difficulty')::int,1), item->'hints', COALESCE((item->>'order')::int,0));
    END LOOP;
  END IF;

  DELETE FROM public.lo_sources WHERE learning_objective_id = v_lo_id;
  IF payload ? 'sources' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(payload->'sources') LOOP
      INSERT INTO public.lo_sources (learning_objective_id, name, url, citation, license, order_index)
      VALUES (v_lo_id, item->>'name', item->>'url', item->>'citation', item->>'license', COALESCE((item->>'order')::int,0));
    END LOOP;
  END IF;

  IF payload ? 'diagnostic' THEN
    INSERT INTO public.lo_diagnostic_settings (learning_objective_id, min_tasks, mastery_threshold, difficulty_curve)
    VALUES (v_lo_id,
            COALESCE((payload->'diagnostic'->>'min_tasks')::int, 3),
            COALESCE((payload->'diagnostic'->>'mastery_threshold')::int, 70),
            payload->'diagnostic'->'difficulty_curve')
    ON CONFLICT (learning_objective_id) DO UPDATE SET
      min_tasks = EXCLUDED.min_tasks,
      mastery_threshold = EXCLUDED.mastery_threshold,
      difficulty_curve = EXCLUDED.difficulty_curve,
      updated_at = now();
  END IF;

  -- Materials
  IF payload ? 'materials' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(payload->'materials') LOOP
      INSERT INTO public.materials (subject_id, program_id, topic_id, learning_objective_id,
        title, description, material_type, source_name, source_url, content_text, video_url, file_url,
        difficulty, estimated_time_minutes, license_note, status, created_by)
      VALUES (v_subject_id, v_program_id, v_subtopic_id, v_lo_id,
        item->>'title', item->>'description', COALESCE(item->>'type','article'),
        item->>'source_name', item->>'url', item->>'content_text', item->>'video_url', item->>'file_url',
        COALESCE((item->>'difficulty')::int,1), COALESCE((item->>'estimated_time_minutes')::int, NULL),
        item->>'license_note', COALESCE(item->>'status','published'), auth.uid());
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_existing_lo IS NULL THEN 'created' ELSE 'updated' END,
    'learning_objective_id', v_lo_id,
    'subject_id', v_subject_id,
    'program_id', v_program_id,
    'topic_id', v_topic_id,
    'created', v_created,
    'updated', v_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pcs_import(jsonb, text) TO authenticated;
