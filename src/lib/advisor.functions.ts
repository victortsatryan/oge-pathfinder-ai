import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

async function ensureTeacherProfile(sb: any, userId: string) {
  const { data } = await sb.from("teacher_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data;
  const { data: created, error } = await sb
    .from("teacher_profiles")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  return created;
}

async function assertLink(sb: any, teacherId: string, studentProfileId: string) {
  const { data } = await sb
    .from("teacher_student_links")
    .select("id")
    .eq("teacher_profile_id", teacherId)
    .eq("student_profile_id", studentProfileId)
    .maybeSingle();
  if (!data) throw new Error("No link to this student");
}

type AdvisorContext = {
  student: any;
  subjects: any[];
  progress_summary: {
    total_topics: number;
    avg_mastery: number;
    weak_count: number;
    last_activity: string | null;
  };
  weak_topics: Array<{ topic_id: string; title: string; mastery_score: number; status: string; mistakes_count: number }>;
  recent_mistakes: any[];
  repeated_mistakes: Array<{ key: string; mistake_type: string | null; topic_id: string | null; topic_title: string | null; source: string | null; count: number; last: string | null }>;
  recent_lessons: any[];
  upcoming_lessons: any[];
  learning_path: any;
  teacher_notes: any[];
  materials_to_consider: any[];
  next_path_step: any | null;
};

async function buildContext(sb: any, teacherId: string, studentProfileId: string): Promise<AdvisorContext> {
  const { supabaseAdmin: a } = await import("@/integrations/supabase/client.server");
  const [profileRes, subjectsRes, progressRes, mistakesRes, pathsRes, lessonsRes, notesRes] = await Promise.all([
    a.from("student_profiles").select("*").eq("id", studentProfileId).maybeSingle(),
    a.from("student_subjects").select("*, subject:subjects(id, name)").eq("student_profile_id", studentProfileId),
    a.from("student_topic_progress")
      .select("topic_id, mastery_score, status, mistakes_count, updated_at, topic:topics(id, title, subject_id)")
      .eq("student_profile_id", studentProfileId),
    a.from("student_mistakes")
      .select("id, mistake_type, mistake_description, source, topic_id, created_at, topic:topics(id, title)")
      .eq("student_profile_id", studentProfileId)
      .order("created_at", { ascending: false })
      .limit(30),
    a.from("learning_paths").select("*").eq("student_profile_id", studentProfileId).order("created_at", { ascending: false }),
    a.from("lessons")
      .select("id, title, lesson_date, status, topic_id, subject_id, lesson_results(score_percent)")
      .eq("student_profile_id", studentProfileId)
      .order("lesson_date", { ascending: false })
      .limit(30),
    sb.from("teacher_notes")
      .select("*")
      .eq("teacher_profile_id", teacherId)
      .eq("student_profile_id", studentProfileId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const progress = progressRes.data ?? [];
  const mistakes = mistakesRes.data ?? [];
  const lessons = lessonsRes.data ?? [];
  const paths = pathsRes.data ?? [];
  const activePath = paths.find((p: any) => p.status === "active") ?? paths[0] ?? null;

  const total = progress.length;
  const sum = progress.reduce((acc: number, p: any) => acc + (p.mastery_score ?? 0), 0);
  const avg = total ? Math.round(sum / total) : 0;
  const weak = progress.filter((p: any) => (p.mastery_score ?? 0) < 50 || p.status === "weak" || p.status === "needs_review");
  const lastActivity = progress
    .map((p: any) => p.updated_at)
    .filter(Boolean)
    .sort()
    .pop() ?? null;

  const weakTopics = weak
    .sort((a: any, b: any) => (a.mastery_score ?? 0) - (b.mastery_score ?? 0))
    .slice(0, 10)
    .map((p: any) => ({
      topic_id: p.topic_id,
      title: p.topic?.title ?? "—",
      mastery_score: p.mastery_score ?? 0,
      status: p.status ?? "—",
      mistakes_count: p.mistakes_count ?? 0,
    }));

  // Repeated mistakes: group by (mistake_type, topic_id, source)
  const groups = new Map<string, { mistake_type: string | null; topic_id: string | null; topic_title: string | null; source: string | null; count: number; last: string | null }>();
  for (const m of mistakes) {
    const key = `${m.mistake_type ?? "?"}|${m.topic_id ?? "?"}|${m.source ?? "?"}`;
    const cur = groups.get(key) ?? {
      mistake_type: m.mistake_type ?? null,
      topic_id: m.topic_id ?? null,
      topic_title: (m as any).topic?.title ?? null,
      source: m.source ?? null,
      count: 0,
      last: null as string | null,
    };
    cur.count += 1;
    if (!cur.last || (m.created_at && m.created_at > cur.last)) cur.last = m.created_at;
    groups.set(key, cur);
  }
  const repeated = Array.from(groups.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const now = Date.now();
  const upcoming = lessons.filter((l: any) => l.status !== "completed" && l.lesson_date && new Date(l.lesson_date).getTime() >= now - 86400_000);
  const recent = lessons.filter((l: any) => l.status === "completed").slice(0, 8);

  // Materials to consider — for weak topics
  const weakTopicIds = weakTopics.map((w) => w.topic_id).filter(Boolean);
  let materials: any[] = [];
  if (weakTopicIds.length > 0) {
    const { data: mats } = await a
      .from("materials")
      .select("id, title, material_type, difficulty, topic_id, learning_objective_id")
      .in("topic_id", weakTopicIds)
      .eq("status", "published")
      .limit(12);
    materials = mats ?? [];
  }

  // Next path step
  let nextStep: any = null;
  if (activePath) {
    const { data: items } = await a
      .from("learning_path_items")
      .select("*, topic:topics(title)")
      .eq("learning_path_id", activePath.id)
      .order("order_index", { ascending: true });
    nextStep = (items ?? []).find((i: any) => i.status !== "completed") ?? null;
  }

  return {
    student: profileRes.data,
    subjects: subjectsRes.data ?? [],
    progress_summary: { total_topics: total, avg_mastery: avg, weak_count: weak.length, last_activity: lastActivity },
    weak_topics: weakTopics,
    recent_mistakes: mistakes.slice(0, 10),
    repeated_mistakes: repeated,
    recent_lessons: recent,
    upcoming_lessons: upcoming.slice(0, 5),
    learning_path: activePath,
    teacher_notes: notesRes.data ?? [],
    materials_to_consider: materials,
    next_path_step: nextStep,
  };
}

function generateInsights(ctx: AdvisorContext) {
  const s = ctx.progress_summary;
  const name = ctx.student?.display_name ?? "ученика";

  const before_lesson: string[] = [];
  if (s.total_topics === 0) {
    before_lesson.push("Пока мало данных для сравнения. Советник начнёт видеть динамику после нескольких занятий и диагностик.");
  } else {
    const weakLine = s.weak_count > 0
      ? `По данным видно ${s.weak_count} слабых тем (средний прогресс ${s.avg_mastery}%).`
      : `По данным средний прогресс ${s.avg_mastery}%, критично слабых тем не видно.`;
    before_lesson.push(weakLine);
    if (ctx.repeated_mistakes.length > 0) {
      const top = ctx.repeated_mistakes[0];
      before_lesson.push(`Чаще всего повторяются ошибки: ${top.mistake_type ?? "без типа"}${top.topic_title ? ` (${top.topic_title})` : ""}.`);
    }
    if (ctx.next_path_step) {
      before_lesson.push(`Ближайший шаг маршрута — ${ctx.next_path_step.title ?? ctx.next_path_step.topic?.title ?? "следующая тема"}. Возможно, стоит проверить закрепление предыдущих тем.`);
    }
  }

  const changes: string[] = [];
  const recentCount = ctx.recent_lessons.length;
  const upcomingCount = ctx.upcoming_lessons.length;
  if (recentCount === 0 && upcomingCount === 0) {
    changes.push("Пока мало данных для сравнения.");
  } else {
    if (recentCount > 0) changes.push(`За последнее время завершено занятий: ${recentCount}.`);
    if (upcomingCount > 0) changes.push(`Запланировано ближайших занятий: ${upcomingCount}.`);
    const weekAgo = Date.now() - 7 * 86400_000;
    const newMistakes = ctx.recent_mistakes.filter((m: any) => m.created_at && new Date(m.created_at).getTime() >= weekAgo).length;
    if (newMistakes > 0) changes.push(`Новых зафиксированных ошибок за 7 дней: ${newMistakes}.`);
    if (s.last_activity && new Date(s.last_activity).getTime() < weekAgo) {
      changes.push("Активности не было более 7 дней — можно уточнить контекст на занятии.");
    }
  }

  const risks: string[] = [];
  if (s.last_activity && new Date(s.last_activity).getTime() < Date.now() - 7 * 86400_000) {
    risks.push("Долго не было активности в прогрессе тем.");
  }
  const stubbornWeak = ctx.weak_topics.filter((w) => w.mastery_score < 40);
  for (const w of stubbornWeak.slice(0, 3)) {
    risks.push(`Тема «${w.title}» остаётся слабой (${w.mastery_score}%).`);
  }
  for (const r of ctx.repeated_mistakes.slice(0, 2)) {
    risks.push(`Повторяющаяся ошибка «${r.mistake_type ?? "без типа"}»${r.topic_title ? ` в теме «${r.topic_title}»` : ""} — ${r.count} раз.`);
  }
  const completedButLow = ctx.recent_lessons.filter((l: any) => (l.lesson_results?.[0]?.score_percent ?? 100) < 50).length;
  if (completedButLow > 0) {
    risks.push(`Есть ${completedButLow} завершённых занятий с низким результатом — возможно, тема ещё не закрепилась.`);
  }
  if (risks.length === 0 && s.total_topics > 0) {
    risks.push("Явных учебных рисков по данным не видно.");
  }

  const materials_to_use = ctx.materials_to_consider.slice(0, 6).map((m: any) => ({
    id: m.id,
    title: m.title,
    type: m.material_type,
    difficulty: m.difficulty,
  }));

  // Drafts (rule-based)
  const weakList = ctx.weak_topics.slice(0, 3).map((w) => `• ${w.title} (${w.mastery_score}%)`).join("\n") || "• (нет данных)";
  const repeatedList = ctx.repeated_mistakes.slice(0, 3).map((r) => `• ${r.mistake_type ?? "ошибка"}${r.topic_title ? ` — ${r.topic_title}` : ""} (×${r.count})`).join("\n") || "• (нет данных)";
  const nextStepTitle = ctx.next_path_step?.title ?? ctx.next_path_step?.topic?.title ?? "следующий шаг маршрута";

  const drafts = {
    lesson_plan:
`Черновик плана занятия (${name})

1. Разминка — короткое повторение прошлой темы (5–7 мин).
2. Работа со слабыми темами:
${weakList}
3. Разбор повторяющихся ошибок:
${repeatedList}
4. Переход к следующему шагу маршрута: ${nextStepTitle}.
5. Мини-итог и короткое задание домой.

Это черновик. Можно оставить как есть, изменить или переставить блоки.`,
    homework:
`Черновик домашнего задания (${name})

Основной фокус — закрепить слабые темы:
${weakList}

Дополнительно — короткая работа над повторяющимися ошибками:
${repeatedList}

Ориентировочный объём: 20–30 минут. Можно скорректировать под уровень.`,
    student_comment:
`Черновик комментария ученику

Хорошая работа на прошлом занятии. Есть смысл ещё раз пройтись по темам, где пока не всё закрепилось:
${weakList}

Если что-то из этого показалось трудным — отметь, разберём вместе на следующем занятии.`,
    parent_report:
`Черновик отчёта родителю

По данным за последний период средний прогресс — ${s.avg_mastery}%.
Слабых тем: ${s.weak_count}. Пока в фокусе:
${weakList}

Повторяющиеся типы ошибок:
${repeatedList}

Следующий шаг: ${nextStepTitle}. Занятия и практика продолжаются в штатном режиме.`,
  };

  return { before_lesson, changes, repeated_mistakes: ctx.repeated_mistakes, risks, materials_to_use, drafts };
}

// ---------- Public server fns ----------
export const buildTeacherAdvisorContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ student_profile_id: uuid }).parse(i))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const tp = await ensureTeacherProfile(sb, context.userId);
    await assertLink(sb, tp.id, data.student_profile_id);
    const ctx = await buildContext(sb, tp.id, data.student_profile_id);
    const insights = generateInsights(ctx);
    return { context: ctx, insights };
  });

