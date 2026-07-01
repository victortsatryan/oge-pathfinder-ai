import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUS_TO_PRIORITY: Record<string, number> = {
  weak: 4,
  needs_review: 3,
  learning: 2,
  stable: 1,
  not_started: 2,
  mastered: 0,
};

async function getOrCreateProfileId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("student_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.id) return data.id;
  const ins = await supabase
    .from("student_profiles")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data.id;
}

export const listMyLearningPaths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("learning_paths")
      .select("id, title, description, goal, start_date, end_date, status, generated_by, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { paths: data ?? [] };
  });

export const getLearningPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [pathRes, itemsRes] = await Promise.all([
      sb.from("learning_paths").select("*").eq("id", data.path_id).single(),
      sb.from("learning_path_items")
        .select("*, subjects(name), topics(title)")
        .eq("learning_path_id", data.path_id)
        .order("priority", { ascending: false })
        .order("order_index", { ascending: true }),
    ]);
    if (pathRes.error) throw new Error(pathRes.error.message);
    return { path: pathRes.data, items: itemsRes.data ?? [] };
  });

const generateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  goal: z.string().max(500).optional(),
  weeks: z.number().int().min(1).max(52).default(4),
});

export const generateLearningPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => generateSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const profileId = await getOrCreateProfileId(sb, context.userId);

    const { data: progress, error: pErr } = await sb
      .from("student_topic_progress")
      .select("topic_id, subject_id, program_id, mastery_score, status, mistakes_count, topics(title)")
      .eq("student_profile_id", profileId);
    if (pErr) throw new Error(pErr.message);

    const weak = (progress ?? [])
      .filter((p: any) => p.status !== "mastered")
      .map((p: any) => ({
        ...p,
        priority: STATUS_TO_PRIORITY[p.status] ?? 2,
        sortKey:
          (STATUS_TO_PRIORITY[p.status] ?? 0) * 1000 +
          (100 - (p.mastery_score ?? 0)) +
          (p.mistakes_count ?? 0) * 2,
      }))
      .sort((a, b) => b.sortKey - a.sortKey);

    if (weak.length === 0) {
      return {
        ok: false as const,
        reason: "no_topics" as const,
        message: "Нет тем для маршрута. Добавьте предмет и пройдите диагностику.",
      };
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + data.weeks * 7);

    const pathInsert = await sb
      .from("learning_paths")
      .insert({
        student_profile_id: profileId,
        user_id: context.userId,
        title: data.title ?? `Маршрут на ${data.weeks} нед.`,
        description: `Сформирован по ${weak.length} слабым темам.`,
        goal: data.goal ?? null,
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        status: "active",
        generated_by: "system",
      })
      .select("id")
      .single();
    if (pathInsert.error) throw new Error(pathInsert.error.message);
    const pathId = pathInsert.data.id;

    // Distribute items: alternate subjects, plan ~one item per day skipping Sunday (rest)
    const itemsToInsert: any[] = [];
    const planDate = new Date(startDate);
    weak.forEach((p: any, i: number) => {
      // skip Sundays
      while (planDate.getDay() === 0) planDate.setDate(planDate.getDate() + 1);
      itemsToInsert.push({
        learning_path_id: pathId,
        student_profile_id: profileId,
        user_id: context.userId,
        subject_id: p.subject_id,
        program_id: p.program_id,
        topic_id: p.topic_id,
        title: p.topics?.title ?? "Тема",
        description: `Статус: ${p.status}, уровень: ${p.mastery_score}%`,
        priority: p.priority,
        order_index: i,
        planned_date: planDate.toISOString().slice(0, 10),
        duration_minutes: 60,
        status: "planned",
      });
      planDate.setDate(planDate.getDate() + 1);
    });

    const ins = await sb
      .from("learning_path_items")
      .insert(itemsToInsert)
      .select("id, subject_id, topic_id, program_id, title, planned_date, duration_minutes, student_profile_id, learning_path_id");
    if (ins.error) throw new Error(ins.error.message);
    const insertedItems = ins.data ?? [];

    // Auto-generate lessons + calendar_events for every path item
    let firstLessonId: string | null = null;
    if (insertedItems.length > 0) {
      const lessonRows = insertedItems.map((it: any) => ({
        user_id: context.userId,
        student_profile_id: profileId,
        learning_path_id: pathId,
        learning_path_item_id: it.id,
        subject_id: it.subject_id,
        topic_id: it.topic_id,
        program_id: it.program_id,
        lesson_date: it.planned_date,
        title: it.title,
        goal: `Закрыть слабую тему: ${it.title}`,
        duration_minutes: it.duration_minutes ?? 60,
        status: "planned" as const,
      }));
      const lessonsIns = await sb
        .from("lessons")
        .insert(lessonRows)
        .select("id, lesson_date, title, subject_id, topic_id, student_profile_id, learning_path_item_id");
      if (lessonsIns.error) throw new Error(lessonsIns.error.message);
      const lessons = lessonsIns.data ?? [];

      const eventRows = lessons.map((l: any) => ({
        user_id: context.userId,
        student_profile_id: profileId,
        event_type: "lesson",
        lesson_id: l.id,
        subject_id: l.subject_id,
        topic_id: l.topic_id,
        title: l.title,
        event_date: l.lesson_date,
        duration_minutes: 60,
        status: "planned",
      }));
      if (eventRows.length > 0) {
        await sb.from("calendar_events").insert(eventRows);
      }

      // Auto-build first lesson: attach materials + tasks (best-effort, empty state ok)
      const first = lessons[0];
      if (first) {
        firstLessonId = first.id;
        if (first.topic_id) {
          const [matsRes, tasksRes] = await Promise.all([
            sb.from("materials").select("id").eq("topic_id", first.topic_id).eq("is_public", true).order("difficulty").limit(4),
            sb.from("tasks").select("id").eq("topic_id", first.topic_id).eq("is_published", true).limit(5),
          ]);
          const mats = matsRes.data ?? [];
          if (mats.length > 0) {
            await sb.from("lesson_materials").insert(
              mats.map((m: any, i: number) => ({
                lesson_id: first.id,
                material_id: m.id,
                order_index: i,
                is_required: i === 0,
                user_id: context.userId,
              })),
            );
          }
          const tks = tasksRes.data ?? [];
          if (tks.length > 0) {
            await sb.from("lesson_tasks").insert(
              tks.map((t: any, i: number) => ({
                lesson_id: first.id,
                task_id: t.id,
                order_index: i,
                points: 1,
                is_required: true,
                user_id: context.userId,
              })),
            );
          }
        }
      }
    }

    return {
      ok: true as const,
      path_id: pathId,
      items_count: itemsToInsert.length,
      first_lesson_id: firstLessonId,
    };
  });

