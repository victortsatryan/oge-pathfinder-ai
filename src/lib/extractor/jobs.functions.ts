import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  MAX_SOURCE_BYTES, PUBLISH_BATCH, RESULT_PAGE_LIMIT, canPublishWithRights, classifyUnit, effectivePublication,
  kindToMaterialType, magicMatches, parseResultPage, parseWorkerStatus, sourceExtension, stableUnitKey,
} from "./pipeline";
import { needsContentReview, topicBelongsToSubject } from "./topic-linking";

type Sb = SupabaseClient<Database>;
const BUCKET = "extractor-sources";
const TIMEOUT_MS = 20_000;
const PAGES_PER_CALL = 8; // result pages fetched per refresh call, keeps each invocation short

async function assertAdmin(sb: Sb, userId: string) {
  const { data, error } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Доступ только администратору");
}

/** Server-only worker config. Requires an external https URL and a token. */
function worker(): { url: string; token: string } | { error: string } | null {
  const url = process.env["PATHY_EXTRACTOR_API_URL"];
  const token = process.env["PATHY_EXTRACTOR_API_TOKEN"];
  if (!url || !token) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(u.hostname)) return { error: "PATHY_EXTRACTOR_API_URL должен быть внешним https-адресом" };
  } catch { return { error: "PATHY_EXTRACTOR_API_URL некорректен" }; }
  return { url: url.replace(/\/+$/, ""), token };
}

