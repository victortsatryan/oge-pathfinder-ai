import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listSchema = z.object({
  subject_id: z.string().uuid().optional(),
  topic_id: z.string().uuid().optional(),
  material_type: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const listMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("materials")
      .select("id, title, description, material_type, source_name, source_url, video_url, difficulty, estimated_time_minutes, topic_id, subject_id, subjects(name), topics(title)")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.subject_id) q = q.eq("subject_id", data.subject_id);
    if (data.topic_id) q = q.eq("topic_id", data.topic_id);
    if (data.material_type) q = q.eq("material_type", data.material_type);
    if (data.difficulty) q = q.eq("difficulty", data.difficulty);
    if (data.search?.trim()) q = q.ilike("title", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { materials: rows ?? [] };
  });

export const getTopicOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ topic_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [topicRes, matsRes, tasksRes, testsRes] = await Promise.all([
      sb.from("topics").select("id, title, description, subject_id, subjects(name)").eq("id", data.topic_id).single(),
      sb.from("materials").select("id, title, description, material_type, source_name, source_url, video_url, difficulty, estimated_time_minutes")
        .eq("topic_id", data.topic_id).eq("status", "published").order("difficulty"),
      sb.from("tasks").select("id, title, prompt, task_type, difficulty, source_name")
        .eq("topic_id", data.topic_id).eq("is_published", true).limit(20),
      sb.from("tests").select("id, title, description, test_type, duration_minutes, difficulty")
        .eq("topic_id", data.topic_id).eq("is_public", true),
    ]);
    if (topicRes.error) throw new Error(topicRes.error.message);
    return {
      topic: topicRes.data,
      materials: matsRes.data ?? [],
      tasks: tasksRes.data ?? [],
      tests: testsRes.data ?? [],
    };
  });

const recommendSchema = z.object({
  topic_id: z.string().uuid(),
  mastery_score: z.number().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(30).default(10),
});

export const getRecommendedMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recommendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    let mastery = data.mastery_score;
    if (mastery == null) {
      const { data: prof } = await sb
        .from("student_profiles")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (prof?.id) {
        const { data: prog } = await sb
          .from("student_topic_progress")
          .select("mastery_score")
          .eq("student_profile_id", prof.id)
          .eq("topic_id", data.topic_id)
          .maybeSingle();
        mastery = prog?.mastery_score ?? 0;
      } else {
        mastery = 0;
      }
    }

    // Strategy by mastery level
    let preferredTypes: string[];
    let maxDifficulty: number;
    if (mastery < 30) {
      preferredTypes = ["theory", "video", "textbook_paragraph", "scheme"];
      maxDifficulty = 2;
    } else if (mastery < 70) {
      preferredTypes = ["theory", "exercise_set", "article"];
      maxDifficulty = 3;
    } else {
      preferredTypes = ["exercise_set", "test", "task_solution"];
      maxDifficulty = 5;
    }

    const { data: mats, error } = await sb
      .from("materials")
      .select("id, title, description, material_type, source_name, source_url, video_url, difficulty, estimated_time_minutes")
      .eq("topic_id", data.topic_id)
      .eq("status", "published")
      .in("material_type", preferredTypes)
      .lte("difficulty", maxDifficulty)
      .order("difficulty")
      .limit(data.limit);
    if (error) throw new Error(error.message);

    return { mastery, strategy: { preferredTypes, maxDifficulty }, materials: mats ?? [] };
  });

export const listSubjectsForFilter = createServerFn({ method: "GET" })
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
