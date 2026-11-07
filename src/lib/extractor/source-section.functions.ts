import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { matchCurriculumHeading, type CurriculumMatchTopic } from "@/lib/curriculum/catalog-matcher";
import { parseSourceSections, type SectionCandidate, type SourceTextUnit } from "./source-sections";

async function assertAdmin(sb: any, userId: string) {
  const result = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (result.error || !result.data) throw new Error("Доступ к автораспределению — только администратору");
}

async function getSourceSections(sb: any, jobId: string) {
  const j = await sb.from("extractor_jobs").select("id,status,file_name,file_sha256,rights_basis,subject_id,author")
    .eq("id", jobId).maybeSingle();
  if (j.error || !j.data) throw new Error("Обработка источника не найдена");
  const job = j.data;
  if (job.status !== "published" || !job.subject_id) throw new Error("Сначала завершите публикацию с указанием предмета");
  if (!["own", "licensed", "public_domain"].includes(job.rights_basis)) throw new Error("Права источника не подтверждены");
  const units: SourceTextUnit[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const page = await sb.from("materials")
      .select("id,title,content_text,extractor_metadata")
      .eq("extractor_metadata->>job_id", job.id)
      .order("created_at", { ascending: true })
      .range(offset, offset + 499);
    if (page.error) throw new Error(page.error.message);
    for (const m of page.data ?? []) {
      if (!(m.extractor_metadata as Record<string, unknown> | null)?.derived_kind) units.push({ id: m.id, title: m.title, content_text: m.content_text });
    }
    if ((page.data ?? []).length < 500) break;
  }
  return { job, sections: parseSourceSections(units) };
}

async function getCurriculumCatalog(sb: any, subjectId: string): Promise<CurriculumMatchTopic[]> {
  const topicQuery = await sb.from("topics").select("id,title,is_public")
    .eq("subject_id", subjectId).limit(1500);
  if (topicQuery.error) throw new Error(topicQuery.error.message);
  const meta = await sb.from("curriculum_topic_meta")
    .select("topic_id,review_status").limit(1500);
  if (meta.error) throw new Error(meta.error.message);
  const aliases = await sb.from("curriculum_topic_aliases")
    .select("topic_id,alias_text,is_approved").eq("subject_id", subjectId).limit(2000);
  if (aliases.error) throw new Error(aliases.error.message);
  const metaMap = new Map<string, string>((meta.data ?? []).map((m: any) =>
    [m.topic_id, m.review_status]));
  return (topicQuery.data ?? []).filter((t: any) => metaMap.has(t.id)).map((t: any) => ({
    id: t.id, title: t.title,
    review_status: (metaMap.get(t.id) ?? "draft") as "draft" | "approved" | "retired",
    aliases: (aliases.data ?? []).filter((a: any) => a.topic_id === t.id && a.is_approved)
      .map((a: any) => a.alias_text),
  }));
}

export const previewSourceTopicSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ job_id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { job, sections } = await getSourceSections(sb, data.job_id);
    const catalog = await getCurriculumCatalog(sb, job.subject_id);
    const existingResult = await sb.from("materials").select("extractor_metadata")
      .eq("extractor_metadata->>job_id", data.job_id)
      .eq("extractor_metadata->>derived_kind","numbered_section").limit(500);
    if (existingResult.error) throw new Error(existingResult.error.message);
    const existing = new Set((existingResult.data ?? [])
      .map((m: any) => Number(m.extractor_metadata?.section_number)));
    const rows = sections.map((sec) => {
      const match = matchCurriculumHeading(sec.title, catalog);
      const confident = sec.confidence === "high";
      return {
        number: sec.number, title: sec.title,
        confidence: sec.confidence, characters: sec.text.length,
        preview: sec.text.slice(0,130), review_reason: sec.review_reason,
        imported: existing.has(sec.number),
        match_status: match.status,
        topic_id: confident && match.status === "approved_exact" ? match.topic_id : null,
        candidate_ids: match.candidate_ids,
      };
    });
    return {
      total: rows.length,
      ready: rows.filter((s) => s.topic_id !== null).length,
      review: rows.filter((s) => s.topic_id === null).length,
      sections: rows,
    };
  });

