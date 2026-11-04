import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  MAX_SOURCE_BYTES, canCreateTask, canPublishWithRights, classifyUnit, extractUnits,
  kindToMaterialType, parseWorkerStatus, shouldPublish, sourceExtension,
} from "./pipeline";

type Sb = SupabaseClient<Database>;
const BUCKET = "extractor-sources";

async function assertAdmin(sb: Sb, userId: string) {
  const { data, error } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Доступ только администратору");
}

function worker() {
  const url = process.env["PATHY_EXTRACTOR_API_URL"];
  const token = process.env["PATHY_EXTRACTOR_API_TOKEN"];
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

async function sha256Hex(buf: ArrayBuffer) {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
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

/** Send the stored file to the external worker. Never fakes processing. */
async function dispatch(sb: Sb, id: string) {
  const job = await loadJob(sb, id);
  const w = worker();
  if (!w) {
    await update(sb, id, { status: "worker_not_configured", progress: 0, error: "Обработчик не подключён: не заданы PATHY_EXTRACTOR_API_URL и PATHY_EXTRACTOR_API_TOKEN" });
    return;
  }
  const file = await sb.storage.from(BUCKET).download(job.storage_path);
  if (file.error) throw new Error("Файл не найден в хранилище: " + file.error.message);
  const form = new FormData();
  form.append("file", file.data, job.file_name);
  form.append("source_sha256", job.file_sha256);
  form.append("pathy_job_id", job.id);
  if (job.author) form.append("author", job.author);
  try {
    const res = await fetch(`${w.url}/v1/jobs`, { method: "POST", headers: { Authorization: `Bearer ${w.token}` }, body: form });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !body.job_id) throw new Error(`Обработчик ответил ${res.status}`);
    await update(sb, id, { status: "queued", progress: 0, error: null, external_job_id: String(body.job_id), attempts: job.attempts + 1 });
  } catch (e) {
    console.error("extractor dispatch failed", e);
    await update(sb, id, { status: "failed", error: e instanceof Error ? e.message : "Обработчик недоступен", attempts: job.attempts + 1 });
  }
}

export const getExtractorJobs = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [jobs, subjects] = await Promise.all([
      context.supabase.from("extractor_jobs").select("id,file_name,file_sha256,size_bytes,status,progress,error,author,rights_basis,subject_id,created_at,updated_at,publish_report").order("created_at", { ascending: false }).limit(50),
      context.supabase.from("subjects").select("id,name").order("name"),
    ]);
    if (jobs.error) throw new Error(jobs.error.message);
    return { jobs: jobs.data ?? [], subjects: subjects.data ?? [], workerConfigured: worker() !== null };
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
    if (!sourceExtension(data.file_name)) throw new Error("Неподдерживаемый тип файла");
    const prior = await sb.from("extractor_jobs").select("id,status").eq("file_sha256", data.file_sha256).maybeSingle();
    if (prior.error) throw new Error(prior.error.message);
    if (prior.data) return { id: prior.data.id, duplicate: true };
    // Verify the uploaded bytes server-side: the hash from the browser is not trusted.
    const file = await sb.storage.from(BUCKET).download(data.storage_path);
    if (file.error) throw new Error("Загруженный файл не найден: " + file.error.message);
    const buf = await file.data.arrayBuffer();
    if (buf.byteLength > MAX_SOURCE_BYTES) throw new Error("Файл больше 50 MB");
    const sha = await sha256Hex(buf);
    if (sha !== data.file_sha256) throw new Error("SHA-256 файла не совпадает с загруженным");
    const ins = await sb.from("extractor_jobs").insert({
      file_sha256: sha, file_name: data.file_name, mime_type: data.mime_type, size_bytes: buf.byteLength,
      storage_path: data.storage_path, subject_id: data.subject_id, author: data.author || null, created_by: context.userId,
    }).select("id").single();
    if (ins.error) {
      if (ins.error.code === "23505") {
        const again = await sb.from("extractor_jobs").select("id").eq("file_sha256", sha).single();
        return { id: again.data!.id, duplicate: true };
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

export const refreshExtractorJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    const job = await loadJob(sb, data.id);
    const w = worker();
    if (w && job.external_job_id && (job.status === "queued" || job.status === "processing")) {
      try {
        const res = await fetch(`${w.url}/v1/jobs/${encodeURIComponent(job.external_job_id)}`, { headers: { Authorization: `Bearer ${w.token}` } });
        if (!res.ok) throw new Error(`Обработчик ответил ${res.status}`);
        const st = parseWorkerStatus(await res.json());
        if (st.status === "succeeded" && extractUnits(st.result).length === 0) {
          await update(sb, job.id, { status: "failed", error: "Обработчик вернул результат без units", result: st.result as Json });
        } else {
          await update(sb, job.id, { status: st.status, progress: st.progress, error: st.error, ...(st.status === "succeeded" ? { result: st.result as Json } : {}) });
        }
      } catch (e) {
        console.error("extractor poll failed", e);
        await update(sb, job.id, { error: "Не удалось получить статус: " + (e instanceof Error ? e.message : "") });
      }
    }
    const fresh = await loadJob(sb, data.id);
    const decisions = (fresh.unit_decisions ?? {}) as Record<string, "accept" | "reject">;
    const units = extractUnits(fresh.result).map((u) => {
      const c = classifyUnit(u as Record<string, any>, fresh.author);
      return { ...c, answer: (c.answer ?? null) as Json, content_text: c.content_text.slice(0, 1500), admin: decisions[c.unit_id] ?? null, publish: shouldPublish(c, decisions[c.unit_id]), task: canCreateTask(c) };
    });
    const { result: _r, ...meta } = fresh;
    return { job: meta, units, workerConfigured: w !== null };
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

/** Idempotent: re-running skips units already imported from this job. Never updates existing rows. */
export const publishExtractorJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    id: z.string().uuid(), subject_id: z.string().uuid(),
    rights_basis: z.enum(["unknown", "own", "licensed", "public_domain"]), confirmed: z.literal(true),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    if (!canPublishWithRights(data.rights_basis)) throw new Error("Права на использование не подтверждены — публикация заблокирована");
    const job = await loadJob(sb, data.id);
    if (job.status !== "succeeded" && job.status !== "published") throw new Error("Результат обработки ещё не получен");
    await update(sb, job.id, { rights_basis: data.rights_basis, subject_id: data.subject_id });
    const decisions = (job.unit_decisions ?? {}) as Record<string, "accept" | "reject">;
    const report = { materials: 0, tasks: 0, existing: 0, skipped: 0, failed: [] as string[] };
    for (const raw of extractUnits(job.result)) {
      const u = classifyUnit(raw as Record<string, any>, job.author);
      if (!shouldPublish(u, decisions[u.unit_id])) { report.skipped++; continue; }
      const prior = await sb.from("materials").select("id").eq("extractor_metadata->>job_id", job.id).eq("extractor_metadata->>unit_id", u.unit_id).maybeSingle();
      if (prior.error) { report.failed.push(`${u.unit_id}: ${prior.error.message}`); continue; }
      if (prior.data) { report.existing++; continue; }
      const provenance = { job_id: job.id, unit_id: u.unit_id, source_sha256: job.file_sha256, source_file: job.file_name, pages: u.pages, confidence: u.confidence, classification: u.decision, admin_decision: decisions[u.unit_id] ?? null, original_unit: raw as Json };
      // Visible only to signed-in Pathy users: materials SELECT policy is TO authenticated, anon has no grant.
      const mat = await sb.from("materials").insert({
        subject_id: data.subject_id, topic_id: u.topic_id, title: u.title.slice(0, 500), content_text: u.content_text,
        material_type: kindToMaterialType(u.kind), source_name: u.author, status: "published", is_public: true,
        license_type: data.rights_basis, license_note: `Источник: ${job.file_name}; стр. ${u.pages.join(", ") || "—"}${u.author ? "; автор: " + u.author : ""}`,
        created_by: context.userId, extractor_metadata: provenance,
      });
      if (mat.error) { report.failed.push(`${u.unit_id}: ${mat.error.message}`); continue; }
      report.materials++;
      if (canCreateTask(u)) {
        const key = `extractor:${job.file_sha256.slice(0, 12)}:${u.unit_id}`.slice(0, 200);
        const topic = await sb.from("topics").select("id").eq("id", u.topic_id!).maybeSingle();
        const exists = await sb.from("tasks").select("id").eq("task_key", key).maybeSingle();
        if (!topic.data || exists.data) continue;
        const t = await sb.from("tasks").insert({
          subject_id: data.subject_id, topic_id: u.topic_id, task_key: key, title: u.title.slice(0, 500), prompt: u.content_text,
          answer_type: "text", correct_answer: u.answer as Json, explanation: u.explanation, source_name: u.author ?? job.file_name, is_published: true,
        });
        if (t.error) report.failed.push(`${u.unit_id} (задание): ${t.error.message}`); else report.tasks++;
      }
    }
    await update(sb, job.id, { status: "published", publish_report: report as unknown as Json });
    return report;
  });
