import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

async function ensureTeacherProfile(sb: any, userId: string) {
  const { data, error } = await sb
    .from("teacher_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: created, error: cErr } = await sb
    .from("teacher_profiles")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (cErr) throw cErr;
  return created;
}

async function assertLink(sb: any, teacherId: string, studentProfileId: string) {
  const { data, error } = await sb
    .from("teacher_student_links")
    .select("id, status")
    .eq("teacher_profile_id", teacherId)
    .eq("student_profile_id", studentProfileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No link to this student");
  return data;
}

async function logActivity(sb: any, teacherId: string, payload: {
  student_profile_id?: string | null;
  action_type: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}) {
  await sb.from("teacher_activity_log").insert({
    teacher_profile_id: teacherId,
    student_profile_id: payload.student_profile_id ?? null,
    action_type: payload.action_type,
    entity_type: payload.entity_type ?? null,
    entity_id: payload.entity_id ?? null,
    metadata: payload.metadata ?? {},
  });
}

// ---------- Profile ----------
export const getMyTeacherProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return ensureTeacherProfile(context.supabase, context.userId);
  });

export const updateMyTeacherProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      display_name: z.string().max(120).nullable().optional(),
      specialization: z.string().max(200).nullable().optional(),
      bio: z.string().max(2000).nullable().optional(),
      timezone: z.string().max(80).nullable().optional(),
      language: z.string().max(10).optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const tp = await ensureTeacherProfile(sb, context.userId);
    const { data: row, error } = await sb
      .from("teacher_profiles")
      .update(data)
      .eq("id", tp.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ---------- Students ----------
export const listMyTeacherStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const tp = await ensureTeacherProfile(sb, context.userId);
    const { data: links, error } = await sb
      .from("teacher_student_links")
      .select("id, status, started_at, ended_at, student_profile_id, student_profiles:student_profile_id(id, display_name, grade, learning_goal, target_exam)")
      .eq("teacher_profile_id", tp.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const studentIds = (links ?? []).map((l: any) => l.student_profile_id);
    if (studentIds.length === 0) return { teacher: tp, students: [] };

    const { data: progress } = await sb
      .from("student_topic_progress")
      .select("student_profile_id, mastery_score, status, updated_at")
      .in("student_profile_id", studentIds);

    const map = new Map<string, { avg: number; weak: number; lastActive: string | null; count: number }>();
    for (const p of progress ?? []) {
      const cur = map.get(p.student_profile_id) ?? { avg: 0, weak: 0, lastActive: null, count: 0 };
      cur.avg += p.mastery_score ?? 0;
      cur.count += 1;
      if (p.status === "weak" || p.status === "needs_review" || (p.mastery_score ?? 0) < 40) cur.weak += 1;
      if (!cur.lastActive || (p.updated_at && p.updated_at > cur.lastActive)) cur.lastActive = p.updated_at;
      map.set(p.student_profile_id, cur);
    }

    const students = (links ?? []).map((l: any) => {
      const s = map.get(l.student_profile_id);
      return {
        link_id: l.id,
        status: l.status,
        started_at: l.started_at,
        student: l.student_profiles,
        avg_mastery: s && s.count ? Math.round(s.avg / s.count) : 0,
        weak_count: s?.weak ?? 0,
        last_active: s?.lastActive ?? null,
        needs_attention:
          (s && s.count && s.avg / s.count < 40) ||
          (s?.weak ?? 0) >= 3 ||
          !s?.lastActive ||
          (s?.lastActive && new Date(s.lastActive).getTime() < Date.now() - 7 * 86400_000),
      };
    });
    return { teacher: tp, students };
  });

export const linkStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ student_profile_id: uuid }).parse(i))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const tp = await ensureTeacherProfile(sb, context.userId);
    const { data: row, error } = await sb
      .from("teacher_student_links")
      .upsert(
        { teacher_profile_id: tp.id, student_profile_id: data.student_profile_id, status: "active" },
        { onConflict: "teacher_profile_id,student_profile_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    await logActivity(sb, tp.id, {
      student_profile_id: data.student_profile_id,
      action_type: "link_student",
      entity_type: "teacher_student_links",
      entity_id: row.id,
    });
    return row;
  });

