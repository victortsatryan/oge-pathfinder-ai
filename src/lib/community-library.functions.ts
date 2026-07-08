import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CONTENT_KINDS = ["pdf", "docx", "image", "video", "link", "text"] as const;
const MATERIAL_TYPES = [
  "theory",
  "practice",
  "solution",
  "notes",
  "cheatsheet",
  "article",
  "video",
  "other",
] as const;
const LEVELS = ["basic", "intermediate", "advanced"] as const;
const CONTAINS = [
  "rule",
  "examples",
  "exercises",
  "test",
  "error_analysis",
  "table",
  "scheme",
  "video",
  "illustrations",
] as const;
const STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "approved",
  "published",
  "rejected",
] as const;

const submitSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(2000).optional().nullable(),
  content_kind: z.enum(CONTENT_KINDS),
  education_system: z.string().trim().max(120).optional().nullable(),
  grade: z.string().trim().max(40).optional().nullable(),
  subject_id: z.string().uuid().optional().nullable(),
  topic_id: z.string().uuid().optional().nullable(),
  subtopic_id: z.string().uuid().optional().nullable(),
  material_type: z.enum(MATERIAL_TYPES),
  file_url: z.string().trim().optional().nullable(),
  file_path: z.string().trim().optional().nullable(),
  link_url: z.string().trim().optional().nullable(),
  content_text: z.string().trim().max(20000).optional().nullable(),
  contains: z.array(z.enum(CONTAINS)).default([]),
  level: z.enum(LEVELS).optional().nullable(),
  usefulness: z.string().trim().max(2000).optional().nullable(),
  submit: z.boolean().default(false),
});

async function assertAdmin(sb: any, userId: string) {
  const { data, error } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listMyCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("content_candidates")
      .select("id, title, description, content_kind, material_type, status, subject_id, topic_id, file_url, link_url, created_at, updated_at, submitted_at, published_at, subjects(name), topics!content_candidates_topic_id_fkey(title)")
      .eq("author_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { candidates: data ?? [] };
  });

export const getCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("content_candidates")
      .select("*, subjects(name), topics!content_candidates_topic_id_fkey(title)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return { candidate: row };
  });

export const saveCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const nowIso = new Date().toISOString();
    const nextStatus = data.submit ? "submitted" : "draft";

    const payload = {
      author_id: context.userId,
      title: data.title,
      description: data.description ?? null,
      content_kind: data.content_kind,
      education_system: data.education_system ?? null,
      grade: data.grade ?? null,
      subject_id: data.subject_id ?? null,
      topic_id: data.topic_id ?? null,
      subtopic_id: data.subtopic_id ?? null,
      material_type: data.material_type,
      file_url: data.file_url ?? null,
      file_path: data.file_path ?? null,
      link_url: data.link_url ?? null,
      content_text: data.content_text ?? null,
      contains: data.contains,
      level: data.level ?? null,
      usefulness: data.usefulness ?? null,
      status: nextStatus,
      submitted_at: data.submit ? nowIso : null,
    };

    if (data.id) {
      const { data: existing, error: exErr } = await context.supabase
        .from("content_candidates")
        .select("author_id, status, submitted_at")
        .eq("id", data.id)
        .maybeSingle();
      if (exErr) throw new Error(exErr.message);
      if (!existing) throw new Error("Not found");
      if (existing.author_id !== context.userId) throw new Error("Forbidden");
      if (!["draft", "submitted"].includes(existing.status)) {
        throw new Error("Материал уже на модерации, редактирование недоступно");
      }
      payload.submitted_at = data.submit ? (existing.submitted_at ?? nowIso) : existing.submitted_at ?? null;
      const { error } = await context.supabase
        .from("content_candidates")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, status: nextStatus };
    }

    const { data: row, error } = await context.supabase
      .from("content_candidates")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, status: nextStatus };
  });

export const deleteMyCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("content_candidates")
      .delete()
      .eq("id", data.id)
      .eq("author_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSubjectsForLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("subjects")
      .select("id, name, slug")
      .eq("is_public", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return { subjects: data ?? [] };
  });

/* ---------- Admin ---------- */

export const adminListCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum([...STATUSES, "all"]).default("all") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("content_candidates")
      .select("id, title, content_kind, material_type, status, subject_id, topic_id, author_id, created_at, submitted_at, subjects(name), topics!content_candidates_topic_id_fkey(title)")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const authorIds = Array.from(new Set((rows ?? []).map((r: any) => r.author_id)));
    let profiles: Record<string, { display_name: string | null; email: string | null }> = {};
    if (authorIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", authorIds);
      profiles = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p]));
    }

    return {
      candidates: (rows ?? []).map((r: any) => ({
        ...r,
        author: profiles[r.author_id] ?? null,
      })),
      counts: await adminCountsInternal(context.supabase),
    };
  });

async function adminCountsInternal(sb: any) {
  const { data } = await sb.from("content_candidates").select("status");
  const counts: Record<string, number> = { all: 0, submitted: 0, in_review: 0, approved: 0, published: 0, rejected: 0, draft: 0 };
  for (const r of (data ?? []) as { status: string }[]) {
    counts.all++;
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }
  return counts;
}

export const adminGetCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("content_candidates")
      .select("*, subjects(name), topics!content_candidates_topic_id_fkey(title)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");

    let signedFileUrl: string | null = null;
    if (row.file_path) {
      const { data: signed } = await context.supabase.storage
        .from("community-library")
        .createSignedUrl(row.file_path, 60 * 60);
      signedFileUrl = signed?.signedUrl ?? null;
    }

    const { data: author } = await context.supabase
      .from("profiles")
      .select("display_name, email")
      .eq("user_id", row.author_id)
      .maybeSingle();

    return { candidate: row, author, signedFileUrl };
  });

const adminUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES).optional(),
  admin_notes: z.string().max(2000).optional().nullable(),
  learning_objective_id: z.string().uuid().optional().nullable(),
});

export const adminUpdateCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adminUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload: {
      status?: (typeof STATUSES)[number];
      reviewed_by?: string;
      reviewed_at?: string;
      published_at?: string;
      admin_notes?: string | null;
      learning_objective_id?: string | null;
    } = {};
    if (data.status !== undefined) {
      payload.status = data.status;
      payload.reviewed_by = context.userId;
      payload.reviewed_at = new Date().toISOString();
      if (data.status === "published") payload.published_at = new Date().toISOString();
    }
    if (data.admin_notes !== undefined) payload.admin_notes = data.admin_notes;
    if (data.learning_objective_id !== undefined) payload.learning_objective_id = data.learning_objective_id;

    const { error } = await context.supabase
      .from("content_candidates")
      .update(payload)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminCandidateCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return { counts: await adminCountsInternal(context.supabase) };
  });
