import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MATERIAL_TYPES = [
  "theory",
  "textbook_paragraph",
  "video",
  "article",
  "scheme",
  "infographic",
  "exercise_set",
  "task",
  "test",
  "task_solution",
  "reference",
  "scientific_material",
] as const;

const STATUSES = ["draft", "reviewed", "published", "archived"] as const;

const rowSchema = z.object({
  subject_title: z.string().trim().min(1),
  grade: z.string().trim().optional().default(""),
  program_title: z.string().trim().optional().default(""),
  topic_title: z.string().trim().optional().default(""),
  subtopic_title: z.string().trim().optional().default(""),
  learning_objective_title: z.string().trim().optional().default(""),
  material_type: z.enum(MATERIAL_TYPES),
  title: z.string().trim().min(1).max(500),
  description: z.string().optional().default(""),
  source_name: z.string().optional().default(""),
  source_url: z.string().optional().default(""),
  content_text: z.string().optional().default(""),
  video_url: z.string().optional().default(""),
  file_url: z.string().optional().default(""),
  image_url: z.string().optional().default(""),
  difficulty: z.coerce.number().int().min(1).max(5).optional().default(1),
  estimated_time_minutes: z.coerce.number().int().min(0).max(600).optional().nullable(),
  license_note: z.string().optional().default(""),
  status: z.enum(STATUSES).optional().default("draft"),
});

export type ImportRow = z.infer<typeof rowSchema>;

const rowsSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).max(2000),
  fileName: z.string().optional(),
  format: z.enum(["csv", "json"]).optional(),
});

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

async function upsertSubject(sb: any, title: string) {
  const { data: existing } = await sb.from("subjects").select("id").eq("name", title).maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await sb
    .from("subjects")
    .insert({ name: title, slug: slugify(title) })
    .select("id")
    .single();
  if (error) throw new Error(`subject insert failed: ${error.message}`);
  return data.id as string;
}

async function upsertProgram(sb: any, subjectId: string, title: string, grade: string) {
  if (!title) return null;
  const slug = slugify(`${title}-${grade || "all"}`);
  const { data: existing } = await sb
    .from("subject_programs")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("slug", slug)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await sb
    .from("subject_programs")
    .insert({ subject_id: subjectId, title, slug, grade: grade || null })
    .select("id")
    .single();
  if (error) throw new Error(`program insert failed: ${error.message}`);
  return data.id as string;
}

async function upsertTopic(
  sb: any,
  subjectId: string,
  title: string,
  parentId: string | null,
  level: number,
) {
  if (!title) return null;
  const { data: existing } = await sb
    .from("topics")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("title", title)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await sb
    .from("topics")
    .insert({ subject_id: subjectId, title, parent_topic_id: parentId, level })
    .select("id")
    .single();
  if (error) throw new Error(`topic insert failed: ${error.message}`);
  return data.id as string;
}

async function upsertObjective(sb: any, topicId: string, title: string) {
  if (!title || !topicId) return null;
  const { data: existing } = await sb
    .from("learning_objectives")
    .select("id")
    .eq("topic_id", topicId)
    .eq("title", title)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await sb
    .from("learning_objectives")
    .insert({ topic_id: topicId, title })
    .select("id")
    .single();
  if (error) throw new Error(`objective insert failed: ${error.message}`);
  return data.id as string;
}

type ImportOutcome = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

