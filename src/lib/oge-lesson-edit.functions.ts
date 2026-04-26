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

// Browser-only helpers for lesson overrides have moved to
// `@/lib/oge-lesson-overrides` so they aren't processed by the server-fn
// Vite plugin (which strips non-server exports from the client bundle).

