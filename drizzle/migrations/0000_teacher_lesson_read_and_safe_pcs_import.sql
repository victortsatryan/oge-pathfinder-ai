-- P2: linked teacher can READ a student's lesson data (no write rights).
CREATE OR REPLACE FUNCTION public.can_teacher_view_lesson(_lesson_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = _lesson_id
      AND l.student_profile_id IS NOT NULL
      AND public.is_teacher_of_student(auth.uid(), l.student_profile_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_teacher_view_lesson(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_teacher_view_lesson(uuid) TO authenticated;

CREATE POLICY "lessons_select_linked_teacher" ON public.lessons
  FOR SELECT TO authenticated
  USING (student_profile_id IS NOT NULL AND public.is_teacher_of_student(auth.uid(), student_profile_id));
CREATE POLICY "lm_select_linked_teacher" ON public.lesson_materials
  FOR SELECT TO authenticated USING (public.can_teacher_view_lesson(lesson_id));
CREATE POLICY "lt_select_linked_teacher" ON public.lesson_tasks
  FOR SELECT TO authenticated USING (public.can_teacher_view_lesson(lesson_id));
CREATE POLICY "lr_select_linked_teacher" ON public.lesson_results
  FOR SELECT TO authenticated USING (public.can_teacher_view_lesson(lesson_id));
CREATE POLICY "ta_select_linked_teacher" ON public.task_attempts
  FOR SELECT TO authenticated
  USING (student_profile_id IS NOT NULL AND public.is_teacher_of_student(auth.uid(), student_profile_id));

-- P3: pcs_import no longer deletes child collections when a section is absent or empty.
CREATE OR REPLACE FUNCTION public.pcs_import(payload jsonb, mode text DEFAULT 'update'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  has_examples boolean := jsonb_typeof(payload->'examples') = 'array' AND jsonb_array_length(payload->'examples') > 0;
  has_patterns boolean := jsonb_typeof(payload->'task_patterns') = 'array' AND jsonb_array_length(payload->'task_patterns') > 0;
  has_sources  boolean := jsonb_typeof(payload->'sources') = 'array' AND jsonb_array_length(payload->'sources') > 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Only admins can import content';
  END IF;

  j := payload->'subject';
  SELECT id INTO v_subject_id FROM public.subjects
    WHERE pcs_key = j->>'key' OR slug = j->>'key' LIMIT 1;
  IF v_subject_id IS NULL THEN
    INSERT INTO public.subjects (slug, name, pcs_key, created_by)
      VALUES (COALESCE(j->>'key', lower(replace(j->>'title',' ','_'))), j->>'title', j->>'key', auth.uid())
      RETURNING id INTO v_subject_id;
    v_created := v_created + 1;
  END IF;

  j := payload->'program';
  SELECT id INTO v_program_id FROM public.subject_programs
    WHERE pcs_key = j->>'key' OR (subject_id = v_subject_id AND slug = j->>'key') LIMIT 1;
  IF v_program_id IS NULL THEN
    INSERT INTO public.subject_programs (subject_id, slug, title, pcs_key, grade, created_by)
      VALUES (v_subject_id, j->>'key', j->>'title', j->>'key', payload->>'grade', auth.uid())
      RETURNING id INTO v_program_id;
    v_created := v_created + 1;
  END IF;

  j := payload->'section';
  SELECT id INTO v_section_id FROM public.topics
    WHERE subject_id = v_subject_id AND pcs_key = j->>'key' AND topic_type = 'section' LIMIT 1;
  IF v_section_id IS NULL THEN
    INSERT INTO public.topics (subject_id, title, pcs_key, topic_type, level, sort_order, created_by)
      VALUES (v_subject_id, j->>'title', j->>'key', 'section', 1, COALESCE((j->>'order')::int,0), auth.uid())
      RETURNING id INTO v_section_id;
    v_created := v_created + 1;
  END IF;

  j := payload->'topic';
  SELECT id INTO v_topic_id FROM public.topics
    WHERE subject_id = v_subject_id AND pcs_key = j->>'key' AND topic_type='topic' LIMIT 1;
  IF v_topic_id IS NULL THEN
    INSERT INTO public.topics (subject_id, title, pcs_key, topic_type, parent_topic_id, level, sort_order, created_by)
      VALUES (v_subject_id, j->>'title', j->>'key', 'topic', v_section_id, 2, COALESCE((j->>'order')::int,0), auth.uid())
      RETURNING id INTO v_topic_id;
    v_created := v_created + 1;
  END IF;

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

      -- New version inherits child collections that the payload does not supply.
      IF NOT has_examples THEN
        INSERT INTO public.lo_examples (learning_objective_id, title, statement, solution, order_index)
        SELECT v_lo_id, title, statement, solution, order_index FROM public.lo_examples WHERE learning_objective_id = v_existing_lo;
      END IF;
      IF NOT has_patterns THEN
        INSERT INTO public.task_patterns (learning_objective_id, pattern_key, statement_template, answer_schema, difficulty, hints, order_index)
        SELECT v_lo_id, pattern_key, statement_template, answer_schema, difficulty, hints, order_index FROM public.task_patterns WHERE learning_objective_id = v_existing_lo;
      END IF;
      IF NOT has_sources THEN
        INSERT INTO public.lo_sources (learning_objective_id, name, url, citation, license, order_index)
        SELECT v_lo_id, name, url, citation, license, order_index FROM public.lo_sources WHERE learning_objective_id = v_existing_lo;
      END IF;
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

  -- Child collections: replaced only when the payload supplies a non-empty section.
  IF has_examples THEN
    DELETE FROM public.lo_examples WHERE learning_objective_id = v_lo_id;
    FOR item IN SELECT * FROM jsonb_array_elements(payload->'examples') LOOP
      INSERT INTO public.lo_examples (learning_objective_id, title, statement, solution, order_index)
      VALUES (v_lo_id, item->>'title', item->>'statement', item->>'solution', COALESCE((item->>'order')::int,0));
    END LOOP;
  END IF;

  IF has_patterns THEN
    DELETE FROM public.task_patterns WHERE learning_objective_id = v_lo_id;
    FOR item IN SELECT * FROM jsonb_array_elements(payload->'task_patterns') LOOP
      INSERT INTO public.task_patterns (learning_objective_id, pattern_key, statement_template, answer_schema, difficulty, hints, order_index)
      VALUES (v_lo_id, item->>'key', item->>'statement_template', item->'answer_schema',
              COALESCE((item->>'difficulty')::int,1), item->'hints', COALESCE((item->>'order')::int,0));
    END LOOP;
  END IF;

  IF has_sources THEN
    DELETE FROM public.lo_sources WHERE learning_objective_id = v_lo_id;
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
$function$;