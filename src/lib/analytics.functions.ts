import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REVIEW_AFTER_DAYS = 14;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/** Overall student overview: subjects, totals, streaks. */
export const getStudentOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;

    const { data: profile } = await sb
      .from("student_profiles")
      .select("id, learning_goal, target_score, grade")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!profile) {
      return {
        profile: null,
        active_subjects: 0,
        avg_mastery: 0,
        total_topics: 0,
        mastered_topics: 0,
        learning_topics: 0,
        weak_topics: 0,
        lessons_count: 0,
        diagnostics_count: 0,
        streak_days: 0,
      };
    }

    const [{ data: subjects }, { data: progress }, { data: lessons }, { data: diags }] =
      await Promise.all([
        sb.from("student_subjects").select("id").eq("student_profile_id", profile.id),
        sb
          .from("student_topic_progress")
          .select("mastery_score, status")
          .eq("student_profile_id", profile.id),
        sb
          .from("lessons")
          .select("id, status, lesson_date")
          .eq("student_profile_id", profile.id),
        sb
          .from("diagnostic_sessions")
          .select("id, status")
          .eq("student_profile_id", profile.id),
      ]);

    const prog = progress ?? [];
    const mastered = prog.filter((p) => p.status === "mastered").length;
    const weak = prog.filter((p) => p.status === "weak" || p.status === "needs_review").length;
    const learning = prog.filter((p) => p.status === "learning" || p.status === "stable").length;

    // Streak: consecutive days with completed lessons (going back from today)
    const completedDates = new Set(
      ((lessons ?? []) as Array<{ status: string; lesson_date: string | null }>)
        .filter((l) => l.status === "completed" && l.lesson_date)
        .map((l) => l.lesson_date as string),
    );
    let streak = 0;
    const d = new Date();
    while (completedDates.has(d.toISOString().slice(0, 10))) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    }


    return {
      profile,
      active_subjects: subjects?.length ?? 0,
      avg_mastery: avg(prog.map((p) => p.mastery_score ?? 0)),
      total_topics: prog.length,
      mastered_topics: mastered,
      learning_topics: learning,
      weak_topics: weak,
      lessons_count: (lessons ?? []).filter((l) => l.status === "completed").length,
      diagnostics_count: (diags ?? []).filter((d2) => d2.status === "completed").length,
      streak_days: streak,
    };
  });

/** Per-subject aggregated progress. */
export const getSubjectAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return [];

    const { data: ss } = await sb
      .from("student_subjects")
      .select("subject_id, program_id, subjects(id,title,slug), subject_programs(id,title)")
      .eq("student_profile_id", profile.id);

    const { data: prog } = await sb
      .from("student_topic_progress")
      .select("subject_id, topic_id, mastery_score, status, last_activity_at, topics(title)")
      .eq("student_profile_id", profile.id);

    return (ss ?? []).map((row: any) => {
      const topics = (prog ?? []).filter((p: any) => p.subject_id === row.subject_id);
      const weak = topics
        .filter((t: any) => t.status === "weak" || t.status === "needs_review")
        .map((t: any) => t.topics?.title)
        .filter(Boolean);
      const inProgress = topics
        .filter((t: any) => t.status === "learning" || t.status === "stable")
        .map((t: any) => t.topics?.title)
        .filter(Boolean);
      const lastActivity = topics
        .map((t: any) => t.last_activity_at)
        .filter(Boolean)
        .sort()
        .at(-1) as string | undefined;
      return {
        subject_id: row.subject_id,
        subject_title: row.subjects?.title ?? "—",
        program_title: row.subject_programs?.title ?? null,
        avg_mastery: avg(topics.map((t: any) => t.mastery_score ?? 0)),
        topics_total: topics.length,
        weak_topics: weak.slice(0, 5),
        in_progress_topics: inProgress.slice(0, 5),
        last_activity_at: lastActivity ?? null,
      };
    });
  });