async function call(w: { url: string; token: string }, path: string, init?: RequestInit) {
  const res = await fetch(`${w.url}${path}`, {
    ...init, signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Authorization: `Bearer ${w.token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Обработчик ответил ${res.status}`);
  return body as Record<string, any>;
}

async function loadJob(sb: Sb, id: string) {
  const r = await sb.from("extractor_jobs").select("*").eq("id", id).single();
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

async function update(sb: Sb, id: string, patch: Database["public"]["Tables"]["extractor_jobs"]["Update"]) {
  const r = await sb.from("extractor_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (r.error) throw new Error(r.error.message);
}

/** POST /v1/jobs with a signed URL; the worker downloads the file itself and validates the SHA. */
async function dispatch(sb: Sb, id: string) {
  const job = await loadJob(sb, id);
  const w = worker();
  if (!w) return update(sb, id, { status: "worker_not_configured", progress: 0, error: "Обработчик не подключён: не заданы PATHY_EXTRACTOR_API_URL и PATHY_EXTRACTOR_API_TOKEN" });
  if ("error" in w) return update(sb, id, { status: "worker_not_configured", error: w.error });
  const signed = await sb.storage.from(BUCKET).createSignedUrl(job.storage_path, 3600);
  if (signed.error || !signed.data?.signedUrl) return update(sb, id, { status: "failed", error: "Не удалось создать ссылку на файл: " + (signed.error?.message ?? "") });
  try {
    const body = await call(w, "/v1/jobs", { method: "POST", body: JSON.stringify({ job_id: job.id, source_url: signed.data.signedUrl, source_sha256: job.file_sha256, filename: job.file_name }) });
    if (body?.job_id !== job.id) throw new Error("Обработчик вернул другой job_id");
    await update(sb, id, { status: "queued", stage: String(body.stage ?? "queued"), progress: 0, error: null, external_job_id: job.id, attempts: job.attempts + 1, result_next_offset: null, result_total_units: null });
  } catch (e) {
    console.error("extractor dispatch failed", e);
    await update(sb, id, { status: "failed", error: e instanceof Error ? e.message : "Обработчик недоступен", attempts: job.attempts + 1 });
  }
}

export const getExtractorJobs = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [jobs, subjects, topics] = await Promise.all([
      context.supabase.from("extractor_jobs").select("id,file_name,file_sha256,size_bytes,status,stage,progress,error,author,rights_basis,subject_id,created_at,updated_at,publish_report,result_total_units").order("created_at", { ascending: false }).limit(50),
      context.supabase.from("subjects").select("id,name").order("name"),
      context.supabase.from("topics").select("id,title,subject_id").order("sort_order").limit(2000),
    ]);
    if (jobs.error) throw new Error(jobs.error.message);
    const w = worker();
    return { jobs: jobs.data ?? [], subjects: subjects.data ?? [], topics: topics.data ?? [], workerConfigured: !!w && !("error" in w) };
  });

export const registerExtractorUpload = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    storage_path: z.string().min(1).max(500), file_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    file_name: z.string().min(1).max(300), mime_type: z.string().max(200).nullable(),
    subject_id: z.string().uuid().nullable(), author: z.string().trim().max(300).nullable(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    const ext = sourceExtension(data.file_name);
    if (!ext) throw new Error("Неподдерживаемый тип файла");
    if (!data.storage_path.startsWith(`${data.file_sha256}/`)) throw new Error("Путь файла не соответствует SHA-256");
    const prior = await sb.from("extractor_jobs").select("id").eq("file_sha256", data.file_sha256).maybeSingle();
    if (prior.error) throw new Error(prior.error.message);
    if (prior.data) return { id: prior.data.id, duplicate: true };
    // No full download: check size and magic bytes only. The SHA is verified by the worker against source_sha256.
    const info = await sb.storage.from(BUCKET).info(data.storage_path);
    if (info.error || !info.data) throw new Error("Загруженный файл не найден: " + (info.error?.message ?? ""));
    const size = Number(info.data.size ?? 0);
    if (!size || size > MAX_SOURCE_BYTES) throw new Error("Файл пустой или больше 160 MB");
    const signed = await sb.storage.from(BUCKET).createSignedUrl(data.storage_path, 120);
    if (signed.error) throw new Error(signed.error.message);
    const head = await fetch(signed.data.signedUrl, { headers: { Range: "bytes=0-511" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const bytes = new Uint8Array(await head.arrayBuffer()).slice(0, 512);
    if (!magicMatches(ext, bytes)) throw new Error("Содержимое файла не соответствует расширению ." + ext);
    const ins = await sb.from("extractor_jobs").insert({
      file_sha256: data.file_sha256, file_name: data.file_name, mime_type: data.mime_type, size_bytes: size,
      storage_path: data.storage_path, subject_id: data.subject_id, author: data.author || null, created_by: context.userId,
    }).select("id").single();
    if (ins.error) {
      if (ins.error.code === "23505") {
        const again = await sb.from("extractor_jobs").select("id").eq("file_sha256", data.file_sha256).single();
        if (again.error || !again.data) throw new Error("Не удалось найти повторную загрузку");
        return { id: again.data.id, duplicate: true };
      }
      throw new Error(ins.error.message);
    }
    await dispatch(sb, ins.data.id);
    return { id: ins.data.id, duplicate: false };
  });

export const retryExtractorJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const job = await loadJob(context.supabase, data.id);
    if (!["failed", "worker_not_configured", "uploaded"].includes(job.status)) throw new Error("Повтор возможен только после ошибки");
    await dispatch(context.supabase, data.id);
    return { ok: true };
  });

/** Pull a bounded number of result pages and persist them; resumes from result_next_offset. */
async function pullResult(sb: Sb, w: { url: string; token: string }, job: Awaited<ReturnType<typeof loadJob>>) {
  let offset = job.result_next_offset ?? 0;
  let total = job.result_total_units;
  for (let i = 0; i < PAGES_PER_CALL; i++) {
    const page = parseResultPage(await call(w, `/v1/jobs/${encodeURIComponent(job.id)}/result?offset=${offset}&limit=${RESULT_PAGE_LIMIT}`), { sha: job.file_sha256, offset, total });
    if (page.source_sha256 !== job.file_sha256) throw new Error("SHA-256 источника в результате не совпадает с загруженным файлом");
    total = page.total_units ?? total;
    if (page.units.length) {
      const rows = page.units.map((u, k) => ({ job_id: job.id, unit_id: String(u.unit_id), position: offset + k, raw: u as Json }));
      const ins = await sb.from("extractor_job_units").upsert(rows, { onConflict: "job_id,unit_id", ignoreDuplicates: true });
      if (ins.error) throw new Error(ins.error.message);
    }
    if (page.next_offset === null) {
      const { count, error } = await sb.from("extractor_job_units").select("id", { count: "exact", head: true }).eq("job_id", job.id);
      if (error) throw new Error(error.message);
      if (total === null || count !== total) {
        return update(sb, job.id, { status: "failed", error: `Получено блоков ${count}, ожидалось ${total ?? "?"}`, result_next_offset: null });
      }
      if (total === 0) return update(sb, job.id, { status: "failed", error: "Обработчик вернул 0 блоков" });
      return update(sb, job.id, { status: "succeeded", progress: 100, error: null, result_next_offset: null, result_total_units: total, result_summary: page.summary as Json });
    }
    if (page.next_offset <= offset) throw new Error("next_offset не продвигается");
    offset = page.next_offset;
  }
  const pct = total ? Math.min(99, Math.round((offset / total) * 100)) : 0;
  await update(sb, job.id, { status: "fetching_result", progress: pct, result_next_offset: offset, result_total_units: total });
}

export const refreshExtractorJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    const job = await loadJob(sb, data.id);
    const w = worker();
    const ok = w && !("error" in w) ? w : null;
    if (ok && job.external_job_id) {
      try {
        if (job.status === "queued" || job.status === "processing") {
          const st = parseWorkerStatus(await call(ok, `/v1/jobs/${encodeURIComponent(job.id)}`));
          if (st.status === "succeeded") {
            await update(sb, job.id, { status: "fetching_result", stage: st.stage, progress: 0, result_next_offset: 0 });
            await pullResult(sb, ok, await loadJob(sb, job.id));
          } else {
            await update(sb, job.id, { status: st.status, stage: st.stage, error: st.error });
          }
        } else if (job.status === "fetching_result") {
          await pullResult(sb, ok, job);
        }
      } catch (e) {
        console.error("extractor poll failed", e);
        await update(sb, job.id, { error: "Не удалось получить данные обработчика: " + (e instanceof Error ? e.message : "") });
      }
    }
    const fresh = await loadJob(sb, data.id);
    const decisions = (fresh.unit_decisions ?? {}) as Record<string, "accept" | "reject">;
    const rows = await sb.from("extractor_job_units").select("unit_id,raw,publish_state,reviewed_text,review_choice,reviewed_at").eq("job_id", fresh.id).order("position").limit(5000);
    if (rows.error) throw new Error(rows.error.message);
    const units = (rows.data ?? []).map((r) => {
      const c = classifyUnit(r.raw as Record<string, any>, fresh.author);
      return { unit_id: c.unit_id, title: c.title, kind: c.kind, pages: c.pages, role: c.role, decision: c.decision, reasons: c.reasons,
        // Full OCR text for units needing review (no truncation); confident units are not edited.
        content_text: c.decision === "confident" ? "" : c.content_text,
        reviewed_text: r.reviewed_text, review_choice: r.review_choice, reviewed_at: r.reviewed_at,
        admin: decisions[c.unit_id] ?? null,
        publish: effectivePublication(c, r.review_choice as any, r.reviewed_text, decisions[c.unit_id]).publish, state: r.publish_state };
    });
    const { result: _r, ...meta } = fresh;
    return { job: meta, units, workerConfigured: ok !== null };
  });

