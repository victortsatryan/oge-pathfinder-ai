import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateLessonAiFeedback } from "@/lib/oge-ai.functions";
import { getLessonDetail } from "@/lib/oge-mvp-data";
import { loadMvpState } from "@/lib/oge-mvp.functions";

export const answerValueSchema = z
  .string()
  .trim()
  .min(1, "Введите ответ")
  .max(200, "Ответ слишком длинный");

export const lessonSubmissionSchema = z.object({
  lessonId: z.string().trim().min(1).max(160),
  answers: z.record(z.string(), answerValueSchema),
});

export const checkLessonAnswers = createServerFn({ method: "POST" })
  .inputValidator(lessonSubmissionSchema)
  .handler(async ({ data }) => {
    const state = await loadMvpState();
    const detail = getLessonDetail(state, data.lessonId);

    if (!detail) {
      throw new Error("Lesson not found");
    }

    const expectedTaskIds = detail.practiceTasks.map((task) => task.id);
    const schema = z
      .object({
        lessonId: z.string(),
        answers: z.record(z.string(), answerValueSchema),
      })
      .superRefine((value, ctx) => {
        expectedTaskIds.forEach((taskId) => {
          if (!value.answers[taskId]) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Нужно ответить на все задания перед проверкой",
              path: ["answers", taskId],
            });
          }
        });
      });

    const parsed = schema.parse(data);
    const taskResults = detail.practiceTasks.map((task) => {
      const userAnswer = parsed.answers[task.id].trim();
      const isCorrect = normalize(userAnswer) === normalize(task.expectedAnswer);

      return {
        taskId: task.id,
        prompt: task.prompt,
        userAnswer,
        isCorrect,
        correctAnswer: task.expectedAnswer,
        explanation: task.explanation,
      };
    });

    const correctCount = taskResults.filter((item) => item.isCorrect).length;
    const scorePercent = Math.round((correctCount / taskResults.length) * 100);
    const aiFeedback = await generateLessonAiFeedback({
      data: {
        lessonId: detail.lesson.id,
        scorePercent,
        answers: taskResults,
      },
    });

    return {
      scorePercent,
      correctCount,
      total: taskResults.length,
      summary: aiFeedback.summary,
      taskResults,
      recommendations: {
        review: aiFeedback.recommendations.length
          ? aiFeedback.recommendations
          : scorePercent >= 80
            ? detail.recommendations.review.slice(0, 2)
            : detail.recommendations.review,
        extraTasks: aiFeedback.extraTasks.length ? aiFeedback.extraTasks : detail.recommendations.extraTasks,
        weakTopics: aiFeedback.weakTopics,
        difficulty: aiFeedback.difficulty,
      },
    };
  });

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
