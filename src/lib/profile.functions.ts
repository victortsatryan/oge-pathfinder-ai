import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const subjectsSchema = z.array(z.string().trim().min(1).max(80)).max(20);

const profileInputSchema = z.object({
  first_name: z.string().trim().max(80).nullable().optional(),
  last_name: z.string().trim().max(80).nullable().optional(),
  display_name: z.string().trim().max(120).nullable().optional(),
  grade: z.number().int().min(1).max(11).nullable().optional(),
  program: z.string().trim().max(200).nullable().optional(),
  subjects: subjectsSchema.optional(),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "user_id, display_name, first_name, last_name, grade, program, subjects, avatar_url, target_grade, target_score, exam_year",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // Lazily create row if trigger missed (e.g. legacy users)
      const { data: created, error: createError } = await supabase
        .from("profiles")
        .insert({ user_id: userId })
        .select(
          "user_id, display_name, first_name, last_name, grade, program, subjects, avatar_url, target_grade, target_score, exam_year",
        )
        .single();
      if (createError) throw createError;
      return created;
    }

    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileInputSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) payload[key] = value;
    }

    const { data: updated, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("user_id", userId)
      .select(
        "user_id, display_name, first_name, last_name, grade, program, subjects, avatar_url, target_grade, target_score, exam_year",
      )
      .single();

    if (error) throw error;
    return updated;
  });

export const getMyProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const [{ data: subjects }, { data: attempts }, { data: lessons }] = await Promise.all([
      supabaseAdmin.from("subjects").select("id, name, slug, color_token").order("sort_order"),
      supabaseAdmin
        .from("task_attempts")
        .select("subject_id, is_correct, score, submitted_at")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false })
        .limit(2000),
      supabaseAdmin
        .from("lessons")
        .select("subject_id, status")
        .eq("user_id", userId)
        .limit(2000),
    ]);

    const summary = (subjects ?? []).map((s) => {
      const subjectAttempts = (attempts ?? []).filter((a) => a.subject_id === s.id);
      const correct = subjectAttempts.filter((a) => a.is_correct === true).length;
      const total = subjectAttempts.length;
      const subjectLessons = (lessons ?? []).filter((l) => l.subject_id === s.id);
      const completedLessons = subjectLessons.filter((l) => l.status === "completed" || l.status === "done").length;
      const totalLessons = subjectLessons.length;

      return {
        subjectId: s.id,
        name: s.name,
        slug: s.slug,
        colorToken: s.color_token,
        attempts: total,
        correct,
        accuracyPercent: total > 0 ? Math.round((correct / total) * 100) : 0,
        completedLessons,
        totalLessons,
        progressPercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      };
    });

    return {
      totalAttempts: (attempts ?? []).length,
      totalCorrect: (attempts ?? []).filter((a) => a.is_correct === true).length,
      bySubject: summary,
    };
  });
