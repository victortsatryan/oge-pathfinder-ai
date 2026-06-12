import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Profile ----------

export const getMyStudentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const sb = supabase as any;
    const { data, error } = await sb
      .from("student_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;

    // Авто-создание пустого профиля при первом обращении
    const { data: base } = await sb
      .from("profiles")
      .select("display_name, first_name, last_name, grade")
      .eq("user_id", userId)
      .maybeSingle();

    const display =
      base?.display_name ??
      [base?.first_name, base?.last_name].filter(Boolean).join(" ") ||
      null;

    const { data: created, error: insertErr } = await sb
      .from("student_profiles")
      .insert({
        user_id: userId,
        display_name: display,
        grade: base?.grade ? String(base.grade) : null,
      })
      .select("*")
      .single();
    if (insertErr) throw insertErr;
    return created;
  });

const updateProfileSchema = z.object({
  display_name: z.string().trim().max(120).nullable().optional(),
  grade: z.string().trim().max(40).nullable().optional(),
  age: z.number().int().min(5).max(99).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  language: z.string().trim().max(10).optional(),
  learning_goal: z.string().trim().max(500).nullable().optional(),
  target_exam: z.string().trim().max(40).nullable().optional(),
  target_date: z.string().nullable().optional(),
  target_score: z.string().trim().max(40).nullable().optional(),
  preferred_intensity: z.enum(["low", "medium", "high"]).nullable().optional(),
});

export const updateMyStudentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateProfileSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) if (v !== undefined) payload[k] = v;
    const { data: updated, error } = await sb
      .from("student_profiles")
      .update(payload)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw error;
    return updated;
  });

// ---------- Subjects catalog ----------

export const listSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("subjects")
      .select("id, slug, name, description, category, exam_type, is_school_subject")
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  });

// ---------- Student subjects + topics ----------

export const listMyStudentSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return [];
    const { data, error } = await sb
      .from("student_subjects")
      .select(
        "id, goal, target_level, target_score, status, started_at, subject:subjects(id, slug, name, exam_type)",
      )
      .eq("student_profile_id", profile.id)
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  });

const addSubjectSchema = z.object({
  subject_id: z.string().uuid(),
  goal: z.string().trim().max(300).optional().nullable(),
  target_score: z.string().trim().max(40).optional().nullable(),
});

export const addStudentSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addSubjectSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    // Гарантируем профиль
    let { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) {
      const r = await sb
        .from("student_profiles")
        .insert({ user_id: context.userId })
        .select("id")
        .single();
      if (r.error) throw r.error;
      profile = r.data;
    }

    const { data: ss, error } = await sb
      .from("student_subjects")
      .upsert(
        {
          student_profile_id: profile.id,
          subject_id: data.subject_id,
          goal: data.goal ?? null,
          target_score: data.target_score ?? null,
          status: "active",
          started_at: new Date().toISOString().slice(0, 10),
        },
        { onConflict: "student_profile_id,subject_id" },
      )
      .select("id, subject_id")
      .single();
    if (error) throw error;

    // Создаём записи прогресса для всех корневых тем предмета
    const { data: topics } = await sb
      .from("topics")
      .select("id")
      .eq("subject_id", data.subject_id)
      .is("parent_topic_id", null);

    if (topics && topics.length > 0) {
      const rows = topics.map((t: { id: string }) => ({
        student_profile_id: profile!.id,
        subject_id: data.subject_id,
        topic_id: t.id,
        mastery_score: 0,
      }));
      await sb
        .from("student_topic_progress")
        .upsert(rows, { onConflict: "student_profile_id,topic_id" });
    }
    return ss;
  });

export const removeStudentSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ student_subject_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("student_subjects")
      .delete()
      .eq("id", data.student_subject_id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Topic progress / map ----------

export const listTopicProgressBySubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ subject_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return [];
    const { data: rows, error } = await sb
      .from("student_topic_progress")
      .select(
        "id, mastery_score, status, attempts_count, mistakes_count, last_activity_at, topic:topics(id, title, sort_order)",
      )
      .eq("student_profile_id", profile.id)
      .eq("subject_id", data.subject_id);
    if (error) throw error;
    return (rows ?? []).sort(
      (a: any, b: any) =>
        (a.topic?.sort_order ?? 0) - (b.topic?.sort_order ?? 0),
    );
  });

// ---------- Analytics: weak topics, mistakes, summary ----------

export const listMyWeakTopics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return [];
    const { data, error } = await sb
      .from("student_topic_progress")
      .select(
        "id, mastery_score, status, topic:topics(title), subject:subjects(name)",
      )
      .eq("student_profile_id", profile.id)
      .in("status", ["weak", "needs_review"])
      .order("mastery_score");
    if (error) throw error;
    return data ?? [];
  });

export const listMyRecentMistakes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return [];
    const { data, error } = await sb
      .from("student_mistakes")
      .select(
        "id, mistake_type, mistake_description, source, created_at, topic:topics(title), subject:subjects(name)",
      )
      .eq("student_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  });

export const getStudentProfileAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) {
      return {
        bySubject: [],
        weakCount: 0,
        reviewCount: 0,
        mistakesCount: 0,
        lastActivityAt: null as string | null,
      };
    }
    const { data: prog } = await sb
      .from("student_topic_progress")
      .select("subject_id, mastery_score, status, last_activity_at, subject:subjects(name)")
      .eq("student_profile_id", profile.id);
    const { count: mistakesCount } = await sb
      .from("student_mistakes")
      .select("id", { count: "exact", head: true })
      .eq("student_profile_id", profile.id);

    const rows = prog ?? [];
    const subjects = new Map<string, { name: string; total: number; sum: number; weak: number; review: number }>();
    let lastActivity: string | null = null;
    for (const r of rows as any[]) {
      const name = r.subject?.name ?? "—";
      const e = subjects.get(r.subject_id) ?? { name, total: 0, sum: 0, weak: 0, review: 0 };
      e.total += 1;
      e.sum += r.mastery_score ?? 0;
      if (r.status === "weak") e.weak += 1;
      if (r.status === "needs_review") e.review += 1;
      subjects.set(r.subject_id, e);
      if (r.last_activity_at && (!lastActivity || r.last_activity_at > lastActivity)) {
        lastActivity = r.last_activity_at;
      }
    }
    return {
      bySubject: Array.from(subjects.entries()).map(([id, v]) => ({
        subject_id: id,
        name: v.name,
        avg: v.total ? Math.round(v.sum / v.total) : 0,
        weakCount: v.weak,
        reviewCount: v.review,
        totalTopics: v.total,
      })),
      weakCount: rows.filter((r: any) => r.status === "weak").length,
      reviewCount: rows.filter((r: any) => r.status === "needs_review").length,
      mistakesCount: mistakesCount ?? 0,
      lastActivityAt: lastActivity,
    };
  });
