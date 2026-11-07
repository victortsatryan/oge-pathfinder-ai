-- Revoke incorrect topic assignments created mechanically from Goltsova § headings.
-- Preserve the source paragraphs, OCR text and complete original assignment provenance.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.materials m
  JOIN public.topics t ON t.id=m.topic_id
  WHERE m.extractor_metadata->>'derived_kind'='numbered_section'
    AND t.source_standard='textbook_numbered_heading';
  IF n <> 14 THEN
    RAISE EXCEPTION 'Expected exactly 14 legacy Goltsova bindings, got %',n;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.lesson_materials lm
    JOIN public.materials m ON m.id=lm.material_id
    JOIN public.topics t ON t.id=m.topic_id
    WHERE m.extractor_metadata->>'derived_kind'='numbered_section'
      AND t.source_standard='textbook_numbered_heading'
  ) THEN
    RAISE EXCEPTION 'Some derived materials are already used in lessons; manual migration needed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.learning_path_items p
    JOIN public.topics t ON t.id=p.topic_id
    WHERE t.source_standard='textbook_numbered_heading'
  ) THEN
    RAISE EXCEPTION 'Legacy OCR topics already appear in student routes';
  END IF;
  UPDATE public.materials m
  SET topic_id = NULL,
      extractor_metadata = m.extractor_metadata ||
        jsonb_build_object(
          'legacy_ocr_topic_id',m.topic_id::text,
          'legacy_ocr_topic_assignment',m.extractor_metadata->'topic_assignment',
          'curriculum_mapping_status','needs_approved_topic',
          'topic_assignment',NULL)
  FROM public.topics t
  WHERE t.id=m.topic_id AND t.source_standard='textbook_numbered_heading'
    AND m.extractor_metadata->>'derived_kind'='numbered_section';
  DELETE FROM public.material_topic_links l USING public.materials m, public.topics t
  WHERE l.material_id=m.id AND l.topic_id=t.id
    AND m.extractor_metadata->>'derived_kind'='numbered_section'
    AND t.source_standard='textbook_numbered_heading';
END $$;