export const updateLinkStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ link_id: uuid, status: z.enum(["active", "paused", "completed", "archived"]) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb
      .from("teacher_student_links")
      .update({ status: data.status, ended_at: data.status === "active" ? null : new Date().toISOString().slice(0, 10) })
      .eq("id", data.link_id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ---------- Student detail ----------
export const getTeacherStudentDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ student_profile_id: uuid }).parse(i))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const tp = await ensureTeacherProfile(sb, context.userId);
    await assertLink(sb, tp.id, data.student_profile_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const a = supabaseAdmin;
    const [profileRes, subjectsRes, progressRes, mistakesRes, pathsRes, lessonsRes, notesRes, assignmentsRes] =
      await Promise.all([
        a.from("student_profiles").select("*").eq("id", data.student_profile_id).maybeSingle(),
        a.from("student_subjects").select("*, subject:subjects(id, name)").eq("student_profile_id", data.student_profile_id),
        a.from("student_topic_progress")
          .select("topic_id, mastery_score, status, mistakes_count, updated_at, topic:topics(id, title, subject_id)")
          .eq("student_profile_id", data.student_profile_id)
          .order("mastery_score", { ascending: true })
          .limit(20),
        a.from("student_mistakes").select("*").eq("student_profile_id", data.student_profile_id).order("created_at", { ascending: false }).limit(15),
        a.from("learning_paths").select("*").eq("student_profile_id", data.student_profile_id).order("created_at", { ascending: false }),
        a.from("lessons").select("id, title, lesson_date, status, topic_id").eq("student_profile_id", data.student_profile_id).order("lesson_date", { ascending: true }).limit(20),
        sb.from("teacher_notes").select("*").eq("teacher_profile_id", tp.id).eq("student_profile_id", data.student_profile_id).order("created_at", { ascending: false }),
        sb.from("teacher_assignments").select("*").eq("teacher_profile_id", tp.id).eq("student_profile_id", data.student_profile_id).order("created_at", { ascending: false }),
      ]);

    return {
      teacher: tp,
      profile: profileRes.data,
      subjects: subjectsRes.data ?? [],
      progress: progressRes.data ?? [],
      mistakes: mistakesRes.data ?? [],
      paths: pathsRes.data ?? [],
      lessons: lessonsRes.data ?? [],
      notes: notesRes.data ?? [],
      assignments: assignmentsRes.data ?? [],
    };
  });

// ---------- Notes ----------
export const createTeacherNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      student_profile_id: uuid,
      subject_id: uuid.nullable().optional(),
      topic_id: uuid.nullable().optional(),
      note_type: z.enum(["observation", "lesson", "diagnostic", "recommendation", "parent_note", "other"]).default("observation"),
      content: z.string().min(1).max(5000),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const tp = await ensureTeacherProfile(sb, context.userId);
    await assertLink(sb, tp.id, data.student_profile_id);
    const { data: row, error } = await sb
      .from("teacher_notes")
      .insert({ ...data, teacher_profile_id: tp.id })
      .select("*")
      .single();
    if (error) throw error;
    await logActivity(sb, tp.id, {
      student_profile_id: data.student_profile_id,
      action_type: "create_note",
      entity_type: "teacher_notes",
      entity_id: row.id,
    });
    return row;
  });

// ---------- Assignments ----------
export const createAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      student_profile_id: uuid,
      title: z.string().min(1).max(200),
      comment: z.string().max(2000).optional().nullable(),
      material_id: uuid.nullable().optional(),
      task_id: uuid.nullable().optional(),
      lesson_id: uuid.nullable().optional(),
      due_date: z.string().nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const tp = await ensureTeacherProfile(sb, context.userId);
    await assertLink(sb, tp.id, data.student_profile_id);
    const { data: row, error } = await sb
      .from("teacher_assignments")
      .insert({ ...data, teacher_profile_id: tp.id })
      .select("*")
      .single();
    if (error) throw error;
    await logActivity(sb, tp.id, {
      student_profile_id: data.student_profile_id,
      action_type: "create_assignment",
      entity_type: "teacher_assignments",
      entity_id: row.id,
    });
    return row;
  });

// ---------- AI suggestions (rule-based stub; can later call AI gateway) ----------
export const analyseStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ student_profile_id: uuid }).parse(i))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const tp = await ensureTeacherProfile(sb, context.userId);
    await assertLink(sb, tp.id, data.student_profile_id);
    const { supabaseAdmin: a } = await import("@/integrations/supabase/client.server");

    const [{ data: progress }, { data: mistakes }] = await Promise.all([
      a.from("student_topic_progress").select("mastery_score, status, mistakes_count, topic:topics(title)").eq("student_profile_id", data.student_profile_id),
      a.from("student_mistakes").select("mistake_type").eq("student_profile_id", data.student_profile_id),
    ]);

    const weak = (progress ?? []).filter((p: any) => (p.mastery_score ?? 0) < 50).sort((x: any, y: any) => x.mastery_score - y.mastery_score).slice(0, 5);
    const avg = (progress ?? []).length
      ? Math.round((progress ?? []).reduce((s: number, p: any) => s + (p.mastery_score ?? 0), 0) / (progress ?? []).length)
      : 0;
    const mistakeTypes = new Map<string, number>();
    for (const m of mistakes ?? []) mistakeTypes.set(m.mistake_type ?? "unknown", (mistakeTypes.get(m.mistake_type ?? "unknown") ?? 0) + 1);

    const summary = {
      avg_mastery: avg,
      weak_topics: weak.map((w: any) => ({ title: w.topic?.title, mastery: w.mastery_score })),
      top_mistakes: Array.from(mistakeTypes.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, count]) => ({ type, count })),
      blockers:
        avg < 40
          ? "Базовый уровень низкий — нужна работа над фундаментом."
          : weak.length >= 3
          ? "Несколько слабых тем — рекомендуется блок повторения."
          : "Общий прогресс стабильный, продолжайте текущий маршрут.",
      next_actions: weak.length
        ? weak.slice(0, 3).map((w: any) => `Назначить занятие по теме «${w.topic?.title}»`)
        : ["Запустить диагностику для уточнения зон роста"],
    };

    const { data: row, error } = await sb.from("teacher_ai_suggestions").insert({
      teacher_profile_id: tp.id,
      student_profile_id: data.student_profile_id,
      scenario: "analyse_student",
      input: {},
      output: summary,
      status: "suggested",
    }).select("*").single();
    if (error) throw error;
    return row;
  });
