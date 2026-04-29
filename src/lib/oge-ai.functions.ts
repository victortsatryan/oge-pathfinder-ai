import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { PlanItem } from "@/lib/oge-mvp-data";
import { getLessonDetail } from "@/lib/oge-mvp-data";
import { loadMvpState } from "@/lib/oge-mvp.functions";
import {
  AiLimitError,
  callChatCompletion,
  resolveCallerFromRequest,
} from "@/lib/ai-gateway.server";

const aiResponseSchema = z.object({
  summary: z.string().min(1),
  weakTopics: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  extraTasks: z.array(z.string()).default([]),
  difficulty: z.enum(["easy", "adaptive", "medium", "hard"]).default("adaptive"),
});

const diagnosticSchema = z.object({
  completedLessons: z.number().nonnegative(),
  pendingLessons: z.number().nonnegative(),
  averageAccuracy: z.number().nullable(),
  subjectStats: z.array(
    z.object({
      subject: z.string(),
      completed: z.number().nonnegative(),
      total: z.number().nonnegative(),
      accuracy: z.number().nullable(),
    }),
  ),
});

const lessonAiSchema = z.object({
  lessonId: z.string().min(1),
  scorePercent: z.number().min(0).max(100),
  answers: z.array(
    z.object({
      prompt: z.string(),
      userAnswer: z.string(),
      correctAnswer: z.string(),
      explanation: z.string(),
      isCorrect: z.boolean(),
    }),
  ),
});

export const generateDiagnosticAiPlan = createServerFn({ method: "POST" })
  .inputValidator(diagnosticSchema)
  .handler(async ({ data }) => {
    return callTutorAi({
      systemPrompt:
        "Ты персональный репетитор по подготовке к ОГЭ. Отвечай кратко, полезно, по делу. Тон спокойный, поддерживающий. Верни структуру через tool calling.",
      userPrompt: `Проанализируй учебную ситуацию ученика после диагностики и сформируй краткий план.

Данные:
${JSON.stringify(data, null, 2)}

Нужно:
1. Короткий вывод.
2. Слабые темы.
3. Практические рекомендации.
4. Дополнительные задания.
5. Рекомендуемый уровень сложности на ближайший этап.`,
      promptForLog: "generateDiagnosticAiPlan",
    });
  });

export const generateLessonAiFeedback = createServerFn({ method: "POST" })
  .inputValidator(lessonAiSchema)
  .handler(async ({ data }) => {
    const state = await loadMvpState();
    const detail = getLessonDetail(state, data.lessonId);

    if (!detail) {
      throw new Error("Lesson not found");
    }

    return callTutorAi({
      systemPrompt:
        "Ты персональный репетитор по подготовке к ОГЭ. Анализируй ошибки после занятия. Отвечай коротко, ясно, без воды. Верни структуру через tool calling.",
      userPrompt: `Проанализируй результаты ученика после занятия.

Урок:
${JSON.stringify(
        {
          subject: detail.lesson.subject,
          topic: detail.lesson.topic,
          section: detail.lesson.section,
          taskRange: detail.lesson.taskRange,
          currentDifficulty: inferDifficulty(detail.lesson),
          scorePercent: data.scorePercent,
          answers: data.answers,
        },
        null,
        2,
      )}

Нужно:
1. Краткий вывод по занятию.
2. Что западает.
3. Что повторить.
4. Какие ещё задания дать.
5. Как скорректировать сложность дальше.`,
      promptForLog: `generateLessonAiFeedback: ${detail.lesson.subject}/${detail.lesson.topic}`,
      subject: detail.lesson.subject,
      topic: detail.lesson.topic,
    });
  });

async function callTutorAi(opts: {
  systemPrompt: string;
  userPrompt: string;
  promptForLog: string;
  subject?: string | null;
  topic?: string | null;
}) {
  const caller = await resolveCallerFromRequest();
  const tools = [
    {
      type: "function" as const,
      function: {
        name: "return_tutor_feedback",
        description:
          "Return concise tutor feedback, weak topics, recommendations, extra tasks, and next difficulty.",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string" },
            weakTopics: { type: "array", items: { type: "string" } },
            recommendations: { type: "array", items: { type: "string" } },
            extraTasks: { type: "array", items: { type: "string" } },
            difficulty: { type: "string", enum: ["easy", "adaptive", "medium", "hard"] },
          },
          required: ["summary", "weakTopics", "recommendations", "extraTasks", "difficulty"],
          additionalProperties: false,
        },
      },
    },
  ];

  let payload: any;
  try {
    const result = await callChatCompletion({
      caller,
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userPrompt },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "return_tutor_feedback" } },
      promptForLog: opts.promptForLog,
      subject: opts.subject ?? null,
      topic: opts.topic ?? null,
    });
    payload = result.raw;
  } catch (err) {
    if (err instanceof AiLimitError) throw err;
    if (err instanceof Error) throw err;
    throw new Error("AI временно недоступен. Попробуйте позже.");
  }

  const toolArgs = payload?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!toolArgs) throw new Error("AI response did not include tool output");
  return aiResponseSchema.parse(JSON.parse(toolArgs));
}

function inferDifficulty(lesson: PlanItem) {
  if (lesson.taskRange.includes("20") || lesson.taskRange.includes("26") || lesson.section.includes("второй")) {
    return "hard";
  }

  if (lesson.taskRange.includes("15") || lesson.taskRange.includes("13.3") || lesson.taskRange.includes("33")) {
    return "medium";
  }

  return "adaptive";
}
