import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AiLimitError,
  callChatCompletion,
  ensureLimitsOrThrow,
  resolveCallerFromRequest,
} from "@/lib/ai-gateway.server";

const ANALYTICS_MODEL = "gpt-4o-mini";
const CHAT_MODEL = "gpt-4o-mini";
const VISION_MODEL = "gpt-4o";

function rethrowAiError(err: unknown): never {
  if (err instanceof AiLimitError) throw err;
  if (err instanceof Error) throw err;
  throw new Error("AI временно недоступен. Попробуйте позже.");
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

const attachmentSchema = z.object({
  name: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  // For images/pdf: data URL (data:<mime>;base64,...). For text-like files: plain text content.
  dataUrl: z.string().min(1).max(8_000_000).optional(),
  textContent: z.string().min(1).max(200_000).optional(),
});

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
  attachments: z.array(attachmentSchema).max(6).optional(),
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

function buildMessageContent(msg: z.infer<typeof chatMessageSchema>) {
  const atts = msg.attachments ?? [];
  if (!atts.length) return msg.content;
  const parts: Array<Record<string, unknown>> = [];
  const textChunks: string[] = [];
  if (msg.content && msg.content.trim()) textChunks.push(msg.content);
  for (const a of atts) {
    if (a.dataUrl && (a.mimeType.startsWith("image/") || a.mimeType === "application/pdf")) {
      parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
      textChunks.push(`[Прикреплён файл: ${a.name} (${a.mimeType})]`);
    } else if (a.textContent) {
      const trimmed = a.textContent.length > 40_000 ? a.textContent.slice(0, 40_000) + "…[обрезано]" : a.textContent;
      textChunks.push(`\n--- Содержимое файла «${a.name}» (${a.mimeType}) ---\n${trimmed}\n--- конец файла ---`);
    } else {
      textChunks.push(`[Прикреплён файл: ${a.name} (${a.mimeType}) — не удалось прочитать содержимое]`);
    }
  }
  parts.unshift({ type: "text", text: textChunks.join("\n\n") });
  return parts;
}

export const chatWithTutor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => chatInputSchema.parse(input))
  .handler(async ({ data }) => {
    const hasAttachments = data.messages.some((m) => (m.attachments?.length ?? 0) > 0);
    const systemPrompt = [
      "Ты персональный AI-репетитор по подготовке к ОГЭ. Тон — спокойный, дружелюбный, по делу.",
      "Отвечай кратко и структурно (списки, шаги, формулы по необходимости). Используй markdown.",
      "Если ученик просит объяснить задание — давай разбор шаг за шагом.",
      hasAttachments
        ? "Если ученик прикрепил фото или документ — внимательно проанализируй его. Если это решение задачи: укажи, что верно, что нет, и как исправить. Если это конспект/учебник — извлеки ключевые идеи и предложи, как встроить их в план занятий (например, какую тему обновить, какие задания добавить). Если это страница с заданиями — предложи добавить конкретные задания в урок (через propose_plan_changes с action_type=change_topic или add_lesson, описав в rationale, какой урок и какие задания обновить)."
        : "",
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
      ...data.messages.map((m) => ({ role: m.role, content: buildMessageContent(m) })),
    ];

    // If user message includes images/PDFs, switch to a multimodal-capable model.
    const usesVision = data.messages.some((m) =>
      (m.attachments ?? []).some(
        (a) => a.dataUrl && (a.mimeType.startsWith("image/") || a.mimeType === "application/pdf"),
      ),
    );
    const modelForCall = usesVision ? "google/gemini-2.5-pro" : CHAT_MODEL;

    const suggestions: Array<z.infer<typeof planSuggestionSchema>> = [];
    const usedTaskIds = new Set<string>();
    let reply = "";

    // Agentic loop: allow the model to call tools (search bank) before answering.
    for (let step = 0; step < 4; step++) {
      const response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: aiHeaders(),
        body: JSON.stringify({
          model: modelForCall,
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
