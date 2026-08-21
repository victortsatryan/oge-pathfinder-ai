-- Re-link theory materials from the generic "Теория" topic to the concrete
-- "Задание N ЕГЭ" topic, using the exam task number stored in the linked
-- learning objective title ("Освоить теоретический материал для задания N ЕГЭ").
WITH src AS (
  SELECT m.id AS material_id,
         (regexp_match(lo.title, 'задания ([0-9]+) ЕГЭ'))[1] AS task_no,
         m.subject_id
  FROM public.materials m
  JOIN public.learning_objectives lo ON lo.id = m.learning_objective_id
  WHERE m.topic_id = '616ab7c7-2c36-4a42-a039-dce4d0996642'
),
mapped AS (
  SELECT s.material_id, t.id AS new_topic_id
  FROM src s
  JOIN public.topics t
    ON t.subject_id = s.subject_id
   AND t.title = 'Задание ' || s.task_no || ' ЕГЭ'
  WHERE s.task_no IS NOT NULL
)
UPDATE public.materials m
SET topic_id = mapped.new_topic_id,
    updated_at = now()
FROM mapped
WHERE m.id = mapped.material_id;

-- Keep the learning objectives themselves consistent with their materials.
WITH lo_mapped AS (
  SELECT lo.id AS lo_id, t.id AS new_topic_id
  FROM public.learning_objectives lo
  JOIN public.topics t
    ON t.subject_id = '8ee8190d-fd18-4a08-916a-7f8258c3cd7e'
   AND t.title = 'Задание ' || (regexp_match(lo.title, 'задания ([0-9]+) ЕГЭ'))[1] || ' ЕГЭ'
  WHERE lo.topic_id = '616ab7c7-2c36-4a42-a039-dce4d0996642'
    AND lo.title ~ 'задания [0-9]+ ЕГЭ'
)
UPDATE public.learning_objectives lo
SET topic_id = lo_mapped.new_topic_id,
    updated_at = now()
FROM lo_mapped
WHERE lo.id = lo_mapped.lo_id;