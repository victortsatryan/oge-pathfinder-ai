-- Existing legacy title dedup must not collapse distinct OCR units sharing a heading.
-- Preserve legacy dedup for non-extractor content and enforce source-unit identity instead.
drop index if exists public.uniq_materials_dedup;
create unique index uniq_materials_dedup on public.materials
  (subject_id, coalesce(topic_id, '00000000-0000-0000-0000-000000000000'::uuid),
   lower(title), coalesce(source_url, ''))
  where extractor_metadata is null;
create unique index if not exists uniq_extractor_unit_key
  on public.materials ((extractor_metadata->>'unit_key'))
  where extractor_metadata is not null and extractor_metadata ? 'unit_key';
