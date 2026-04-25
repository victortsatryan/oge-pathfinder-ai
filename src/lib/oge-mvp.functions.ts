import { createServerFn } from "@tanstack/react-start";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSupabaseUserFromRequest } from "@/integrations/supabase/auth-middleware";
import { loadDefaultMvpState } from "@/lib/oge-mvp-data";

export const loadMvpState = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const user = await getSupabaseUserFromRequest().catch(() => null);

    const [resourcesResponse, attemptsResponse, sourcesResponse, overridesResponse] = await Promise.all([
      supabaseAdmin
        .from("content_resources")
        .select("id, title, source_url, difficulty, tasks, content_markdown, video_url, solution_text, subjects(name), topics(title)")
        .eq("is_published", true)
        .limit(200),
      supabaseAdmin
        .from("task_attempts")
        .select("lesson_id, is_correct, score, submitted_at, subjects(name), topics(title)")
        .order("submitted_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("learning_sources")
        .select("id, provider, title, url, source_kind, sort_order, subjects(name)")
        .eq("is_published", true)
        .order("sort_order", { ascending: true })
        .limit(200),
      user
        ? supabaseAdmin
            .from("lesson_overrides")
            .select("lesson_key, title, topic, lesson_date, slot_number, difficulty, status, teacher_note, theory_markdown, tasks")
            .eq("user_id", user.id)
            .limit(500)
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    if (resourcesResponse.error) console.error("Failed to load content resources", resourcesResponse.error);
    if (attemptsResponse.error) console.error("Failed to load task attempts", attemptsResponse.error);
    if (sourcesResponse.error) console.error("Failed to load learning sources", sourcesResponse.error);
    if ("error" in overridesResponse && overridesResponse.error) {
      console.error("Failed to load lesson overrides", overridesResponse.error);
    }

    return loadDefaultMvpState({
      resources:
        resourcesResponse.data?.map((resource) => ({
          id: resource.id,
          title: resource.title,
          sourceUrl: resource.source_url,
          difficulty: resource.difficulty,
          subjectName: resource.subjects?.name ?? "",
          topicTitle: resource.topics?.title ?? null,
          tasks: Array.isArray(resource.tasks) ? resource.tasks.map((task) => String(task)) : [],
          contentMarkdown: resource.content_markdown,
          videoUrl: resource.video_url,
          solutionText: resource.solution_text,
        })) ?? [],
      attempts:
        attemptsResponse.data?.map((attempt) => ({
          lessonId: attempt.lesson_id,
          subjectName: attempt.subjects?.name ?? "",
          topicTitle: attempt.topics?.title ?? null,
          isCorrect: attempt.is_correct,
          score: attempt.score === null ? null : Number(attempt.score),
          submittedAt: attempt.submitted_at,
        })) ?? [],
      learningSources:
        sourcesResponse.data?.map((source) => ({
          id: source.id,
          subjectName: source.subjects?.name ?? "",
          provider: source.provider,
          title: source.title,
          url: source.url,
          sourceKind: source.source_kind as "theory" | "practice" | "mixed",
        })) ?? [],
      lessonOverrides:
        (overridesResponse.data ?? []).map((row) => ({
          lessonKey: row.lesson_key,
          title: row.title,
          topic: row.topic,
          lessonDate: row.lesson_date,
          slotNumber: row.slot_number,
          difficulty: row.difficulty,
          status: row.status,
          teacherNote: row.teacher_note,
          theoryMarkdown: row.theory_markdown,
          tasks: Array.isArray(row.tasks)
            ? (row.tasks as Array<Record<string, unknown>>).map((t, i) => ({
                id: String(t.id ?? `task-${i + 1}`),
                prompt: String(t.prompt ?? ""),
                expectedAnswer: String(t.expectedAnswer ?? ""),
                explanation: String(t.explanation ?? ""),
                sourceLabel: String(t.sourceLabel ?? ""),
                bankTaskId: t.bankTaskId ? String(t.bankTaskId) : null,
              }))
            : [],
        })),
    });
  } catch (error) {
    console.error("Failed to load MVP state", error);
    return loadDefaultMvpState();
  }
});