export const setExtractorUnitDecision = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid(), unit_id: z.string().min(1).max(500), decision: z.enum(["accept", "reject"]).nullable() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const job = await loadJob(context.supabase, data.id);
    const d = { ...((job.unit_decisions ?? {}) as Record<string, string>) };
    if (data.decision) d[data.unit_id] = data.decision; else delete d[data.unit_id];
    await update(context.supabase, data.id, { unit_decisions: d });
    return { ok: true };
  });

/** Persist a human review for one unit of this job. Raw OCR (raw) is never modified. */
export const saveExtractorUnitReview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    id: z.string().uuid(), unit_id: z.string().min(1).max(500),
    choice: z.enum(["accept_corrected", "keep_original", "reject"]).nullable(), reviewed_text: z.string().max(200_000).nullable(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    const job = await loadJob(sb, data.id);
    const row = await sb.from("extractor_job_units").select("id,raw,publish_state").eq("job_id", job.id).eq("unit_id", data.unit_id).maybeSingle();
    if (row.error) throw new Error(row.error.message);
    if (!row.data) throw new Error("Блок не найден в этой обработке");
    const raw = row.data.raw as Record<string, any>;
    if (raw?.source?.sha256 && raw.source.sha256 !== job.file_sha256) throw new Error("SHA блока не совпадает с источником обработки");
    const c = classifyUnit(raw, job.author);
    if (c.decision === "private") throw new Error("Материал только для учителя — публикация невозможна");
    if (row.data.publish_state === "published") throw new Error("Блок уже опубликован; опубликованные материалы не изменяются");
    const text = data.reviewed_text?.trim() ? data.reviewed_text : null;
    if (data.choice === "accept_corrected" && !text) throw new Error("Пустой исправленный текст");
    const up = await sb.from("extractor_job_units").update({
      reviewed_text: text, review_choice: data.choice, reviewed_by: context.userId, reviewed_at: new Date().toISOString(),
      ...(row.data.publish_state === "skipped" ? { publish_state: "pending" } : {}),
    }).eq("id", row.data.id);
    if (up.error) throw new Error(up.error.message);
    return { ok: true };
  });