/** One bounded batch per RPC. The client may repeat while remaining>0. */
export const applySourceTopicSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ job_id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { job, sections } = await getSourceSections(sb, data.job_id);
    const catalog = await getCurriculumCatalog(sb, job.subject_id);
    const matches = sections.filter((s) => s.confidence === "high").map((s) =>
      ({ section: s, match: matchCurriculumHeading(s.title, catalog) }))
      .filter((r) => r.match.status === "approved_exact" && !!r.match.topic_id);
    let created_materials = 0, linked = 0, existing = 0;
    const BATCH = 6;
    const pending: typeof matches = [];
    for (const entry of matches) {
      const key = job.file_sha256 + ":source-section:v1:" + entry.section.number;
      const prior = await sb.from("materials")
        .select("id,topic_id,extractor_metadata")
        .eq("extractor_metadata->>unit_key", key).maybeSingle();
      if (prior.error) throw new Error(prior.error.message);
      const linkedAlready = prior.data ? await sb.from("material_topic_links")
        .select("material_id").eq("material_id",prior.data.id)
        .eq("topic_id",entry.match.topic_id).maybeSingle() : { data: null, error: null };
      if (linkedAlready.error) throw new Error(linkedAlready.error.message);
      if (linkedAlready.data) existing++;
      else pending.push(entry);
    }
    for (const { section, match } of pending.slice(0,BATCH)) {
      const topicId = match.topic_id!;
      const key = job.file_sha256 + ":source-section:v1:" + section.number;
      let material = await sb.from("materials").select("id,topic_id,extractor_metadata")
        .eq("extractor_metadata->>unit_key", key).maybeSingle();
      if (material.error) throw new Error(material.error.message);
      if (!material.data) {
        const meta: Record<string, unknown> = {
          unit_key: key, unit_id: "section:" + section.number, job_id: job.id,
          source_sha256: job.file_sha256, source_file: job.file_name,
          derived_kind: "numbered_section", section_number: section.number,
          origin_material_id: section.origin_material_id,
          offset_start: section.offset_start, offset_end: section.offset_end,
          heading_evidence: section.evidence, quality_status: "auto_structured",
          review_status: "auto_structured_ocr_unverified",
          usable_for_grading: false, source_text_verified: false,
          topic_assignment: { topic_id: topicId, by: context.userId,
            mode: "approved_catalog_exact", at: new Date().toISOString() },
        };
        const added = await sb.from("materials").insert({
          subject_id: job.subject_id, topic_id: topicId,
          title: "§ " + section.number + ". " + section.title,
          content_text: section.text, material_type: "textbook_paragraph",
          source_name: job.author ?? job.file_name, status: "published", is_public: true,
          license_type: job.rights_basis,
          license_note: "Извлечено из " + job.file_name + "; OCR не проверен для оценивания",
          created_by: context.userId, extractor_metadata: meta as Json,
        }).select("id").single();
        if (added.error) throw new Error(added.error.message);
        material = { data: { id: added.data.id, topic_id: topicId, extractor_metadata: meta }, error: null };
        created_materials++;
      }
      const link = await sb.from("material_topic_links").upsert({
        material_id: material.data.id, topic_id: topicId,
        link_type: "explains", link_source: "exact_heading", linked_by: context.userId,
      }, { onConflict:"material_id,topic_id",ignoreDuplicates:true });
      if (link.error) throw new Error(link.error.message);
      linked++;
      // Existing source-derived primary topic may be a retired arbitrary heading.
      const primaryTopic = material.data.topic_id ? catalog.find((x) => x.id === material.data.topic_id) : null;
      if (primaryTopic?.review_status !== "approved") {
        const priorMeta = (material.data.extractor_metadata ?? {}) as Record<string, any>;
        const updated = await sb.from("materials").update({
          topic_id: topicId,
          extractor_metadata: { ...priorMeta, topic_assignment: {
            topic_id: topicId, by: context.userId,
            mode: "approved_catalog_exact", at: new Date().toISOString(),
          } } as Json,
        }).eq("id",material.data.id);
        if (updated.error) throw new Error(updated.error.message);
      }
    }
    return {
      created_materials, created_topics: 0, linked,
      already_imported: existing,
      remaining: Math.max(0,pending.length-BATCH),
      manual_review: sections.length-matches.length,
    };
  });
