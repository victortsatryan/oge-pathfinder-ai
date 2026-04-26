import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const ANALYTICS_MODEL = "openai/gpt-5";
const CHAT_MODEL = "openai/gpt-5";

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
  .inputValidator((input: unknown) => analysisSchema.parse(input))
  .handler(async ({ data }) => {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        model: ANALYTICS_MODEL,
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

// ---------- 2) Tutor chat with context + plan suggestions (no auth, stateless) ----------

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const chatInputSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
  contextSummary: z.string().max(8000).optional(),
});

const planSuggestionSchema = z.object({
  action_type: z.enum(["add_lesson", "move_lesson", "remove_lesson", "change_topic", "reorder"]),
  rationale: z.string().min(1),
  payload: z
    .object({
      subject: z.string().nullable().optional(),
      topic: z.string().nullable().optional(),
      lessonDate: z.string().nullable().optional(),
      newDate: z.string().nullable().optional(),
      slot: z.number().int().nullable().optional(),
      lessonId: z.string().nullable().optional(),
      newTopic: z.string().nullable().optional(),
    })
    .default({}),
});

export const chatWithTutor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => chatInputSchema.parse(input))
  .handler(async ({ data }) => {
    const systemPrompt = [
      "Ты персональный AI-репетитор по подготовке к ОГЭ. Тон — спокойный, дружелюбный, по делу.",
      "Отвечай кратко и структурно (списки, шаги, формулы по необходимости). Используй markdown.",
      "Если ученик просит объяснить задание — давай разбор шаг за шагом.",
      "",
      "КРИТИЧЕСКИ ВАЖНО про задания:",
      "- НИКОГДА не выдумывай и не сочиняй формулировки заданий ОГЭ сам.",
      "- Если ученик просит задания/упражнения/примеры по теме — ты ОБЯЗАН вызвать инструмент find_tasks_in_bank, чтобы получить реальные задания из банка.",
      "- В ответе цитируй ТОЛЬКО те задания, которые вернул инструмент. Указывай их id и тему. Можно немного перефразировать вступление, но текст задания (`prompt`) — дословно.",
      "- Если инструмент вернул пустой список — честно скажи: «В банке заданий по этой теме пока нет ничего подходящего». Не придумывай взамен.",
      "- Не более одного-двух вызовов find_tasks_in_bank на ответ.",
      "",
      "Если по контексту видишь, что план занятий стоит изменить (перенести урок, добавить тему, переставить порядок) — вызови инструмент propose_plan_changes. Без подтверждения ученика изменения не применяются.",
      "Если данных не хватает — задай 1 уточняющий вопрос.",
      data.contextSummary ? `\n\nКонтекст ученика:\n${data.contextSummary}` : "",
    ].join(" ");

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "find_tasks_in_bank",
          description:
            "Поиск реальных заданий ОГЭ в банке заданий по ключевым словам и/или предмету. Возвращает массив заданий с id, текстом (prompt), темой, сложностью. Используй ВСЕГДА, когда ученик просит задания, примеры, упражнения, тренировку — нельзя выдумывать формулировки самому.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "Ключевые слова из текста задания или темы (на русском). Пример: 'квадратное уравнение', 'причастный оборот', 'проценты'.",
              },
              subjectName: {
                type: "string",
                description: "Название предмета: 'Математика', 'Русский язык', 'Физика' и т.п.",
              },
              limit: { type: "integer", minimum: 1, maximum: 10 },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "propose_plan_changes",
          description:
            "Предложи изменения в недельном плане ученика. Каждое предложение требует подтверждения пользователя.",
          parameters: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    action_type: {
                      type: "string",
                      enum: ["add_lesson", "move_lesson", "remove_lesson", "change_topic", "reorder"],
                    },
                    rationale: { type: "string" },
                    payload: {
                      type: "object",
                      properties: {
                        subject: { type: "string" },
                        topic: { type: "string" },
                        lessonDate: { type: "string", description: "ISO date YYYY-MM-DD" },
                        newDate: { type: "string", description: "ISO date YYYY-MM-DD" },
                        slot: { type: "integer" },
                        lessonId: { type: "string" },
                        newTopic: { type: "string" },
                      },
                    },
                  },
                  required: ["action_type", "rationale"],
                },
              },
            },
            required: ["suggestions"],
          },
        },
      },
    ];

    const conversation: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
      ...data.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const suggestions: Array<z.infer<typeof planSuggestionSchema>> = [];
    const usedTaskIds = new Set<string>();
    let reply = "";

    // Agentic loop: allow the model to call tools (search bank) before answering.
    for (let step = 0; step < 4; step++) {
      const response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages: conversation,
          tools,
          tool_choice: "auto",
        }),
      });

      const payload = await handleAiResponse(response);
      const choice = payload.choices?.[0]?.message;
      if (!choice) throw new Error("AI вернул пустой ответ.");

      const toolCalls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];

      // Push the assistant turn (with tool_calls) into the conversation
      conversation.push({
        role: "assistant",
        content: choice.content ?? "",
        tool_calls: toolCalls.length ? toolCalls : undefined,
      });

      if (!toolCalls.length) {
        reply = typeof choice.content === "string" ? choice.content.trim() : "";
        break;
      }

      // Execute each tool call and append results
      for (const tc of toolCalls) {
        const name = tc?.function?.name;
        let argsRaw = tc?.function?.arguments ?? "{}";
        let parsedArgs: any = {};
        try {
          parsedArgs = JSON.parse(argsRaw);
        } catch {
          parsedArgs = {};
        }

        if (name === "find_tasks_in_bank") {
          const q = String(parsedArgs.query ?? "").slice(0, 200);
          const subj = parsedArgs.subjectName ? String(parsedArgs.subjectName).slice(0, 80) : undefined;
          const limit = Math.min(Math.max(Number(parsedArgs.limit ?? 5), 1), 10);

          let qb = supabaseAdmin
            .from("tasks")
            .select("id, prompt, explanation, exam_section, difficulty, subjects(name), topics(title)")
            .eq("is_published", true)
            .limit(limit);
          if (q.trim()) qb = qb.ilike("prompt", `%${q.trim()}%`);

          const { data: rows, error } = await qb;
          let tasks: Array<Record<string, unknown>> = [];
          if (error) {
            console.error("find_tasks_in_bank failed", error);
          } else {
            const filtered = (rows ?? []).filter((row: any) => {
              if (!subj) return true;
              const name = row?.subjects?.name ?? "";
              const a = String(name).toLowerCase();
              const b = subj.toLowerCase();
              return a.includes(b) || b.includes(a);
            });
            tasks = filtered.map((row: any) => {
              usedTaskIds.add(row.id);
              return {
                id: row.id,
                prompt: row.prompt,
                topic: row.topics?.title ?? null,
                subject: row.subjects?.name ?? null,
                difficulty: row.difficulty ?? null,
                examSection: row.exam_section ?? null,
              };
            });
          }

          conversation.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              count: tasks.length,
              tasks,
              note:
                tasks.length === 0
                  ? "Банк не вернул заданий. Сообщи ученику честно — НЕ выдумывай задания."
                  : "Цитируй prompt дословно. Указывай id из этого ответа.",
            }),
          });
        } else if (name === "propose_plan_changes") {
          const list = Array.isArray(parsedArgs.suggestions) ? parsedArgs.suggestions : [];
          for (const s of list) {
            const safe = planSuggestionSchema.safeParse(s);
            if (safe.success) suggestions.push(safe.data);
          }
          conversation.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: true, accepted: list.length }),
          });
        } else {
          conversation.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: `Unknown tool: ${name}` }),
          });
        }
      }
    }

    if (!reply && suggestions.length > 0) {
      reply = "Подготовил предложения по плану — посмотри ниже и подтверди те, что подходят.";
    }
    if (!reply) {
      throw new Error("AI вернул пустой ответ.");
    }

    return { reply, suggestions, usedTaskIds: Array.from(usedTaskIds) };
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
  .inputValidator((input: unknown) => ocrInputSchema.parse(input))
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
                text: `Распознай результат диагностики${data.subjectName ? ` по предмету «${data.subjectName}»` : ""}. Для каждого задания заполни: № задания, тему, тип задания, ответ ученика, правильный ответ, верно/нет, тип ошибки.`,
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