export const generateTeacherAdvisorWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ student_profile_id: uuid, scenario: z.string().max(80).optional() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const tp = await ensureTeacherProfile(sb, context.userId);
    await assertLink(sb, tp.id, data.student_profile_id);
    const ctx = await buildContext(sb, tp.id, data.student_profile_id);
    // Fallback: rule-based. Hook here later for real LLM.
    return { context: ctx, insights: generateInsights(ctx), source: "rule-based" as const };
  });

// Overview across all linked students
export const getTeacherAdvisorOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const tp = await ensureTeacherProfile(sb, context.userId);
    const { data: links } = await sb
      .from("teacher_student_links")
      .select("student_profile_id, student_profiles:student_profile_id(id, display_name, grade)")
      .eq("teacher_profile_id", tp.id)
      .eq("status", "active");
    const ids = (links ?? []).map((l: any) => l.student_profile_id);
    if (ids.length === 0) {
      return { has_students: false, today: [], attention: [], recent_changes: [] };
    }
    const { supabaseAdmin: a } = await import("@/integrations/supabase/client.server");
    const [{ data: lessons }, { data: prog }, { data: mistakes }] = await Promise.all([
      a.from("lessons")
        .select("id, title, lesson_date, status, student_profile_id")
        .in("student_profile_id", ids)
        .gte("lesson_date", new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10))
        .order("lesson_date", { ascending: true })
        .limit(50),
      a.from("student_topic_progress")
        .select("student_profile_id, mastery_score, status, updated_at, topic_id, topic:topics(title)")
        .in("student_profile_id", ids),
      a.from("student_mistakes")
        .select("student_profile_id, topic_id, created_at")
        .in("student_profile_id", ids)
        .gte("created_at", new Date(Date.now() - 14 * 86400_000).toISOString()),
    ]);

    const nameMap = new Map((links ?? []).map((l: any) => [l.student_profile_id, l.student_profiles?.display_name ?? "—"]));

    const today = (lessons ?? [])
      .filter((l: any) => l.status !== "completed")
      .slice(0, 10)
      .map((l: any) => ({ ...l, student_name: nameMap.get(l.student_profile_id) ?? "—" }));

    const perStudent = new Map<string, { avg: number; n: number; weak: number; last: string | null; weakTopics: Set<string> }>();
    for (const p of prog ?? []) {
      const cur = perStudent.get(p.student_profile_id) ?? { avg: 0, n: 0, weak: 0, last: null as string | null, weakTopics: new Set<string>() };
      cur.avg += p.mastery_score ?? 0;
      cur.n += 1;
      if ((p.mastery_score ?? 0) < 40 || p.status === "weak") { cur.weak += 1; if (p.topic_id) cur.weakTopics.add(p.topic_id); }
      if (!cur.last || (p.updated_at && p.updated_at > cur.last)) cur.last = p.updated_at;
      perStudent.set(p.student_profile_id, cur);
    }

    const mistakePerTopic = new Map<string, number>();
    for (const m of mistakes ?? []) {
      const key = `${m.student_profile_id}|${m.topic_id}`;
      mistakePerTopic.set(key, (mistakePerTopic.get(key) ?? 0) + 1);
    }
    const heavyMistakeStudents = new Set<string>();
    for (const [k, v] of mistakePerTopic) if (v >= 3) heavyMistakeStudents.add(k.split("|")[0]);

    const attention: any[] = [];
    for (const sid of ids) {
      const s = perStudent.get(sid) ?? { avg: 0, n: 0, weak: 0, last: null, weakTopics: new Set<string>() };
      const avg = s.n ? s.avg / s.n : 0;
      const stale = !s.last || new Date(s.last).getTime() < Date.now() - 7 * 86400_000;
      const reasons: string[] = [];
      if (avg < 40 && s.n > 0) reasons.push("средний прогресс ниже 40%");
      if (stale) reasons.push("нет активности более 7 дней");
      if (heavyMistakeStudents.has(sid)) reasons.push("3+ ошибок по одной теме");
      if (reasons.length > 0) {
        attention.push({
          student_profile_id: sid,
          name: nameMap.get(sid),
          avg: Math.round(avg),
          weak: s.weak,
          reasons,
        });
      }
    }

    const recent_changes = (prog ?? [])
      .filter((p: any) => p.updated_at && new Date(p.updated_at).getTime() >= Date.now() - 7 * 86400_000)
      .slice(0, 15)
      .map((p: any) => ({
        student_profile_id: p.student_profile_id,
        student_name: nameMap.get(p.student_profile_id) ?? "—",
        topic: p.topic?.title ?? "—",
        mastery_score: p.mastery_score ?? 0,
        status: p.status,
        updated_at: p.updated_at,
      }));

    return { has_students: true, today, attention, recent_changes };
  });