export const generateCalendarFromLearningPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const profileId = await getOrCreateProfileId(sb, context.userId);

    const { data: items, error } = await sb
      .from("learning_path_items")
      .select("id, subject_id, topic_id, title, planned_date, duration_minutes")
      .eq("learning_path_id", data.path_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    // Remove previous calendar events for this path's items
    const itemIds = (items ?? []).map((i: any) => i.id);
    if (itemIds.length === 0) return { created: 0 };

    // Delete existing lesson events for these path items
    const { data: existingLessons } = await sb
      .from("lessons")
      .select("id")
      .in("learning_path_item_id", itemIds);
    const lessonIds = (existingLessons ?? []).map((l: any) => l.id);
    if (lessonIds.length > 0) {
      await sb.from("calendar_events").delete().in("lesson_id", lessonIds);
      await sb.from("lessons").delete().in("id", lessonIds);
    }

    const lessonRows = items!.map((it: any) => ({
      user_id: context.userId,
      student_profile_id: profileId,
      learning_path_id: data.path_id,
      learning_path_item_id: it.id,
      subject_id: it.subject_id,
      topic_id: it.topic_id,
      lesson_date: it.planned_date,
      title: it.title,
      duration_minutes: it.duration_minutes,
      status: "planned" as const,
    }));

    const lessonsIns = await sb.from("lessons").insert(lessonRows).select("id, lesson_date, title, subject_id, topic_id, student_profile_id");
    if (lessonsIns.error) throw new Error(lessonsIns.error.message);

    const eventRows = (lessonsIns.data ?? []).map((l: any) => ({
      user_id: context.userId,
      student_profile_id: l.student_profile_id,
      event_type: "lesson",
      lesson_id: l.id,
      subject_id: l.subject_id,
      topic_id: l.topic_id,
      title: l.title,
      event_date: l.lesson_date,
      duration_minutes: 60,
      status: "planned",
    }));
    if (eventRows.length > 0) {
      const e = await sb.from("calendar_events").insert(eventRows);
      if (e.error) throw new Error(e.error.message);
    }

    return { created: lessonsIns.data?.length ?? 0 };
  });

export const listCalendarEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ from: z.string().optional(), to: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("calendar_events")
      .select("id, event_type, title, description, event_date, start_time, duration_minutes, status, lesson_id, diagnostic_session_id, subject_id, topic_id, subjects(name), topics(title)")
      .eq("user_id", context.userId)
      .order("event_date");
    if (data.from) q = q.gte("event_date", data.from);
    if (data.to) q = q.lte("event_date", data.to);
    const { data: events, error } = await q;
    if (error) throw new Error(error.message);
    return { events: events ?? [] };
  });
