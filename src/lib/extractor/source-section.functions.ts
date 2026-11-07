import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
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
      .select("id,title,content_text,derived_kind:extractor_metadata->>derived_kind")
      .eq("extractor_metadata->>job_id", job.id)
      .order("created_at", { ascending: true })
      .range(offset, offset + 499);
    if (page.error) throw new Error(page.error.message);
    for (const m of page.data ?? []) {
      if (!m.derived_kind) units.push({ id: m.id, title: m.title, content_text: m.content_text });
    }
    if ((page.data ?? []).length < 500) break;
  }
  return { job, sections: parseSourceSections(units) };
}

export const previewSourceTopicSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ job_id: z.string().uuid() }).parse(v))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { sections } = await getSourceSections(context.supabase as any, data.job_id);
    const seen = await (context.supabase as any).from("materials")
      .select("id,extractor_metadata").eq("extractor_metadata->>job_id", data.job_id)
      .eq("extractor_metadata->>derived_kind", "numbered_section")
      .limit(500);
    if (seen.error) throw new Error(seen.error.message);
    const existing = new Set((seen.data ?? []).map((m: any) => Number(m.extractor_metadata?.section_number)));
    return {
      total: sections.length,
      ready: sections.filter((s) => s.confidence === "high").length,
      review: sections.filter((s) => s.confidence === "review").length,
      sections: sections.map((s) => ({
        number: s.number, title: s.title, confidence: s.confidence,
        review_reason: s.review_reason, characters: s.text.length,
        preview: s.text.slice(0, 130),
        imported: existing.has(s.number),
      })),
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
    const high = sections.filter((s) => s.confidence === "high");
    const topicsRes = await sb.from("topics").select("id,title").eq("subject_id", job.subject_id).limit(2000);
    if (topicsRes.error) throw new Error(topicsRes.error.message);
    const byTitle = new Map<string, string>((topicsRes.data ?? []).map((x: any) =>
      [x.title.normalize("NFKC").toLocaleLowerCase("ru").trim(), x.id]));
    let inserted = 0, existing = 0, topicsCreated = 0, linked = 0;
    const BATCH = 6;
    const pending: SectionCandidate[] = [];
    for (const s of high) {
      const unitKey = job.file_sha256 + ":source-section:v1:" + s.number;
      const already = await sb.from("materials").select("id")
        .eq("extractor_metadata->>unit_key", unitKey).maybeSingle();
      if (already.error) throw new Error(already.error.message);
      if (already.data) existing++;
      else pending.push(s);
    }
    for (const section of pending.slice(0, BATCH)) {
      const key = section.title.normalize("NFKC").toLocaleLowerCase("ru").trim();
      let topicId = byTitle.get(key);
      if (!topicId) {
        const t = await sb.from("topics").insert({
          subject_id: job.subject_id, title: section.title,
          topic_type: "topic", is_public: true, created_by: context.userId,
          source_standard: "textbook_numbered_heading",
          description: "Тема из § " + section.number + " источника «" + job.file_name + "». OCR не проверен для оценивания.",
        }).select("id").single();
        if (t.error) {
          if (t.error.code !== "23505") throw new Error(t.error.message);
          const duplicate = await sb.from("topics").select("id").eq("subject_id", job.subject_id).eq("title", section.title).single();
          if (duplicate.error) throw new Error(duplicate.error.message);
          topicId = duplicate.data.id;
        } else {
          topicId = t.data.id;
          topicsCreated++;
        }
        byTitle.set(key, topicId!);
      }
      const unitKey = job.file_sha256 + ":source-section:v1:" + section.number;
      const meta: Record<string, unknown> = {
        unit_key: unitKey, unit_id: "section:" + section.number, job_id: job.id,
        source_sha256: job.file_sha256, source_file: job.file_name, derived_kind: "numbered_section",
        section_number: section.number, origin_material_id: section.origin_material_id,
        offset_start: section.offset_start, offset_end: section.offset_end,
        heading_evidence: section.evidence, quality_status: "auto_structured",
        review_status: "auto_structured_ocr_unverified",
        usable_for_grading: false, source_text_verified: false,
        topic_assignment: { topic_id: topicId, by: context.userId, mode: "source_heading_auto", at: new Date().toISOString() },
      };
      const res = await sb.from("materials").insert({
        subject_id: job.subject_id, topic_id: topicId, title: "§ " + section.number + ". " + section.title,
        content_text: section.text, material_type: "textbook_paragraph",
        source_name: job.author ?? job.file_name, status: "published", is_public: true,
        license_type: job.rights_basis, license_note: "Автоматически выделено из " + job.file_name +
          " по заголовку параграфа. Содержимое OCR не проверено для оценивания.",
        created_by: context.userId, extractor_metadata: meta as Json,
      }).select("id").single();
      if (res.error) {
        if (res.error.code === "23505") {
          const prior = await sb.from("materials").select("id")
            .eq("extractor_metadata->>unit_key", unitKey).maybeSingle();
          if (!prior.error && prior.data) { existing++; continue; }
        }
        throw new Error(res.error.message);
      }
      inserted++;
      const link = await sb.from("material_topic_links").upsert({
        material_id: res.data.id, topic_id: topicId, link_type: "explains",
        link_source: "exact_heading", linked_by: context.userId,
      }, { onConflict: "material_id,topic_id", ignoreDuplicates: true });
      if (link.error) throw new Error(link.error.message);
      linked++;
    }
    return {
      created_materials: inserted, created_topics: topicsCreated, linked,
      already_imported: existing,
      remaining: Math.max(0, pending.length - BATCH),
      manual_review: sections.filter((s) => s.confidence === "review").length,
    };
  });
