-- If the draft canonical title existed as a legacy OCR heading, carry the
-- draft catalog identity, not the erroneous source-heading semantics.
DO $$
DECLARE topicid uuid; groupid uuid;
BEGIN
 SELECT topic_id INTO topicid FROM public.curriculum_topic_meta
 WHERE catalog_key='ru25-orth-026';
 SELECT topic_id INTO groupid FROM public.curriculum_topic_meta
 WHERE catalog_key='ru25-group-orth';
 IF topicid IS NULL OR groupid IS NULL THEN
   RAISE EXCEPTION 'Expected canonical catalog topic and orthography section';
 END IF;
 UPDATE public.topics
 SET source_standard='frp_ru_2025_working', parent_topic_id=groupid,
     level=2, slug='ru25-orth-026', is_public=false,
     description='Рабочая тема каталога ФРП 1–11; требует методологической проверки'
 WHERE id=topicid AND source_standard='textbook_numbered_heading';
END $$;
