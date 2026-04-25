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

// ---------- 2) Tutor chat with context + plan suggestions ----------

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const chatInputSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
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
  .middleware([requireSupabaseAuth])
  .inputValidator(chatInputSchema)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const systemPrompt = [
      "Ты персональный AI-репетитор по подготовке к ОГЭ. Тон — спокойный, дружелюбный, по делу.",
      "Отвечай кратко и структурно (списки, шаги, формулы по необходимости). Используй markdown.",
      "Если ученик просит объяснить задание — давай разбор шаг за шагом.",
      "Если просит дополнительные задания — предложи 3–5 конкретных формулировок по теме.",
      "Если данных не хватает — задай 1 уточняющий вопрос.",
      "Если по контексту видишь, что план занятий стоит изменить (перенести урок, добавить тему, переставить порядок) — обязательно вызови инструмент propose_plan_changes с конкретными предложениями. Без подтверждения ученика изменения не применяются.",
      data.contextSummary ? `\n\nКонтекст ученика:\n${data.contextSummary}` : "",
    ].join(" ");

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...data.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_plan_changes",
              description:
                "Предложи изменения в недельном плане ученика. Каждое предложение требует подтверждения пользователя. Используй, когда видишь слабую тему, пропуск или перегруз.",
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
        ],
        tool_choice: "auto",
      }),
    });

    const payload = await handleAiResponse(response);
    const choice = payload.choices?.[0]?.message;
    let reply = typeof choice?.content === "string" ? choice.content.trim() : "";
    const toolCalls = Array.isArray(choice?.tool_calls) ? choice.tool_calls : [];

    const suggestions: Array<z.infer<typeof planSuggestionSchema>> = [];
    for (const tc of toolCalls) {
      if (tc?.function?.name !== "propose_plan_changes") continue;
      try {
        const parsed = JSON.parse(tc.function.arguments ?? "{}");
        const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
        for (const s of list) {
          const safe = planSuggestionSchema.safeParse(s);
          if (safe.success) suggestions.push(safe.data);
        }
      } catch (err) {
        console.error("propose_plan_changes parse failed", err);
      }
    }

    if (!reply && suggestions.length > 0) {
      reply = "Подготовил предложения по плану — посмотри ниже и подтверди те, что подходят.";
    }
    if (!reply) {
      throw new Error("AI вернул пустой ответ.");
    }

    // Persist conversation + messages + suggestions
    let conversationId = data.conversationId ?? null;
    const lastUserMsg = [...data.messages].reverse().find((m) => m.role === "user");
    if (!conversationId) {
      const title = (lastUserMsg?.content ?? "Новый диалог").slice(0, 80);
      const { data: conv, error: convErr } = await supabase
        .from("assistant_conversations")
        .insert({ user_id: userId, title })
        .select("id")
        .single();
      if (convErr) throw new Error(convErr.message);
      conversationId = conv!.id as string;
    } else {
      await supabase
        .from("assistant_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("user_id", userId);
    }

    if (lastUserMsg) {
      await supabase.from("assistant_messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "user",
        content: lastUserMsg.content,
      });
    }
    const { data: assistantRow, error: msgErr } = await supabase
      .from("assistant_messages")
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant",
        content: reply,
        metadata: suggestions.length ? { hasSuggestions: true } : {},
      })
      .select("id")
      .single();
    if (msgErr) throw new Error(msgErr.message);

    const insertedSuggestions: Array<{ id: string; action_type: string; rationale: string; payload: any }> = [];
    if (suggestions.length > 0) {
      const rows = suggestions.map((s) => ({
        user_id: userId,
        conversation_id: conversationId,
        message_id: assistantRow!.id as string,
        action_type: s.action_type,
        rationale: s.rationale,
        payload: s.payload ?? {},
      }));
      const { data: inserted, error: sugErr } = await supabase
        .from("assistant_plan_suggestions")
        .insert(rows)
        .select("id, action_type, rationale, payload");
      if (sugErr) throw new Error(sugErr.message);
      insertedSuggestions.push(...(inserted ?? []));
    }

    return { reply, conversationId, suggestions: insertedSuggestions };
  });

// ---------- Conversation history ----------

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select("id, title, last_message_at, created_at")
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const loadConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msgs, error } = await supabase
      .from("assistant_messages")
      .select("id, role, content, metadata, created_at")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: sugs } = await supabase
      .from("assistant_plan_suggestions")
      .select("id, message_id, action_type, rationale, payload, status")
      .eq("conversation_id", data.conversationId)
      .eq("user_id", userId);
    return { messages: msgs ?? [], suggestions: sugs ?? [] };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("assistant_conversations")
      .delete()
      .eq("id", data.conversationId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Apply / reject plan suggestion ----------

export const resolvePlanSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      suggestionId: z.string().uuid(),
      decision: z.enum(["apply", "reject"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sug, error: loadErr } = await supabase
      .from("assistant_plan_suggestions")
      .select("id, action_type, payload, status")
      .eq("id", data.suggestionId)
      .eq("user_id", userId)
      .single();
    if (loadErr || !sug) throw new Error(loadErr?.message ?? "Предложение не найдено");
    if (sug.status !== "pending") return { ok: true, status: sug.status };

    if (data.decision === "reject") {
      await supabase
        .from("assistant_plan_suggestions")
        .update({ status: "rejected" })
        .eq("id", sug.id)
        .eq("user_id", userId);
      return { ok: true, status: "rejected" };
    }

    // Apply: best-effort, supports move/change_topic/remove on existing lesson by id
    const payload = (sug.payload ?? {}) as Record<string, any>;
    const action = sug.action_type as string;
    try {
      if (action === "move_lesson" && payload.lessonId && payload.newDate) {
        await supabase
          .from("lessons")
          .update({ lesson_date: payload.newDate, ...(payload.slot ? { slot_number: payload.slot } : {}) })
          .eq("id", payload.lessonId)
          .eq("user_id", userId);
      } else if (action === "change_topic" && payload.lessonId && payload.newTopic) {
        await supabase
          .from("lessons")
          .update({ title: payload.newTopic })
          .eq("id", payload.lessonId)
          .eq("user_id", userId);
      } else if (action === "remove_lesson" && payload.lessonId) {
        await supabase
          .from("lessons")
          .delete()
          .eq("id", payload.lessonId)
          .eq("user_id", userId);
      }
      // add_lesson / reorder без lessonId оставляем как пометку — пользователь увидит rationale и сделает руками,
      // но статус всё равно «applied», чтобы не висело в очереди.
    } catch (err) {
      console.error("apply suggestion failed", err);
      throw new Error("Не удалось применить изменение плана.");
    }

    await supabase
      .from("assistant_plan_suggestions")
      .update({ status: "applied", applied_at: new Date().toISOString() })
      .eq("id", sug.id)
      .eq("user_id", userId);
    return { ok: true, status: "applied" };
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
