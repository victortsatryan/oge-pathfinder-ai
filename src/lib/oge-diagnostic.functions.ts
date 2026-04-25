import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DiagnosticTaskRow = {
  id: string;
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicTitle: string | null;
  prompt: string;
  answerType: "single" | "multiple" | "text";
  options: string[];
  correctAnswer: string | string[];
  explanation: string | null;
  difficulty: string;
};

export type SubjectDiagnosticBundle = {
  subjectId: string;
  subjectName: string;
  weeklyTopics: Array<{ topicId: string | null; topicTitle: string }>;
  tasks: DiagnosticTaskRow[];
};

export type DiagnosticHistoryItem = {
  id: string;
  source: "platform" | "external";
  subjectId: string;
  subjectName: string;
  date: string;
  scorePercent: number | null;
  weakTopics: string[];
  strongTopics: string[];
  notes: string | null;
};

const subjectIdSchema = z.object({ subjectId: z.string().uuid() });

function normalizeAnswer(value: unknown): string | string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function mapTask(row: any): DiagnosticTaskRow {
  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectName: row.subjects?.name ?? "",
    topicId: row.topic_id,
    topicTitle: row.topics?.title ?? null,
    prompt: row.prompt,
    answerType: (row.answer_type ?? "single") as "single" | "multiple" | "text",
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    correctAnswer: normalizeAnswer(row.correct_answer),
    explanation: row.explanation ?? null,
    difficulty: row.difficulty ?? "medium",
  };
}

/** Loads tasks for a subject filtered by recently studied topic titles (this week). */
export const loadSubjectDiagnostic = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      subjectId: z.string().uuid(),
      weeklyTopicTitles: z.array(z.string()).default([]),
      limit: z.number().min(1).max(40).default(10),
    }),
  )
  .handler(async ({ data }) => {
    const { subjectId, weeklyTopicTitles, limit } = data;

    // Find topic ids matching the weekly topic titles for this subject (fuzzy: ilike).
    let topicIds: string[] = [];
    if (weeklyTopicTitles.length > 0) {
      const { data: topicRows } = await supabaseAdmin
        .from("topics")
        .select("id, title")
        .eq("subject_id", subjectId);
      if (topicRows) {
        const lowered = weeklyTopicTitles.map((t) => t.toLowerCase());
        topicIds = topicRows
          .filter((t) =>
            lowered.some(
              (w) => t.title.toLowerCase().includes(w) || w.includes(t.title.toLowerCase()),
            ),
          )
          .map((t) => t.id);
      }
    }

    let query = supabaseAdmin
      .from("tasks")
      .select("id, subject_id, topic_id, prompt, answer_type, options, correct_answer, explanation, difficulty, subjects(name), topics(title)")
      .eq("subject_id", subjectId)
      .eq("is_published", true)
      .limit(limit);

    if (topicIds.length > 0) {
      query = query.in("topic_id", topicIds);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error("loadSubjectDiagnostic error", error);
      return { tasks: [] as DiagnosticTaskRow[] };
    }

    return { tasks: (rows ?? []).map(mapTask) };
  });

/** Search the task pool to add a task manually. */
export const searchTasksForSubject = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      subjectId: z.string().uuid(),
      query: z.string().max(200).default(""),
      excludeIds: z.array(z.string().uuid()).default([]),
    }),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("tasks")
      .select("id, subject_id, topic_id, prompt, answer_type, options, correct_answer, explanation, difficulty, subjects(name), topics(title)")
      .eq("subject_id", data.subjectId)
      .eq("is_published", true)
      .limit(20);

    if (data.query.trim().length > 0) {
      q = q.ilike("prompt", `%${data.query.trim()}%`);
    }

    const { data: rows, error } = await q;
    if (error) {
      console.error("searchTasksForSubject", error);
      return { tasks: [] as DiagnosticTaskRow[] };
    }
    const filtered = (rows ?? []).filter((r) => !data.excludeIds.includes(r.id));
    return { tasks: filtered.map(mapTask) };
  });

const sessionResultSchema = z.object({
  subjectId: z.string().uuid(),
  scorePercent: z.number().min(0).max(100),
  score: z.number().min(0),
  maxScore: z.number().min(0),
  weakTopics: z.array(z.string()).default([]),
  strongTopics: z.array(z.string()).default([]),
  answers: z.array(
    z.object({
      taskId: z.string(),
      isCorrect: z.boolean(),
      topicTitle: z.string().nullable().optional(),
    }),
  ),
});

