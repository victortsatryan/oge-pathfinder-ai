import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------- Helpers ----------------

async function ensureProfile(sb: any, userId: string) {
  let { data: profile } = await sb
    .from("student_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) {
    const r = await sb
      .from("student_profiles")
      .insert({ user_id: userId })
      .select("id")
      .single();
    if (r.error) throw r.error;
    profile = r.data;
  }
  return profile as { id: string };
}

function normalize(v: unknown) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim().toLowerCase();
  return JSON.stringify(v).trim().toLowerCase();
}

function checkAnswer(task: any, studentAnswer: string | null): boolean | null {
  if (studentAnswer == null || studentAnswer === "") return null;
  const correct = task?.correct_answer;
  if (correct == null) return null;
  if (Array.isArray(correct))
    return correct.map(normalize).includes(normalize(studentAnswer));
  return normalize(correct) === normalize(studentAnswer);
}

function mistakeTypeFor(subjectSlug: string | undefined): string {
  switch (subjectSlug) {
    case "mathematics":
      return "calculation_error";
    case "russian":
      return "grammar_error";
    case "english":
      return "vocabulary_gap";
    case "biology":
      return "concept_gap";
    default:
      return "other";
  }
}

function masteryToStatus(score: number): string {
  if (score === 0) return "not_started";
  if (score <= 49) return "weak";
  if (score <= 69) return "learning";
  if (score <= 84) return "stable";
  return "mastered";
}

// ---------------- Catalog ----------------

export const listAvailableDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject_id: z.string().uuid().optional(),
        diagnostic_type: z.string().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    let q = sb
      .from("diagnostic_tests")
      .select(
        "id, title, description, diagnostic_type, duration_minutes, subject:subjects(id, slug, name, exam_type), program:subject_programs(id, title, exam_type, grade)",
      )
      .eq("is_public", true)
      .order("created_at", { ascending: false });
    if (data.subject_id) q = q.eq("subject_id", data.subject_id);
    if (data.diagnostic_type) q = q.eq("diagnostic_type", data.diagnostic_type);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

// ---------------- Start / Resume ----------------

export const startDiagnosticSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ diagnostic_test_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const profile = await ensureProfile(sb, context.userId);

    const { data: test, error: tErr } = await sb
      .from("diagnostic_tests")
      .select("id, subject_id, program_id, diagnostic_type")
      .eq("id", data.diagnostic_test_id)
      .single();
    if (tErr) throw tErr;

    // student_subject (auto if missing)
    let studentSubjectId: string | null = null;
    const { data: ss } = await sb
      .from("student_subjects")
      .select("id")
      .eq("student_profile_id", profile.id)
      .eq("subject_id", test.subject_id)
      .maybeSingle();
    if (ss) studentSubjectId = ss.id;

    // Reuse open in-progress session if any
    const { data: open } = await sb
      .from("diagnostic_sessions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("diagnostic_test_id", test.id)
      .eq("status", "in_progress")
      .maybeSingle();

    let sessionId = open?.id as string | undefined;
    if (!sessionId) {
      const { data: created, error: cErr } = await sb
        .from("diagnostic_sessions")
        .insert({
          user_id: context.userId,
          student_profile_id: profile.id,
          student_subject_id: studentSubjectId,
          diagnostic_test_id: test.id,
          subject_id: test.subject_id,
          program_id: test.program_id,
          diagnostic_type: test.diagnostic_type,
          status: "in_progress",
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      sessionId = created.id;
    }

    return { session_id: sessionId };
  });

export const getDiagnosticSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ session_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const { data: session, error: sErr } = await sb
      .from("diagnostic_sessions")
      .select(
        "id, status, diagnostic_type, score, max_score, score_percent, summary, ai_summary, completed_at, subject:subjects(id, slug, name), diagnostic_test:diagnostic_tests(id, title, description, duration_minutes)",
      )
      .eq("id", data.session_id)
      .eq("user_id", context.userId)
      .single();
    if (sErr) throw sErr;

    const { data: items } = await sb
      .from("diagnostic_test_tasks")
      .select(
        "order_index, points, task:tasks(id, prompt, answer_type, options, topic_id, topic:topics(id, title))",
      )
      .eq("diagnostic_test_id", (session as any).diagnostic_test?.id)
      .order("order_index");

    const { data: answers } = await sb
      .from("diagnostic_answers")
      .select("task_id, student_answer, is_correct, points_awarded, max_points, mistake_type")
      .eq("diagnostic_session_id", data.session_id);

    return {
      session,
      tasks: items ?? [],
      answers: answers ?? [],
    };
  });

// ---------------- Complete ----------------

