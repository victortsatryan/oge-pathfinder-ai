import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function masteryToStatus(score: number): string {
  if (score === 0) return "not_started";
  if (score < 50) return "weak";
  if (score < 70) return "learning";
  if (score < 85) return "stable";
  return "mastered";
}

export const buildLessonFromPathItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path_item_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const { data: item, error: iErr } = await sb
      .from("learning_path_items")
      .select("*")
      .eq("id", data.path_item_id)
      .single();
    if (iErr) throw new Error(iErr.message);

    // Check if a lesson already exists for this item
    const existing = await sb
      .from("lessons")
      .select("id")
      .eq("learning_path_item_id", data.path_item_id)
      .maybeSingle();
    let lessonId = existing.data?.id as string | undefined;

    if (!lessonId) {
      const ins = await sb
        .from("lessons")
        .insert({
          user_id: context.userId,
          student_profile_id: item.student_profile_id,
          learning_path_id: item.learning_path_id,
          learning_path_item_id: item.id,
          subject_id: item.subject_id,
          topic_id: item.topic_id,
          program_id: item.program_id,
          learning_objective_id: item.learning_objective_id,
          lesson_date: item.planned_date ?? new Date().toISOString().slice(0, 10),
          title: item.title,
          goal: `Закрыть слабую тему: ${item.title}`,
          description: item.description,
          duration_minutes: item.duration_minutes,
          status: "planned" as const,
        })
        .select("id")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      lessonId = ins.data.id;
    }

    // Get mastery for this topic
    let mastery = 0;
    if (item.topic_id) {
      const { data: prog } = await sb
        .from("student_topic_progress")
        .select("mastery_score")
        .eq("student_profile_id", item.student_profile_id)
        .eq("topic_id", item.topic_id)
        .maybeSingle();
      mastery = prog?.mastery_score ?? 0;
    }

    // Pick materials
    const preferredTypes =
      mastery < 30 ? ["theory", "video", "textbook_paragraph", "scheme"]
      : mastery < 70 ? ["theory", "exercise_set", "article"]
      : ["exercise_set", "test", "task_solution"];
    const maxDifficulty = mastery < 30 ? 2 : mastery < 70 ? 3 : 5;

    const { data: mats } = await sb
      .from("materials")
      .select("id")
      .eq("topic_id", item.topic_id)
      .eq("is_public", true)
      .in("material_type", preferredTypes)
      .lte("difficulty", maxDifficulty)
      .order("difficulty")
      .limit(4);

    if ((mats ?? []).length > 0) {
      const rows = mats!.map((m: any, i: number) => ({
        lesson_id: lessonId!,
        material_id: m.id,
        order_index: i,
        is_required: i === 0,
        user_id: context.userId,
      }));
      await sb.from("lesson_materials").upsert(rows, { onConflict: "lesson_id,material_id" });
    }

    // Pick tasks
    const taskCount = mastery < 30 ? 4 : mastery < 70 ? 6 : 4;
    const { data: tasks } = await sb
      .from("tasks")
      .select("id")
      .eq("topic_id", item.topic_id)
      .eq("is_published", true)
      .limit(taskCount);

    if ((tasks ?? []).length > 0) {
      const rows = tasks!.map((t: any, i: number) => ({
        lesson_id: lessonId!,
        task_id: t.id,
        order_index: i,
        points: 1,
        is_required: true,
        user_id: context.userId,
      }));
      await sb.from("lesson_tasks").upsert(rows, { onConflict: "lesson_id,task_id" });
    }

    return { lesson_id: lessonId, materials: mats?.length ?? 0, tasks: tasks?.length ?? 0 };
  });

