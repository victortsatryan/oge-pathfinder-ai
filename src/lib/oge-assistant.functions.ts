import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const ANALYTICS_MODEL = "openai/gpt-5";
const CHAT_MODEL = "openai/gpt-5";
const VISION_MODEL = "google/gemini-2.5-flash";

function aiHeaders() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function handleAiResponse(response: Response) {
  if (response.status === 429) throw new Error("Превышен лимит запросов AI. Подождите минуту и повторите.");
  if (response.status === 402) throw new Error("Закончились кредиты Lovable AI. Пополните баланс в настройках.");
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI gateway error [${response.status}]: ${text}`);
  }
  return response.json();
}

// ---------- 1) Detailed analysis of a finished diagnostic ----------

const analysisSchema = z.object({
  subjectName: z.string().min(1),
  date: z.string().min(1),
  source: z.enum(["platform", "external"]),
  sourceName: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  maxScore: z.number().nullable().optional(),
  scorePercent: z.number().nullable().optional(),
  weakTopics: z.array(z.string()).default([]),
  strongTopics: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
  rawText: z.string().nullable().optional(),
  details: z
    .array(
      z.object({
        taskNumber: z.number().int().nullable().optional(),
        taskType: z.string().nullable().optional(),
        topicTitle: z.string().nullable().optional(),
        errorTitle: z.string().nullable().optional(),
        userAnswer: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
        correctAnswer: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
        isCorrect: z.boolean().optional(),
        prompt: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

const analysisOutputSchema = z.object({
  summary: z.string().min(1),
  weakTopics: z.array(z.string()).default([]),
  errorPatterns: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  extraTasks: z.array(z.string()).default([]),
  difficulty: z.enum(["easy", "adaptive", "medium", "hard"]).default("adaptive"),
});

export const analyzeDiagnosticResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(analysisSchema)
  .handler(async ({ data }) => {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Ты репетитор по подготовке к ОГЭ. Анализируй конкретную диагностику ученика по предмету. Тон — спокойный, поддерживающий. Конкретика важнее общих слов. Возвращай результат через tool calling.",
          },
          {
            role: "user",
            content: `Проанализируй результат диагностики:\n${JSON.stringify(data, null, 2)}\n\nНужно: краткий вывод, слабые темы, повторяющиеся типы ошибок, рекомендации к занятиям, какие задания дорешать, рекомендуемая сложность.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_diagnostic_analysis",
              description: "Return structured analysis of a single diagnostic result.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  weakTopics: { type: "array", items: { type: "string" } },
                  errorPatterns: { type: "array", items: { type: "string" } },
                  recommendations: { type: "array", items: { type: "string" } },
                  extraTasks: { type: "array", items: { type: "string" } },
                  difficulty: { type: "string", enum: ["easy", "adaptive", "medium", "hard"] },
                },
                required: ["summary", "weakTopics", "errorPatterns", "recommendations", "extraTasks", "difficulty"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_diagnostic_analysis" } },
      }),
    });

    const payload = await handleAiResponse(response);
    const args = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI не вернул структуру разбора.");
    return analysisOutputSchema.parse(JSON.parse(args));
  });

// ---------- 2) Tutor chat with context ----------

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const chatInputSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
  contextSummary: z.string().max(8000).optional(),
});

export const chatWithTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(chatInputSchema)
  .handler(async ({ data }) => {
    const systemPrompt = [
      "Ты персональный AI-репетитор по подготовке к ОГЭ. Тон — спокойный, дружелюбный, по делу.",
      "Отвечай кратко и структурно (списки, шаги, формулы по необходимости). Используй markdown.",
      "Если ученик просит объяснить задание — давай разбор шаг за шагом.",
      "Если просит дополнительные задания — предложи 3–5 конкретных формулировок по теме.",
      "Если данных не хватает — задай 1 уточняющий вопрос.",
      data.contextSummary ? `\n\nКонтекст ученика:\n${data.contextSummary}` : "",
    ].join(" ");

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...data.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    const payload = await handleAiResponse(response);
    const reply = payload.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("AI вернул пустой ответ.");
    }
    return { reply };
  });

// ---------- 3) OCR diagnostic photo with Gemini Vision ----------

const ocrInputSchema = z.object({
  imageUrl: z.string().url(),
  subjectName: z.string().optional(),
});

const ocrOutputSchema = z.object({
  taskDetails: z
    .array(
      z.object({
        taskNumber: z.number().int().min(1),
        taskType: z.string().nullable().optional(),
        topicTitle: z.string().nullable().optional(),
        errorTitle: z.string().nullable().optional(),
        userAnswer: z.string().nullable().optional(),
        correctAnswer: z.string().nullable().optional(),
        isCorrect: z.boolean().optional(),
        comment: z.string().nullable().optional(),
      }),
    )
    .default([]),
  detectedScore: z.number().nullable().optional(),
  detectedMaxScore: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const ocrDiagnosticPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ocrInputSchema)
  .handler(async ({ data }) => {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Ты ассистент-OCR для диагностик ОГЭ. Извлекай задания, ответы ученика, правильные ответы, темы и типы ошибок из фото. Возвращай структуру через tool calling.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Распознай результат диагностики${data.subjectName ? ` по предмету «${data.subjectName}»` : ""}. Для каждого задания заполни: № задания, тему, тип задания, ответ ученика, правильный ответ, верно/нет, тип ошибки (вычислительная, логическая, невнимательность и т.п.). Если на фото есть итоговый балл — укажи detectedScore и detectedMaxScore.`,
              },
              { type: "image_url", image_url: { url: data.imageUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_ocr_result",
              description: "Return structured task details extracted from the diagnostic photo.",
              parameters: {
                type: "object",
                properties: {
                  taskDetails: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        taskNumber: { type: "integer" },
                        taskType: { type: "string" },
                        topicTitle: { type: "string" },
                        errorTitle: { type: "string" },
                        userAnswer: { type: "string" },
                        correctAnswer: { type: "string" },
                        isCorrect: { type: "boolean" },
                        comment: { type: "string" },
                      },
                      required: ["taskNumber"],
                      additionalProperties: false,
                    },
                  },
                  detectedScore: { type: "number" },
                  detectedMaxScore: { type: "number" },
                  notes: { type: "string" },
                },
                required: ["taskDetails"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_ocr_result" } },
      }),
    });

    const payload = await handleAiResponse(response);
    const args = payload.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI не смог распознать фото.");
    return ocrOutputSchema.parse(JSON.parse(args));
  });
