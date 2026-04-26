import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const searchSchema = z.object({
  query: z.string().max(200).default(""),
  subjectName: z.string().max(80).optional(),
  limit: z.number().int().min(1).max(30).default(15),
});

export const searchTaskBank = createServerFn({ method: "POST" })
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

// ---------- Local lesson overrides (browser storage) ----------
// We store lesson overrides in localStorage so the editor works for guests
// (no auth required). The shape mirrors the lesson_overrides DB table so it
// can later be synced if/when the user signs in.

export type LocalLessonOverride = {
  lessonKey: string;
  title: string | null;
  topic: string | null;
  lessonDate: string | null;
  slotNumber: number | null;
  difficulty: "easy" | "adaptive" | "medium" | "hard" | null;
  status: "locked" | "in_progress" | "done" | "pending" | null;
  teacherNote: string | null;
  theoryMarkdown: string | null;
  tasks: Array<{
    id: string;
    prompt: string;
    expectedAnswer: string;
    explanation: string;
    sourceLabel: string;
    bankTaskId: string | null;
  }>;
  updatedAt: string;
};

const OVERRIDES_KEY = "oge.lesson_overrides.v1";

export function loadLocalLessonOverrides(): LocalLessonOverride[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalLessonOverride(override: LocalLessonOverride) {
  if (typeof window === "undefined") return;
  const all = loadLocalLessonOverrides();
  const next = [override, ...all.filter((o) => o.lessonKey !== override.lessonKey)];
  try {
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
  } catch (e) {
    console.error("saveLocalLessonOverride failed", e);
  }
}

export function getLocalLessonOverride(lessonKey: string): LocalLessonOverride | null {
  return loadLocalLessonOverrides().find((o) => o.lessonKey === lessonKey) ?? null;
}
