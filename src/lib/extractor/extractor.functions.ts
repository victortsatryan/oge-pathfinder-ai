import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { batchSchema, importBatchSchema, inspectFile, payloadSha, sourceSha, unitSchema, type UnitReport } from "./schema";

async function assertAdmin(sb: SupabaseClient<Database>, userId: string) {
  const { data, error } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Доступ только администратору");
}

async function processBatch(sb: SupabaseClient<Database>, input: z.infer<typeof batchSchema>, userId: string, write: boolean) {
  const checked = inspectFile(input);
  const reports: UnitReport[] = [];
  for (const report of checked.reports) {
    if (report.status === "failed") { reports.push(report); continue; }
    const parsed = unitSchema.safeParse(checked.units[report.index]);
    if (!parsed.success) { reports.push({ ...report, status: "failed", reasons: ["Неверный unit"] }); continue; }
    const unit = parsed.data;
    try {
      // Hash the ORIGINAL object: staging must retain even unknown Extractor fields unchanged.
      const original = checked.units[report.index];
      const hash = await payloadSha(original);
      const find = () => sb.from("extractor_staging_units").select("unit_id,payload_sha256,source_sha256,source_pages").eq("unit_id", unit.unit_id).maybeSingle();
      let existing = await find();
      if (existing.error) throw existing.error;
      if (!existing.data && write) {
        const insert = await sb.from("extractor_staging_units").insert({
          unit_id: unit.unit_id, source_sha256: sourceSha(unit), source_pages: unit.pages,
          kind: unit.kind, title: unit.title, content_text: unit.content_text,
          payload: original as Json, payload_sha256: hash, imported_by: userId,
          status: "draft", is_public: false,
        });
        if (insert.error?.code === "23505") { existing = await find(); if (existing.error) throw existing.error; }
        else if (insert.error) throw insert.error;
        else { reports.push(report); continue; }
      }
      reports.push(existing.data
        ? existing.data.payload_sha256 === hash
          ? { ...report, status: "existing" }
          : { ...report, status: "failed", reasons: ["Конфликт unit_id: исходный текст, SHA, страницы или метаданные отличаются; сохранённый черновик не изменён"] }
        : report);
    } catch (error) {
      reports.push({ ...report, status: "failed", reasons: [error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "Ошибка сохранения"] });
    }
  }
  return { reports };
}
export const previewExtractorBatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => batchSchema.parse(v)).handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return processBatch(context.supabase, data, context.userId, false);
  });
export const importExtractorBatch = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => importBatchSchema.parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return processBatch(context.supabase, data, context.userId, true);
  });

export const getExtractorOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ page: z.number().int().min(0).default(0) }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = context.supabase;
    const [drafts, decisions, sources, textLayer, ocr, custom, unresolved] = await Promise.all([
      sb.from("extractor_staging_units").select("unit_id,title,kind,source_sha256,source_pages,status,is_public,imported_at", { count: "exact" }).order("imported_at", { ascending: false }).order("unit_id").range(data.page * 50, data.page * 50 + 49),
      sb.from("extractor_review_decisions").select("*", { count: "exact" }).order("source_sha256").order("decision_id").range(data.page * 50, data.page * 50 + 49),
      sb.from("content_sources").select("*").order("title"),
      ...(["text_layer", "ocr", "custom", "unresolved"] as const).map((choice) => sb.from("extractor_review_decisions").select("*", { count: "exact", head: true }).eq("choice", choice)),
    ]);
    for (const result of [drafts, decisions, sources, textLayer, ocr, custom, unresolved]) if (result.error) throw result.error;
    return { drafts: drafts.data ?? [], draftCount: drafts.count ?? 0, decisions: decisions.data ?? [], decisionCount: decisions.count ?? 0, sources: sources.data ?? [], choices: { text_layer: textLayer.count ?? 0, ocr: ocr.count ?? 0, custom: custom.count ?? 0, unresolved: unresolved.count ?? 0 } };
  });

export const inspectExtractorDraft = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ unit_id: z.string().min(1).max(500) }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const draft = await context.supabase.from("extractor_staging_units").select("*").eq("unit_id", data.unit_id).single();
    if (draft.error) throw draft.error;
    // These tables lack complete admin SELECT policies. Privileged reads only AFTER role validation.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = draft.data.payload as Record<string, Json>;
    const ids = (value: Json | undefined) => typeof value === "string" && z.string().uuid().safeParse(value).success ? value : null;
    const topicId = ids(payload.topic_id), taskId = ids(payload.task_id);
    const topic = topicId ? await supabaseAdmin.from("topics").select("id,title").eq("id", topicId).maybeSingle() : null;
    const task = taskId ? await supabaseAdmin.from("tasks").select("id,title,task_key,topic_id,is_published").eq("id", taskId).maybeSingle() : null;
    const assignments = taskId ? await supabaseAdmin.from("teacher_assignments").select("id,title,status,task_id").eq("task_id", taskId) : null;
    for (const result of [topic, task, assignments]) if (result?.error) throw result.error;
    return { draft: draft.data, links: { topic: topic?.data ?? null, task: task?.data ?? null, assignments: assignments?.data ?? [], note: "Только явно указанные topic_id / task_id; совпадение названия не считается связью. Черновик не назначается ученикам." } };
  });