async function processRows(sb: any, userId: string, rawRows: unknown[], dryRun: boolean): Promise<ImportOutcome> {
  const outcome: ImportOutcome = { total: rawRows.length, created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rawRows.length; i++) {
    try {
      const row = rowSchema.parse(rawRows[i]);
      const subjectId = await upsertSubject(sb, row.subject_title);
      const programId = await upsertProgram(sb, subjectId, row.program_title, row.grade);
      const topicId = await upsertTopic(sb, subjectId, row.topic_title, null, 1);
      const subtopicId = row.subtopic_title
        ? await upsertTopic(sb, subjectId, row.subtopic_title, topicId, 2)
        : null;
      const effectiveTopicId = subtopicId ?? topicId;
      const objectiveId = effectiveTopicId
        ? await upsertObjective(sb, effectiveTopicId, row.learning_objective_title)
        : null;

      // Dedup: subject_id + topic_id + lower(title) + source_url
      const { data: existing } = await sb
        .from("materials")
        .select("id, description, content_text, source_url, video_url, file_url, image_url, difficulty, status")
        .eq("subject_id", subjectId)
        .eq("topic_id", effectiveTopicId ?? null)
        .ilike("title", row.title)
        .eq("source_url", row.source_url || "")
        .maybeSingle();

      const payload = {
        subject_id: subjectId,
        program_id: programId,
        topic_id: effectiveTopicId,
        learning_objective_id: objectiveId,
        grade: row.grade || null,
        title: row.title,
        description: row.description || null,
        material_type: row.material_type,
        source_name: row.source_name || null,
        source_url: row.source_url || null,
        content_text: row.content_text || null,
        video_url: row.video_url || null,
        file_url: row.file_url || null,
        image_url: row.image_url || null,
        difficulty: row.difficulty,
        estimated_time_minutes: row.estimated_time_minutes ?? null,
        license_note: row.license_note || null,
        status: row.status,
        created_by: userId,
      };

      if (existing) {
        const changed =
          existing.description !== payload.description ||
          existing.content_text !== payload.content_text ||
          existing.video_url !== payload.video_url ||
          existing.file_url !== payload.file_url ||
          existing.image_url !== payload.image_url ||
          existing.difficulty !== payload.difficulty ||
          existing.status !== payload.status;
        if (!changed) {
          outcome.skipped++;
          continue;
        }
        if (!dryRun) {
          const { error } = await sb.from("materials").update(payload).eq("id", existing.id);
          if (error) throw new Error(error.message);
        }
        outcome.updated++;
      } else {
        if (!dryRun) {
          const { error } = await sb.from("materials").insert(payload);
          if (error) throw new Error(error.message);
        }
        outcome.created++;
      }
    } catch (e: any) {
      outcome.errors.push({ row: i + 1, message: e?.message ?? String(e) });
    }
  }
  return outcome;
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

export const previewImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rowsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const outcome = await processRows(context.supabase, context.userId, data.rows, true);
    return { ...outcome, sample: data.rows.slice(0, 10) };
  });

export const runImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rowsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);

    const { data: logRow } = await context.supabase
      .from("content_import_logs")
      .insert({
        import_type: data.format ?? "csv",
        file_name: data.fileName ?? null,
        status: "started",
        total_rows: data.rows.length,
        created_by: context.userId,
      })
      .select("id")
      .single();

    let outcome: ImportOutcome;
    try {
      outcome = await processRows(context.supabase, context.userId, data.rows, false);
    } catch (e: any) {
      await context.supabase
        .from("content_import_logs")
        .update({ status: "failed", errors: [{ row: 0, message: e?.message ?? String(e) }] })
        .eq("id", logRow?.id);
      throw e;
    }

    const status =
      outcome.errors.length === 0
        ? "completed"
        : outcome.created + outcome.updated > 0
          ? "partially_completed"
          : "failed";

    await context.supabase
      .from("content_import_logs")
      .update({
        status,
        created_count: outcome.created,
        updated_count: outcome.updated,
        skipped_count: outcome.skipped,
        error_count: outcome.errors.length,
        errors: outcome.errors.length ? outcome.errors : null,
      })
      .eq("id", logRow?.id);

    return { ...outcome, logId: logRow?.id };
  });

export const listImportLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("content_import_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { logs: data ?? [] };
  });

const manualSchema = rowSchema;

export const createMaterialManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => manualSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const outcome = await processRows(context.supabase, context.userId, [data], false);
    if (outcome.errors.length) throw new Error(outcome.errors[0]!.message);
    return { ok: true, created: outcome.created, updated: outcome.updated };
  });

export const listContentSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("content_sources")
      .select("*")
      .order("title");
    if (error) throw new Error(error.message);
    return { sources: data ?? [] };
  });

const sourceSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  base_url: z.string().url().optional().nullable().or(z.literal("")),
  source_type: z.enum([
    "official",
    "open_education",
    "textbook",
    "video_platform",
    "practice_bank",
    "encyclopedia",
    "other",
  ]),
  description: z.string().optional().nullable(),
  license_note: z.string().optional().nullable(),
  is_approved: z.boolean().optional().default(false),
});

export const upsertContentSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sourceSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const payload = {
      title: data.title,
      base_url: data.base_url || null,
      source_type: data.source_type,
      description: data.description || null,
      license_note: data.license_note || null,
      is_approved: data.is_approved ?? false,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase.from("content_sources").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("content_sources")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });
