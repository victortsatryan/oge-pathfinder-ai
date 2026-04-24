import { createServerFn } from "@tanstack/react-start";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadDefaultMvpState } from "@/lib/oge-mvp-data";

export const loadMvpState = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [resourcesResponse, attemptsResponse, sourcesResponse] = await Promise.all([
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
    ]);

    if (resourcesResponse.error) {
      console.error("Failed to load content resources", resourcesResponse.error);
    }
    if (attemptsResponse.error) {
      console.error("Failed to load task attempts", attemptsResponse.error);
    }
    if (sourcesResponse.error) {
      console.error("Failed to load learning sources", sourcesResponse.error);
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
    });
  } catch (error) {
    console.error("Failed to load MVP state", error);
    return loadDefaultMvpState();
  }
});
