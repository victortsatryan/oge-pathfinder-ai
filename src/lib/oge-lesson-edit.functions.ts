import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const taskSchema = z.object({
  id: z.string().min(1).max(120),
  prompt: z.string().min(1).max(4000),
  expectedAnswer: z.string().max(2000).default(""),
  explanation: z.string().max(4000).default(""),
  sourceLabel: z.string().max(300).default("Добавлено вручную"),
  bankTaskId: z.string().uuid().nullable().optional(),
});

const overrideSchema = z.object({
  lessonKey: z.string().min(1).max(200),
  title: z.string().max(200).nullable().optional(),
  topic: z.string().max(200).nullable().optional(),
  lessonDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  slotNumber: z.number().int().min(1).max(8).nullable().optional(),
  difficulty: z.enum(["easy", "adaptive", "medium", "hard"]).nullable().optional(),
  status: z.enum(["locked", "in_progress", "done", "pending"]).nullable().optional(),
  teacherNote: z.string().max(4000).nullable().optional(),
  theoryMarkdown: z.string().max(20000).nullable().optional(),
  tasks: z.array(taskSchema).max(40).optional(),
});

export const saveLessonOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => overrideSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };

    const payload = {
      user_id: userId,
      lesson_key: data.lessonKey,
      title: data.title ?? null,
      topic: data.topic ?? null,
      lesson_date: data.lessonDate ?? null,
      slot_number: data.slotNumber ?? null,
      difficulty: data.difficulty ?? null,
      status: data.status ?? null,
      teacher_note: data.teacherNote ?? null,
      theory_markdown: data.theoryMarkdown ?? null,
      tasks: (data.tasks ?? []) as unknown as never,
    };

    const { data: row, error } = await supabaseAdmin
      .from("lesson_overrides")
      .upsert(payload, { onConflict: "user_id,lesson_key" })
      .select()
      .single();

    if (error) {
      console.error("saveLessonOverride failed", error);
      throw new Error("Не удалось сохранить изменения урока");
    }

    return { ok: true, override: row };
  });

const searchSchema = z.object({
  query: z.string().max(200).default(""),
  subjectName: z.string().max(80).optional(),
  limit: z.number().int().min(1).max(30).default(15),
});

export const searchTaskBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchSchema.parse(input))
  .handler(async ({ data }) => {
    let query = supabaseAdmin
      .from("tasks")
      .select("id, prompt, explanation, correct_answer, exam_section, difficulty, subjects(name), topics(title)")
      .eq("is_published", true)
      .limit(data.limit);

    if (data.query.trim()) {
      query = query.ilike("prompt", `%${data.query.trim()}%`);
    }

    type BankTask = {
      id: string;
      prompt: string;
      explanation: string;
      correctAnswer: string;
      subjectName: string;
      topicTitle: string;
      difficulty: string;
      examSection: string;
    };

    const { data: rows, error } = await query;
    if (error) {
      console.error("searchTaskBank failed", error);
      return { tasks: [] as BankTask[] };
    }

    const filtered = (rows ?? []).filter((row) => {
      if (!data.subjectName) return true;
      const name = (row as { subjects?: { name?: string } | null }).subjects?.name ?? "";
      return name.toLowerCase().includes(data.subjectName.toLowerCase()) ||
        data.subjectName.toLowerCase().includes(name.toLowerCase());
    });

    return {
      tasks: filtered.map((row) => {
        const r = row as {
          id: string;
          prompt: string;
          explanation: string | null;
          correct_answer: unknown;
          exam_section: string | null;
          difficulty: string | null;
          subjects: { name?: string } | null;
          topics: { title?: string } | null;
        };
        return {
          id: r.id,
          prompt: r.prompt,
          explanation: r.explanation ?? "",
          correctAnswer:
            typeof r.correct_answer === "string"
              ? r.correct_answer
              : r.correct_answer == null
                ? ""
                : JSON.stringify(r.correct_answer),
          subjectName: r.subjects?.name ?? "",
          topicTitle: r.topics?.title ?? "",
          difficulty: r.difficulty ?? "",
          examSection: r.exam_section ?? "",
        };
      }),
    };
  });

export const loadLessonOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lessonKey: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { data: row, error } = await supabaseAdmin
      .from("lesson_overrides")
      .select("*")
      .eq("user_id", userId)
      .eq("lesson_key", data.lessonKey)
      .maybeSingle();

    if (error) {
      console.error("loadLessonOverride failed", error);
      return { override: null };
    }
    return { override: row };
  });