/** Short-lived (5 min) signed link to the private source, admin only, never stored. */
export const getExtractorSourceLink = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid(), page: z.number().int().positive().nullable() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const job = await loadJob(context.supabase, data.id);
    const s = await context.supabase.storage.from(BUCKET).createSignedUrl(job.storage_path, 300);
    if (s.error || !s.data?.signedUrl) throw new Error("Не удалось открыть оригинал: " + (s.error?.message ?? ""));
    const isPdf = /\.pdf$/i.test(job.file_name);
    return { url: s.data.signedUrl + (isPdf && data.page ? `#page=${data.page}` : "") };
  });

/** One batch per call; the client repeats until remaining = 0. Idempotent, never updates existing materials/tasks. */
export const publishExtractorJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    id: z.string().uuid(), subject_id: z.string().uuid(), topic_id: z.string().uuid().nullable().optional(),
    rights_basis: z.enum(["unknown", "own", "licensed", "public_domain"]), confirmed: z.literal(true),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    if (!canPublishWithRights(data.rights_basis)) throw new Error("Права на использование не подтверждены — публикация заблокирована");
    // Explicit admin choice only; applies to this batch call. Must belong to the chosen subject.
    const topicId = data.topic_id ?? null;
    if (topicId) {
      const t = await sb.from("topics").select("id,subject_id").eq("id", topicId).maybeSingle();
      if (t.error) throw new Error(t.error.message);
      if (!t.data || t.data.subject_id !== data.subject_id) throw new Error("Выбранная тема не найдена или не относится к предмету — публикация остановлена");
    }
    const job = await loadJob(sb, data.id);
    if (!["succeeded", "publishing", "published"].includes(job.status)) throw new Error("Результат обработки ещё не получен полностью");
    await update(sb, job.id, { status: "publishing", rights_basis: data.rights_basis, subject_id: data.subject_id });
    const decisions = (job.unit_decisions ?? {}) as Record<string, "accept" | "reject">;
    const batch = await sb.from("extractor_job_units").select("id,unit_id,raw,reviewed_text,review_choice,reviewed_by,reviewed_at").eq("job_id", job.id).eq("publish_state", "pending").order("position").limit(PUBLISH_BATCH);
    if (batch.error) throw new Error(batch.error.message);
    const r = { materials: 0, existing: 0, skipped: 0, failed: 0 };
    for (const row of batch.data ?? []) {
      const raw = row.raw as Record<string, any>;
      if (raw?.source?.sha256 !== job.file_sha256) throw new Error("SHA блока не совпадает с источником обработки");
      const u = classifyUnit(raw, job.author);
      const mark = (publish_state: "published" | "existing" | "skipped" | "failed", extra: { material_id?: string; publish_error?: string } = {}) =>
        sb.from("extractor_job_units").update({ publish_state, ...extra }).eq("id", row.id);
      const eff = effectivePublication(u, row.review_choice as any, row.reviewed_text, decisions[u.unit_id]);
      if (!eff.publish) { await mark("skipped"); r.skipped++; continue; }
      const key = stableUnitKey(job.file_sha256, u.unit_id);
      const prior = await sb.from("materials").select("id").eq("extractor_metadata->>unit_key", key).maybeSingle();
      if (prior.error) throw new Error(prior.error.message);
      if (prior.data) { await mark("existing", { material_id: prior.data.id }); r.existing++; continue; }
      const provenance = {
        unit_key: key, job_id: job.id, unit_id: u.unit_id, source_sha256: job.file_sha256, source_file: job.file_name, pages: u.pages,
        role: u.role, related_unit_ids: u.related_unit_ids, classification: u.decision, review_reasons: u.reasons,
        admin_decision: decisions[u.unit_id] ?? null, usable_for_grading: false,
        topic_assignment: topicId ? { topic_id: topicId, by: context.userId, mode: "explicit_admin_batch" } : null, review_status: eff.review_status,
        original_ocr_text: u.content_text, original_unit: raw as Json,
        human_correction: row.review_choice ? { choice: row.review_choice, text: row.review_choice === "accept_corrected" ? row.reviewed_text : null, by: row.reviewed_by, at: row.reviewed_at } : null,
      };
      // Visible only to signed-in users (materials SELECT is TO authenticated). Learning only, not grading.
      const mat = await sb.from("materials").insert({
        subject_id: data.subject_id, topic_id: topicId, title: (u.title || u.unit_id).slice(0, 500), content_text: eff.text,
        material_type: kindToMaterialType(u.kind, u.material_type), source_name: u.author, status: "published", is_public: true,
        license_type: data.rights_basis, license_note: `Источник: ${job.file_name}; стр. ${u.pages.join(", ") || "—"}${u.author ? "; автор: " + u.author : ""}; ${eff.review_status === "human_corrected" ? "исправлено вручную" : "автоизвлечено"}, не проверено для оценивания`,
        created_by: context.userId, extractor_metadata: provenance,
      }).select("id").single();
      if (mat.error) {
        if (mat.error.code === "23505") {
          const existing = await sb.from("materials").select("id").eq("extractor_metadata->>unit_key", key).maybeSingle();
          if (!existing.error && existing.data) { await mark("existing", { material_id: existing.data.id }); r.existing++; continue; }
        }
        await mark("failed", { publish_error: mat.error.message }); r.failed++; continue;
      }
      await mark("published", { material_id: mat.data.id }); r.materials++;
      // No tasks: v0.6 units carry usable_for_grading:false and answer:null (see canCreateTask).
    }
    const { count, error: countError } = await sb.from("extractor_job_units").select("id", { count: "exact", head: true }).eq("job_id", job.id).eq("publish_state", "pending");
    if (countError || count === null) throw new Error("Не удалось подтвердить завершение публикации");
    const remaining = count ?? 0;
    const prev = (job.publish_report ?? { materials: 0, existing: 0, skipped: 0, failed: 0 }) as typeof r;
    const report = { materials: (prev.materials ?? 0) + r.materials, existing: (prev.existing ?? 0) + r.existing, skipped: (prev.skipped ?? 0) + r.skipped, failed: (prev.failed ?? 0) + r.failed };
    await update(sb, job.id, { status: remaining ? "publishing" : "published", publish_report: report as unknown as Json });
    return { ...r, remaining, total: report };
  });