const completeSchema = z.object({
  session_id: z.string().uuid(),
  answers: z
    .array(
      z.object({
        task_id: z.string().uuid(),
        student_answer: z.string().nullable(),
      }),
    )
    .min(1),
});

export const completeDiagnosticSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => completeSchema.parse(input))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;

    const { data: session, error: sErr } = await sb
      .from("diagnostic_sessions")
      .select(
        "id, user_id, student_profile_id, subject_id, program_id, diagnostic_test_id, status, subject:subjects(slug)",
      )
      .eq("id", data.session_id)
      .eq("user_id", context.userId)
      .single();
    if (sErr) throw sErr;
    if (session.status === "completed") {
      // Idempotent: just return aggregates
      const { data: topics } = await sb
        .from("diagnostic_topic_results")
        .select("*, topic:topics(title)")
        .eq("diagnostic_session_id", data.session_id);
      return { session, topicResults: topics ?? [] };
    }

    const profileId = session.student_profile_id as string | null;
    if (!profileId) throw new Error("Missing student profile on session");

    const subjectSlug = session.subject?.slug as string | undefined;
    const baseMistake = mistakeTypeFor(subjectSlug);

    // Load test tasks (for points) and task details
    const { data: testTasks } = await sb
      .from("diagnostic_test_tasks")
      .select("task_id, points, task:tasks(id, topic_id, correct_answer, answer_type)")
      .eq("diagnostic_test_id", session.diagnostic_test_id);

    const tasksMap = new Map<string, any>();
    for (const tt of (testTasks ?? []) as any[]) {
      tasksMap.set(tt.task_id, { ...tt.task, max_points: tt.points });
    }

    // Validate: at least one non-empty answer
    const nonEmpty = data.answers.filter((a) => a.student_answer && a.student_answer.trim() !== "");
    if (nonEmpty.length === 0) {
      throw new Error("Нельзя завершить диагностику без ответов");
    }

    // Build answer rows + per-task correctness
    type AnswerRow = {
      diagnostic_session_id: string;
      task_id: string;
      student_answer: string | null;
      is_correct: boolean | null;
      points_awarded: number;
      max_points: number;
      checked_by: string;
      mistake_type: string | null;
      mistake_description: string | null;
    };
    const answerRows: AnswerRow[] = [];
    const perTopic = new Map<
      string,
      { score: number; max: number; correct: number; wrong: number }
    >();
    const mistakeRows: any[] = [];

    let totalScore = 0;
    let totalMax = 0;

    for (const ans of data.answers) {
      const task = tasksMap.get(ans.task_id);
      if (!task) continue;
      const maxP = Number(task.max_points ?? 1);
      const isCorrect = checkAnswer(task, ans.student_answer);
      const points = isCorrect === true ? maxP : 0;
      totalScore += points;
      totalMax += maxP;

      answerRows.push({
        diagnostic_session_id: data.session_id,
        task_id: ans.task_id,
        student_answer: ans.student_answer,
        is_correct: isCorrect,
        points_awarded: points,
        max_points: maxP,
        checked_by: "auto",
        mistake_type: isCorrect === false ? baseMistake : null,
        mistake_description: isCorrect === false ? "Неправильный ответ в диагностике" : null,
      });

      const tid = task.topic_id as string | null;
      if (tid) {
        const e = perTopic.get(tid) ?? { score: 0, max: 0, correct: 0, wrong: 0 };
        e.max += maxP;
        e.score += points;
        if (isCorrect === true) e.correct += 1;
        else if (isCorrect === false) e.wrong += 1;
        perTopic.set(tid, e);
      }

      if (isCorrect === false && tid) {
        mistakeRows.push({
          student_profile_id: profileId,
          subject_id: session.subject_id,
          topic_id: tid,
          task_id: ans.task_id,
          mistake_type: baseMistake,
          mistake_description: "Ошибка во входной диагностике",
          source: "diagnostic",
        });
      }
    }

    const scorePercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

    // Persist answers (upsert by session+task)
    if (answerRows.length > 0) {
      const { error: aErr } = await sb
        .from("diagnostic_answers")
        .upsert(answerRows, { onConflict: "diagnostic_session_id,task_id" });
      if (aErr) throw aErr;
    }

    // Topic results
    const topicResultRows = Array.from(perTopic.entries()).map(([topic_id, v]) => ({
      diagnostic_session_id: data.session_id,
      student_profile_id: profileId,
      subject_id: session.subject_id,
      topic_id,
      score: v.score,
      max_score: v.max,
      score_percent: v.max > 0 ? Math.round((v.score / v.max) * 100) : 0,
      correct_count: v.correct,
      wrong_count: v.wrong,
      detected_weaknesses: v.wrong > 0 ? "Есть ошибки в теме" : null,
    }));

    if (topicResultRows.length > 0) {
      const { error: trErr } = await sb
        .from("diagnostic_topic_results")
        .upsert(topicResultRows, { onConflict: "diagnostic_session_id,topic_id" });
      if (trErr) throw trErr;
    }

    // Update student_topic_progress per topic
    if (topicResultRows.length > 0) {
      const topicIds = topicResultRows.map((r) => r.topic_id);
      const { data: existing } = await sb
        .from("student_topic_progress")
        .select("id, topic_id, mastery_score, practice_score, attempts_count, mistakes_count")
        .eq("student_profile_id", profileId)
        .in("topic_id", topicIds);
      const existingMap = new Map<string, any>(
        (existing ?? []).map((r: any) => [r.topic_id, r]),
      );

      const upserts = topicResultRows.map((tr) => {
        const ex = existingMap.get(tr.topic_id);
        const diag = tr.score_percent;
        const practice = ex?.practice_score ?? null;
        const newMastery =
          practice != null
            ? Math.round(diag * 0.7 + practice * 0.3)
            : diag;
        const newWrong = perTopic.get(tr.topic_id)?.wrong ?? 0;
        return {
          ...(ex?.id ? { id: ex.id } : {}),
          student_profile_id: profileId,
          subject_id: session.subject_id,
          topic_id: tr.topic_id,
          program_id: session.program_id,
          diagnostic_score: diag,
          mastery_score: newMastery,
          status: masteryToStatus(newMastery),
          attempts_count: (ex?.attempts_count ?? 0) + 1,
          mistakes_count: (ex?.mistakes_count ?? 0) + newWrong,
          last_activity_at: new Date().toISOString(),
        };
      });

      const { error: pErr } = await sb
        .from("student_topic_progress")
        .upsert(upserts, { onConflict: "student_profile_id,topic_id" });
      if (pErr) throw pErr;

      // Log progress history per topic where mastery changed
      const historyRows = upserts
        .map((u) => {
          const ex = existingMap.get(u.topic_id);
          const oldScore = ex?.mastery_score ?? 0;
          if (oldScore === u.mastery_score) return null;
          return {
            student_profile_id: profileId,
            user_id: context.userId,
            subject_id: session.subject_id,
            topic_id: u.topic_id,
            old_score: oldScore,
            new_score: u.mastery_score,
            source: "diagnostic" as const,
            source_ref_id: session.id,
          };
        })
        .filter((r) => r != null);
      if (historyRows.length > 0) {
        await sb.from("student_progress_history").insert(historyRows as any);
      }
    }


    // Mistakes
    if (mistakeRows.length > 0) {
      const { error: mErr } = await sb.from("student_mistakes").insert(mistakeRows);
      if (mErr) throw mErr;
    }

    // Close the session
    const summary = `Диагностика завершена: ${totalScore} из ${totalMax} (${scorePercent}%).`;
    const { data: closed, error: cErr } = await sb
      .from("diagnostic_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        score: totalScore,
        max_score: totalMax,
        score_percent: scorePercent,
        summary,
      })
      .eq("id", data.session_id)
      .select("id, score, max_score, score_percent, summary, status")
      .single();
    if (cErr) throw cErr;

    // Final aggregates with topic titles
    const { data: topicResults } = await sb
      .from("diagnostic_topic_results")
      .select("*, topic:topics(id, title)")
      .eq("diagnostic_session_id", data.session_id);

    return { session: closed, topicResults: topicResults ?? [] };
  });

// ---------------- Results / History ----------------

export const getDiagnosticResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ session_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    const { data: session, error } = await sb
      .from("diagnostic_sessions")
      .select(
        "id, status, score, max_score, score_percent, summary, ai_summary, completed_at, subject:subjects(id, slug, name), diagnostic_test:diagnostic_tests(id, title, diagnostic_type)",
      )
      .eq("id", data.session_id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw error;

    const { data: topicResults } = await sb
      .from("diagnostic_topic_results")
      .select("*, topic:topics(id, title)")
      .eq("diagnostic_session_id", data.session_id)
      .order("score_percent");

    const { data: mistakes } = await sb
      .from("diagnostic_answers")
      .select("mistake_type, task:tasks(prompt, topic:topics(title))")
      .eq("diagnostic_session_id", data.session_id)
      .eq("is_correct", false);

    const weak = (topicResults ?? []).filter((r: any) => r.score_percent < 50);

    return { session, topicResults: topicResults ?? [], mistakes: mistakes ?? [], weak };
  });

export const listMyDiagnosticHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("diagnostic_sessions")
      .select(
        "id, status, score, max_score, score_percent, completed_at, started_at, diagnostic_type, subject:subjects(name), diagnostic_test:diagnostic_tests(title)",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  });