/** Weak topics sorted by priority. */
export const getWeakTopics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(50).default(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return [];

    const { data: prog } = await sb
      .from("student_topic_progress")
      .select(
        "topic_id, subject_id, mastery_score, status, mistakes_count, last_activity_at, topics(title), subjects(title)",
      )
      .eq("student_profile_id", profile.id)
      .in("status", ["weak", "needs_review"])
      .order("mastery_score", { ascending: true })
      .limit(data.limit);

    return (prog ?? []).map((r: any) => ({
      topic_id: r.topic_id,
      subject_id: r.subject_id,
      topic_title: r.topics?.title ?? "—",
      subject_title: r.subjects?.title ?? "—",
      mastery_score: r.mastery_score ?? 0,
      status: r.status,
      mistakes_count: r.mistakes_count ?? 0,
      last_activity_at: r.last_activity_at ?? null,
    }));
  });

/** Mistake analysis: grouped by type and by topic. */
export const getMistakeAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: profileRow } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profileRow) {
      return { total: 0, by_type: [], by_topic: [] };
    }
    const { data: mistakes } = await sb
      .from("student_mistakes")
      .select("mistake_type, topic_id, subject_id, topics(title), subjects(title)")
      .eq("student_profile_id", profileRow.id);


    const byType = new Map<string, number>();
    const byTopic = new Map<string, { topic_id: string; topic_title: string; subject_title: string; count: number; types: Set<string> }>();

    for (const m of mistakes ?? []) {
      const type = (m as any).mistake_type ?? "other";
      byType.set(type, (byType.get(type) ?? 0) + 1);
      const tid = (m as any).topic_id;
      if (tid) {
        const cur = byTopic.get(tid) ?? {
          topic_id: tid,
          topic_title: (m as any).topics?.title ?? "—",
          subject_title: (m as any).subjects?.title ?? "—",
          count: 0,
          types: new Set<string>(),
        };
        cur.count += 1;
        cur.types.add(type);
        byTopic.set(tid, cur);
      }
    }

    return {
      total: (mistakes ?? []).length,
      by_type: [...byType.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      by_topic: [...byTopic.values()]
        .map((v) => ({ ...v, types: [...v.types] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  });

/** Progress history & dynamics over a window. */
export const getProgressDynamics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile)
      return { history: [], total_delta: 0, lessons_done: 0, tasks_done: 0, diagnostics_done: 0 };

    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const [{ data: history }, { data: lessons }, { data: attempts }, { data: diags }] =
      await Promise.all([
        sb
          .from("student_progress_history")
          .select("created_at, old_score, new_score, delta, source, topic_id, topics(title)")
          .eq("student_profile_id", profile.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(100),
        sb
          .from("lessons")
          .select("id, status, lesson_date")
          .eq("student_profile_id", profile.id)
          .gte("lesson_date", since.slice(0, 10)),
        sb
          .from("task_attempts")
          .select("id, is_correct, submitted_at")
          .eq("user_id", context.userId)
          .gte("submitted_at", since),
        sb
          .from("diagnostic_sessions")
          .select("id, status, completed_at")
          .eq("student_profile_id", profile.id)
          .gte("completed_at", since),
      ]);

    const totalDelta = (history ?? []).reduce((s, h: any) => s + (h.delta ?? 0), 0);
    return {
      history: history ?? [],
      total_delta: totalDelta,
      lessons_done: ((lessons ?? []) as Array<{ status: string }>).filter((l) => l.status === "completed").length,
      tasks_done: (attempts ?? []).length,
      diagnostics_done: (diags ?? []).filter((d2) => d2.status === "completed").length,
    };

  });

/** Topics that were mastered but haven't been touched in N days. */
export const getTopicsToReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return [];

    const { data: prog } = await sb
      .from("student_topic_progress")
      .select("topic_id, subject_id, mastery_score, last_activity_at, topics(title), subjects(title)")
      .eq("student_profile_id", profile.id)
      .eq("status", "mastered");

    const out = (prog ?? [])
      .map((p: any) => {
        const since = daysSince(p.last_activity_at);
        return {
          topic_id: p.topic_id,
          topic_title: p.topics?.title ?? "—",
          subject_title: p.subjects?.title ?? "—",
          last_activity_at: p.last_activity_at,
          days_since: since,
          risk:
            since == null
              ? "low"
              : since > REVIEW_AFTER_DAYS * 2
                ? "high"
                : since > REVIEW_AFTER_DAYS
                  ? "medium"
                  : "low",
        };
      })
      .filter((t) => t.days_since != null && t.days_since > REVIEW_AFTER_DAYS)
      .sort((a, b) => (b.days_since ?? 0) - (a.days_since ?? 0));
    return out;
  });

