
-- Add pcs_key to diagnostic_tests for idempotent PCS imports
ALTER TABLE public.diagnostic_tests
  ADD COLUMN IF NOT EXISTS pcs_key text;

CREATE UNIQUE INDEX IF NOT EXISTS diagnostic_tests_pcs_key_key
  ON public.diagnostic_tests (pcs_key) WHERE pcs_key IS NOT NULL;

-- RPC: import a diagnostic test with its tasks and topic bindings from a PCS JSON payload.
-- Admin-only. Idempotent: reuses subject/program/topics by pcs_key or slug; upserts diagnostic
-- and tasks by pcs_key / task_key; replaces the test->task junction rows.
CREATE OR REPLACE FUNCTION public.pcs_import_diagnostic(payload jsonb, mode text DEFAULT 'update')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_subject_id uuid;
  v_program_id uuid;
  v_test_id uuid;
  v_task_id uuid;
  v_topic_id uuid;
  v_created int := 0;
  v_updated int := 0;
  v_task_count int := 0;
  j jsonb;
  d jsonb;
  t jsonb;
  v_existing_test uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can import content';
  END IF;

  IF payload->>'kind' <> 'diagnostic_test' THEN
    RAISE EXCEPTION 'Payload kind must be "diagnostic_test"';
  END IF;

  d := payload->'diagnostic_test';
  IF d IS NULL THEN
    RAISE EXCEPTION 'Missing diagnostic_test block';
  END IF;

  -- SUBJECT (must exist)
  j := payload->'subject';
  SELECT id INTO v_subject_id FROM public.subjects
    WHERE pcs_key = j->>'key' OR slug = j->>'key' LIMIT 1;
  IF v_subject_id IS NULL THEN
    RAISE EXCEPTION 'Subject not found for key %', j->>'key';
  END IF;

  -- PROGRAM (optional)
  j := payload->'program';
  IF j IS NOT NULL AND j->>'key' IS NOT NULL THEN
    SELECT id INTO v_program_id FROM public.subject_programs
      WHERE pcs_key = j->>'key'
         OR (subject_id = v_subject_id AND slug = j->>'key')
      LIMIT 1;
  END IF;

  -- DIAGNOSTIC TEST upsert by pcs_key
  SELECT id INTO v_existing_test FROM public.diagnostic_tests
    WHERE pcs_key = d->>'key' LIMIT 1;

  IF v_existing_test IS NOT NULL AND mode = 'skip' THEN
    RETURN jsonb_build_object('status','skipped','diagnostic_test_id', v_existing_test);
  END IF;

  IF v_existing_test IS NULL THEN
    INSERT INTO public.diagnostic_tests
      (subject_id, program_id, title, description, diagnostic_type, duration_minutes,
       source_name, source_url, is_public, pcs_key, created_by)
    VALUES
      (v_subject_id, v_program_id, d->>'title', d->>'description',
       COALESCE(d->>'diagnostic_type','entry'),
       NULLIF(d->>'duration_minutes','')::int,
       d->>'source_name', d->>'source_url',
       COALESCE((d->>'is_public')::boolean, true),
       d->>'key', auth.uid())
    RETURNING id INTO v_test_id;
    v_created := v_created + 1;
  ELSE
    UPDATE public.diagnostic_tests SET
      subject_id = v_subject_id,
      program_id = v_program_id,
      title = d->>'title',
      description = COALESCE(d->>'description', description),
      diagnostic_type = COALESCE(d->>'diagnostic_type', diagnostic_type),
      duration_minutes = COALESCE(NULLIF(d->>'duration_minutes','')::int, duration_minutes),
      source_name = COALESCE(d->>'source_name', source_name),
      source_url = COALESCE(d->>'source_url', source_url),
      is_public = COALESCE((d->>'is_public')::boolean, is_public),
      updated_at = now()
    WHERE id = v_existing_test;
    v_test_id := v_existing_test;
    v_updated := v_updated + 1;
  END IF;

  -- Reset junction; will re-insert task links below
  DELETE FROM public.diagnostic_test_tasks WHERE diagnostic_test_id = v_test_id;

  -- TASKS
  IF d ? 'tasks' THEN
    FOR t IN SELECT * FROM jsonb_array_elements(d->'tasks') LOOP
      v_topic_id := NULL;
      IF t ? 'topic_key' AND t->>'topic_key' IS NOT NULL THEN
        SELECT id INTO v_topic_id FROM public.topics
          WHERE subject_id = v_subject_id
            AND (pcs_key = t->>'topic_key' OR slug = t->>'topic_key' OR theme_code = t->>'topic_key')
          LIMIT 1;
      END IF;

      -- Upsert task by task_key (globally unique)
      SELECT id INTO v_task_id FROM public.tasks WHERE task_key = t->>'key' LIMIT 1;
      IF v_task_id IS NULL THEN
        INSERT INTO public.tasks
          (subject_id, program_id, topic_id, task_key, prompt, answer_type, options,
           correct_answer, explanation, difficulty, task_type, tags, source_name, source_url,
           is_published)
        VALUES
          (v_subject_id, v_program_id, v_topic_id, t->>'key', t->>'prompt',
           COALESCE(t->>'answer_type','single'),
           COALESCE(t->'options', '[]'::jsonb),
           t->'correct_answer',
           t->>'explanation',
           COALESCE(t->>'difficulty','medium')::public.difficulty_level,
           t->>'task_type',
           COALESCE(ARRAY(SELECT jsonb_array_elements_text(t->'tags')), ARRAY[]::text[]),
           t->>'source_name', t->>'source_url',
           true)
        RETURNING id INTO v_task_id;
        v_created := v_created + 1;
      ELSE
        UPDATE public.tasks SET
          subject_id = v_subject_id,
          program_id = COALESCE(v_program_id, program_id),
          topic_id = COALESCE(v_topic_id, topic_id),
          prompt = t->>'prompt',
          answer_type = COALESCE(t->>'answer_type', answer_type),
          options = COALESCE(t->'options', options),
          correct_answer = COALESCE(t->'correct_answer', correct_answer),
          explanation = COALESCE(t->>'explanation', explanation),
          difficulty = COALESCE((t->>'difficulty')::public.difficulty_level, difficulty),
          task_type = COALESCE(t->>'task_type', task_type),
          tags = CASE WHEN t ? 'tags'
                      THEN COALESCE(ARRAY(SELECT jsonb_array_elements_text(t->'tags')), ARRAY[]::text[])
                      ELSE tags END,
          source_name = COALESCE(t->>'source_name', source_name),
          source_url = COALESCE(t->>'source_url', source_url),
          is_published = true,
          updated_at = now()
        WHERE id = v_task_id;
        v_updated := v_updated + 1;
      END IF;

      INSERT INTO public.diagnostic_test_tasks
        (diagnostic_test_id, task_id, order_index, points)
      VALUES
        (v_test_id, v_task_id,
         COALESCE((t->>'order')::int, v_task_count),
         COALESCE((t->>'points')::int, 1));
      v_task_count := v_task_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_existing_test IS NULL THEN 'created' ELSE 'updated' END,
    'diagnostic_test_id', v_test_id,
    'subject_id', v_subject_id,
    'program_id', v_program_id,
    'tasks_linked', v_task_count,
    'created', v_created,
    'updated', v_updated
  );
END;
$function$;
