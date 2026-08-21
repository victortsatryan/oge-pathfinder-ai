UPDATE public.topics t
SET sort_order = (regexp_replace(t.title, '\D', '', 'g'))::int
WHERE t.subject_id = '8ee8190d-fd18-4a08-916a-7f8258c3cd7e'
  AND t.title ~ '^Задание [0-9]+ ЕГЭ$';

UPDATE public.tasks k
SET topic_id = t.id
FROM public.topics t
WHERE t.subject_id = '8ee8190d-fd18-4a08-916a-7f8258c3cd7e'
  AND t.title = 'Задание ' || k.exam_task_number::text || ' ЕГЭ'
  AND k.exam_task_number IS NOT NULL
  AND k.id IN (
    SELECT task_id FROM public.diagnostic_test_tasks
    WHERE diagnostic_test_id = 'a1000000-0000-4000-8000-000000000026'
  );