/** Rule-based recommendations (no AI). */
export const getRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return [];

    const { data: prog } = await sb
      .from("student_topic_progress")
      .select(
        "topic_id, subject_id, mastery_score, mistakes_count, last_activity_at, status, topics(title), subjects(title)",
      )
      .eq("student_profile_id", profile.id);

    const recs: Array<{
      kind: string;
      topic_id: string;
      topic_title: string;
      subject_title: string;
      reason: string;
      priority: number;
    }> = [];

    for (const p of (prog ?? []) as any[]) {
      const days = daysSince(p.last_activity_at);
      if ((p.mastery_score ?? 0) < 50) {
        recs.push({
          kind: "review_topic",
          topic_id: p.topic_id,
          topic_title: p.topics?.title ?? "—",
          subject_title: p.subjects?.title ?? "—",
          reason: `Низкий уровень освоения (${p.mastery_score ?? 0}%). Стоит повторить теорию.`,
          priority: 100 - (p.mastery_score ?? 0),
        });
      }
      if ((p.mistakes_count ?? 0) >= 5) {
        recs.push({
          kind: "extra_practice",
          topic_id: p.topic_id,
          topic_title: p.topics?.title ?? "—",
          subject_title: p.subjects?.title ?? "—",
          reason: `Накоплено ${p.mistakes_count} ошибок — нужны дополнительные упражнения.`,
          priority: 50 + (p.mistakes_count ?? 0),
        });
      }
      if (days != null && days > 21 && p.status !== "mastered") {
        recs.push({
          kind: "return_to_topic",
          topic_id: p.topic_id,
          topic_title: p.topics?.title ?? "—",
          subject_title: p.subjects?.title ?? "—",
          reason: `Нет активности ${days} дней — пора вернуться к теме.`,
          priority: 40 + Math.min(days, 60),
        });
      }
    }

    return recs.sort((a, b) => b.priority - a.priority).slice(0, 10);
  });

/** Simple rule-based goal forecast. */
export const getGoalForecast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id, target_score, goal")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return null;

    const target = profile.target_score ?? 70;

    const { data: prog } = await sb
      .from("student_topic_progress")
      .select("mastery_score, last_activity_at")
      .eq("student_profile_id", profile.id);

    const current = avg((prog ?? []).map((p) => p.mastery_score ?? 0));
    const activeCount = (prog ?? []).filter((p) => {
      const d = daysSince(p.last_activity_at);
      return d != null && d <= 14;
    }).length;

    const gap = target - current;
    let likelihood: "high" | "medium" | "low";
    if (gap <= 5 || (current >= target - 15 && activeCount >= 5)) likelihood = "high";
    else if (gap <= 20 && activeCount >= 3) likelihood = "medium";
    else likelihood = "low";

    return {
      target_score: target,
      current_score: current,
      gap,
      active_topics_last_14d: activeCount,
      likelihood,
      goal: profile.goal,
    };
  });

/** Learning path & calendar regularity stats. */
export const getActivityStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: profile } = await sb
      .from("student_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile)
      return { path: null, scheduled: 0, completed: 0, skipped: 0, regularity: 0 };

    const [{ data: path }, { data: items }, { data: lessons }] = await Promise.all([
      sb
        .from("learning_paths")
        .select("id, title, status, created_at")
        .eq("student_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("learning_path_items")
        .select("id, status")
        .eq("student_profile_id", profile.id),
      sb
        .from("lessons")
        .select("id, status, scheduled_at")
        .eq("student_profile_id", profile.id),
    ]);

    const ls = lessons ?? [];
    const scheduled = ls.length;
    const completed = ls.filter((l) => l.status === "completed").length;
    const skipped = ls.filter((l) => l.status === "skipped").length;
    const regularity = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;

    const its = items ?? [];
    return {
      path: path ?? null,
      path_total: its.length,
      path_done: its.filter((i) => i.status === "completed").length,
      path_remaining: its.filter((i) => i.status !== "completed").length,
      path_progress: its.length ? Math.round((its.filter((i) => i.status === "completed").length / its.length) * 100) : 0,
      scheduled,
      completed,
      skipped,
      regularity,
    };
  });