export const saveDiagnosticSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sessionResultSchema)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("diagnostic_sessions").insert({
      user_id: userId,
      subject_id: data.subjectId,
      diagnostic_type: "weekly_subject" as any,
      score: data.score,
      max_score: data.maxScore,
      completed_at: new Date().toISOString(),
      answers: data.answers as any,
      weaknesses: data.weakTopics as any,
      strengths: data.strongTopics as any,
      recommendations: [] as any,
    });
    if (error) {
      console.error("saveDiagnosticSession", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  });

const externalSchema = z.object({
  subjectId: z.string().uuid(),
  sourceName: z.string().min(1).max(200),
  takenOn: z.string().min(8),
  score: z.number().min(0).nullable().optional(),
  maxScore: z.number().min(0).nullable().optional(),
  scorePercent: z.number().min(0).max(100).nullable().optional(),
  weakTopics: z.array(z.string()).default([]),
  strongTopics: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional().nullable(),
});

export const saveExternalDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(externalSchema)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("external_diagnostic_results" as any).insert({
      user_id: userId,
      subject_id: data.subjectId,
      source_name: data.sourceName,
      taken_on: data.takenOn,
      score: data.score ?? null,
      max_score: data.maxScore ?? null,
      score_percent: data.scorePercent ?? null,
      weak_topics: data.weakTopics,
      strong_topics: data.strongTopics,
      notes: data.notes ?? null,
    });
    if (error) {
      console.error("saveExternalDiagnostic", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  });

export const deleteExternalDiagnostic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("external_diagnostic_results" as any).delete().eq("id", data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const listDiagnosticHistory = createServerFn({ method: "GET" })
  .handler(async () => {
    // Try to get auth, but return empty list gracefully if unauthenticated
    const { getRequest } = await import("@tanstack/react-start/server");
    const { createClient } = await import("@supabase/supabase-js");
    const request = getRequest();
    const authHeader = request?.headers?.get?.("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { items: [] as DiagnosticHistoryItem[] };
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: claimsData } = await supabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (!userId) return { items: [] as DiagnosticHistoryItem[] };

    const [internal, external, subjects] = await Promise.all([
      supabase
        .from("diagnostic_sessions")
        .select("id, subject_id, score, max_score, weaknesses, strengths, completed_at, created_at, diagnostic_type")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("external_diagnostic_results" as any)
        .select("id, subject_id, source_name, taken_on, score, max_score, score_percent, weak_topics, strong_topics, notes, created_at")
        .order("taken_on", { ascending: false })
        .limit(50),
      supabaseAdmin.from("subjects").select("id, name"),
    ]);

    const subjectMap = new Map<string, string>(
      (subjects.data ?? []).map((s) => [s.id, s.name]),
    );

    const items: DiagnosticHistoryItem[] = [];

    for (const row of internal.data ?? []) {
      const score = row.score == null ? null : Number(row.score);
      const max = row.max_score == null ? null : Number(row.max_score);
      const pct = score != null && max && max > 0 ? Math.round((score / max) * 100) : null;
      items.push({
        id: row.id,
        source: "platform",
        subjectId: row.subject_id,
        subjectName: subjectMap.get(row.subject_id) ?? "—",
        date: row.completed_at ?? row.created_at,
        scorePercent: pct,
        weakTopics: Array.isArray(row.weaknesses) ? (row.weaknesses as any[]).map(String) : [],
        strongTopics: Array.isArray(row.strengths) ? (row.strengths as any[]).map(String) : [],
        notes: null,
      });
    }

    for (const row of (external.data ?? []) as any[]) {
      items.push({
        id: row.id,
        source: "external",
        subjectId: row.subject_id,
        subjectName: subjectMap.get(row.subject_id) ?? "—",
        date: row.taken_on,
        scorePercent: row.score_percent != null ? Number(row.score_percent) : null,
        weakTopics: Array.isArray(row.weak_topics) ? row.weak_topics.map(String) : [],
        strongTopics: Array.isArray(row.strong_topics) ? row.strong_topics.map(String) : [],
        notes: row.notes ?? null,
      });
    }

    items.sort((a, b) => (a.date < b.date ? 1 : -1));
    return { items };
  });

export const listSubjects = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("subjects")
    .select("id, name, slug, sort_order")
    .order("sort_order", { ascending: true });
  return { subjects: (data ?? []).map((s) => ({ id: s.id, name: s.name, slug: s.slug })) };
});