export const getLessonDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lesson_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [lessonRes, matsRes, tasksRes, resultRes, attemptsRes] = await Promise.all([
      sb.from("lessons")
        .select("*, subjects(name), topics(title, description)")
        .eq("id", data.lesson_id)
        .single(),
      sb.from("lesson_materials")
        .select("id, order_index, is_required, materials(id, title, description, material_type, source_name, source_url, video_url, difficulty, estimated_time_minutes)")
        .eq("lesson_id", data.lesson_id)
        .order("order_index"),
      sb.from("lesson_tasks")
        .select("id, order_index, points, is_required, tasks(id, title, prompt, task_type, difficulty, correct_answer, explanation, options)")
        .eq("lesson_id", data.lesson_id)
        .order("order_index"),
      sb.from("lesson_results").select("*").eq("lesson_id", data.lesson_id).maybeSingle(),
      sb.from("task_attempts").select("task_id, is_correct, student_answer, mistake_type")
        .eq("lesson_id", data.lesson_id),
    ]);
    if (lessonRes.error) throw new Error(lessonRes.error.message);

    // Mastery context
    let mastery = 0;
    if (lessonRes.data?.topic_id && lessonRes.data?.student_profile_id) {
      const { data: prog } = await sb
        .from("student_topic_progress")
        .select("mastery_score, status, mistakes_count")
        .eq("student_profile_id", lessonRes.data.student_profile_id)
        .eq("topic_id", lessonRes.data.topic_id)
        .maybeSingle();
      mastery = prog?.mastery_score ?? 0;
      (lessonRes.data as any).__progress = prog;
    }

    return {
      lesson: lessonRes.data,
      materials: matsRes.data ?? [],
      tasks: tasksRes.data ?? [],
      result: resultRes.data,
      attempts: attemptsRes.data ?? [],
      mastery,
    };
  });

const submitSchema = z.object({
  lesson_id: z.string().uuid(),
  task_id: z.string().uuid(),
  student_answer: z.string().max(2000),
});

export const submitLessonTaskAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [lessonRes, taskRes] = await Promise.all([
      sb.from("lessons").select("student_profile_id, subject_id, topic_id, user_id").eq("id", data.lesson_id).single(),
      sb.from("tasks").select("correct_answer, answer_type, subject_id, topic_id, learning_objective_id").eq("id", data.task_id).single(),
    ]);
    if (lessonRes.error) throw new Error(lessonRes.error.message);
    if (taskRes.error) throw new Error(taskRes.error.message);
    if (lessonRes.data.user_id !== context.userId) throw new Error("Forbidden");

    const correct = String(taskRes.data.correct_answer ?? "").toLowerCase().replace(/^"|"$/g, "").trim();
    const given = data.student_answer.toLowerCase().trim();
    const isCorrect = correct.length > 0 && correct === given;

    // Upsert attempt by (user, lesson, task)
    const { data: existing } = await sb
      .from("task_attempts")
      .select("id")
      .eq("user_id", context.userId)
      .eq("lesson_id", data.lesson_id)
      .eq("task_id", data.task_id)
      .maybeSingle();

    const row = {
      user_id: context.userId,
      student_profile_id: lessonRes.data.student_profile_id,
      lesson_id: data.lesson_id,
      task_id: data.task_id,
      task_key: data.task_id,
      subject_id: taskRes.data.subject_id,
      topic_id: taskRes.data.topic_id,
      learning_objective_id: taskRes.data.learning_objective_id,
      student_answer: data.student_answer as any,
      correct_answer: taskRes.data.correct_answer,
      is_correct: isCorrect,
      points_awarded: isCorrect ? 1 : 0,
      max_points: 1,
      checked_by: "auto",
      mistake_type: isCorrect ? null : "wrong_answer",
    };

    if (existing?.id) {
      const upd = await sb.from("task_attempts").update(row).eq("id", existing.id);
      if (upd.error) throw new Error(upd.error.message);
    } else {
      const ins = await sb.from("task_attempts").insert(row);
      if (ins.error) throw new Error(ins.error.message);
    }

    return { is_correct: isCorrect };
  });

export const completeLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ lesson_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;

    const { data: lesson, error: lErr } = await sb
      .from("lessons")
      .select("id, user_id, student_profile_id, subject_id, topic_id, learning_path_item_id")
      .eq("id", data.lesson_id)
      .single();
    if (lErr) throw new Error(lErr.message);
    if (lesson.user_id !== context.userId) throw new Error("Forbidden");

    const { data: attempts } = await sb
      .from("task_attempts")
      .select("is_correct, points_awarded, max_points, task_id, mistake_type")
      .eq("lesson_id", data.lesson_id);

    const completed = attempts?.length ?? 0;
    const correct = attempts?.filter((a: any) => a.is_correct).length ?? 0;
    const wrong = completed - correct;
    const score = (attempts ?? []).reduce((s: number, a: any) => s + (a.points_awarded ?? 0), 0);
    const max = (attempts ?? []).reduce((s: number, a: any) => s + (a.max_points ?? 1), 0);
    const percent = max > 0 ? Math.round((score / max) * 100) : 0;

    const summary =
      percent < 50
        ? "Результат низкий. Рекомендуется повторить теорию и выполнить дополнительные задания по этой теме."
        : percent < 80
          ? "Хороший результат. Закрепите тему ещё одной практикой."
          : "Отличный результат. Можно переходить к следующей теме.";

    // Upsert lesson_result
    const { data: existing } = await sb
      .from("lesson_results")
      .select("id")
      .eq("lesson_id", data.lesson_id)
      .maybeSingle();
    const row = {
      lesson_id: data.lesson_id,
      student_profile_id: lesson.student_profile_id,
      user_id: context.userId,
      score,
      max_score: max,
      score_percent: percent,
      completed_tasks: completed,
      correct_tasks: correct,
      wrong_tasks: wrong,
      summary,
    };
    if (existing?.id) {
      await sb.from("lesson_results").update(row).eq("id", existing.id);
    } else {
      await sb.from("lesson_results").insert(row);
    }

    // Update progress for the topic
    if (lesson.topic_id && lesson.student_profile_id) {
      const { data: prog } = await sb
        .from("student_topic_progress")
        .select("id, diagnostic_score, practice_score, attempts_count, mistakes_count")
        .eq("student_profile_id", lesson.student_profile_id)
        .eq("topic_id", lesson.topic_id)
        .maybeSingle();

      const newPractice = percent;
      const diag = prog?.diagnostic_score ?? null;
      const newMastery = diag != null ? Math.round(diag * 0.5 + newPractice * 0.5) : newPractice;

      await sb.from("student_topic_progress").upsert(
        {
          student_profile_id: lesson.student_profile_id,
          subject_id: lesson.subject_id,
          topic_id: lesson.topic_id,
          practice_score: newPractice,
          mastery_score: newMastery,
          status: masteryToStatus(newMastery),
          attempts_count: (prog?.attempts_count ?? 0) + completed,
          mistakes_count: (prog?.mistakes_count ?? 0) + wrong,
          last_activity_at: new Date().toISOString(),
        },
        { onConflict: "student_profile_id,topic_id" },
      );

      // Save mistakes
      const wrongAttempts = (attempts ?? []).filter((a: any) => a.is_correct === false);
      if (wrongAttempts.length > 0) {
        const mistakeRows = wrongAttempts.map((a: any) => ({
          student_profile_id: lesson.student_profile_id,
          user_id: context.userId,
          subject_id: lesson.subject_id,
          topic_id: lesson.topic_id,
          task_id: a.task_id,
          mistake_type: a.mistake_type ?? "wrong_answer",
        }));
        await sb.from("student_mistakes").insert(mistakeRows);
      }
    }

    // Mark lesson and path item completed
    await sb.from("lessons").update({ status: "completed" as const }).eq("id", data.lesson_id);
    if (lesson.learning_path_item_id) {
      await sb.from("learning_path_items").update({ status: "completed" }).eq("id", lesson.learning_path_item_id);
    }
    await sb.from("calendar_events").update({ status: "completed" }).eq("lesson_id", data.lesson_id);

    return { score, max, percent, summary };
  });