/** Re-queue skipped units (e.g. after accepting more doubtful blocks). Published ones stay published. */
export const reopenSkippedUnits = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const r = await context.supabase.from("extractor_job_units").update({ publish_state: "pending" }).eq("job_id", data.id).in("publish_state", ["skipped", "failed"]);
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

/**
 * Admin-only list of already published extractor material blocks.
 * This is a separate workflow from publication: one textbook can cover many topics.
 */
export const getPublishedExtractorMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ job_id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    const job = await loadJob(sb, data.job_id);
    const res = await sb.from("materials")
      .select("id,title,material_type,topic_id,subject_id,content_text")
      .eq("extractor_metadata->>job_id", job.id)
      .eq("status", "published").eq("is_public", true)
      .order("created_at", { ascending: true }).limit(500);
    if (res.error) throw new Error(res.error.message);
    return {
      job_id: job.id,
      subject_id: job.subject_id,
      materials: (res.data ?? []).map((m) => ({
        id: m.id, title: m.title, material_type: m.material_type,
        topic_id: m.topic_id, characters: (m.content_text ?? "").trim().length,
        preview: (m.content_text ?? "").trim().slice(0, 150),
        needs_content_review: needsContentReview(m.title, m.content_text),
      })),
    };
  });

/**
 * Bulk map explicit, selected published units to one existing topic.
 * Never guess a topic from book/filename and never modify the OCR, grade keys,
 * existing lessons, or user paths. A remap of a material used in a lesson is denied.
 */
export const setPublishedExtractorMaterialsTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    job_id: z.string().uuid(),
    material_ids: z.array(z.string().uuid()).min(1).max(25)
      .refine((ids) => new Set(ids).size === ids.length, "Повторяющиеся ID материалов"),
    topic_id: z.string().uuid().nullable(),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    const job = await loadJob(sb, data.job_id);
    if (job.status !== "published" || !job.subject_id) {
      throw new Error("Назначение тем доступно только после публикации с выбранным предметом");
    }
    if (data.topic_id) {
      const t = await sb.from("topics").select("id,subject_id").eq("id", data.topic_id).maybeSingle();
      if (t.error) throw new Error(t.error.message);
      if (!t.data || !topicBelongsToSubject(job.subject_id, t.data.subject_id)) {
        throw new Error("Тема не найдена или принадлежит другому предмету");
      }
    }
    const selected = await sb.from("materials")
      .select("id,subject_id,topic_id,extractor_metadata,status,is_public")
      .in("id", data.material_ids)
      .eq("extractor_metadata->>job_id", job.id);
    if (selected.error) throw new Error(selected.error.message);
    if ((selected.data ?? []).length !== data.material_ids.length) {
      throw new Error("Не все выбранные материалы принадлежат этой обработке");
    }
    const rows = selected.data ?? [];
    for (const m of rows) {
      const meta = m.extractor_metadata as Record<string, any> | null;
      if (m.subject_id !== job.subject_id || m.status !== "published" || !m.is_public ||
          meta?.source_sha256 !== job.file_sha256) {
        throw new Error("Материал не прошёл проверку происхождения, предмета или статуса");
      }
    }
    const changed = rows.filter((m) => m.topic_id !== data.topic_id);
    if (!changed.length) return { updated: 0, unchanged: rows.length };
    // Avoid leaving stale links when an existing lesson already uses the material.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const linked = await supabaseAdmin.from("lesson_materials")
      .select("material_id").in("material_id", changed.map((m) => m.id)).limit(1);
    if (linked.error) throw new Error(linked.error.message);
    if ((linked.data ?? []).length) {
      throw new Error("Один из материалов уже включён в урок. Сначала нужно проверить его существующую привязку.");
    }
    const at = new Date().toISOString();
    for (const m of changed) {
      const meta = m.extractor_metadata as Record<string, any>;
      const record = { topic_id: data.topic_id, by: context.userId, at, mode: "explicit_admin_material" };
      const history = Array.isArray(meta.topic_assignment_history) ? meta.topic_assignment_history : [];
      const next = {
        ...meta, topic_assignment: data.topic_id ? record : null,
        topic_assignment_history: [...history, record],
      };
      const updated = await sb.from("materials")
        .update({ topic_id: data.topic_id, extractor_metadata: next as Json })
        .eq("id", m.id).eq("subject_id", job.subject_id)
        .select("id").single();
      if (updated.error) throw new Error(updated.error.message);
    }
    return { updated: changed.length, unchanged: rows.length - changed.length };
  });
