ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS exam_task_number integer;
CREATE INDEX IF NOT EXISTS tasks_exam_task_number_idx ON public.tasks (exam_task_number);
CREATE UNIQUE INDEX IF NOT EXISTS diagnostic_answers_session_task_uidx ON public.diagnostic_answers (diagnostic_session_id, task_id);
CREATE UNIQUE INDEX IF NOT EXISTS diagnostic_topic_results_session_topic_uidx ON public.diagnostic_topic_results (diagnostic_session_id, topic_id);
-- remove the incomplete diagnostic rows that landed in the materials library without answer keys
DELETE FROM public.materials
WHERE source_name = 'Диагностический вариант ЕГЭ'
  AND status = 'draft'
  AND title LIKE 'Диагностика ЕГЭ · Задание%';