// Server-only AI gateway: own OpenAI key, daily limits, response cache.
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export const PER_USER_DAILY_LIMIT = 20;
export const GLOBAL_DAILY_API_LIMIT = 20_000;

export class AiLimitError extends Error {
  scope: "user" | "global";
  constructor(scope: "user" | "global", message: string) {
    super(message);
    this.scope = scope;
    this.name = "AiLimitError";
  }
}

export type AiCaller = {
  userId: string | null;
  ip: string | null;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: any;
  tool_calls?: any;
  tool_call_id?: string;
};

export type CallChatOptions = {
  caller: AiCaller;
  model?: string;
  messages: ChatMessage[];
  tools?: any[];
  tool_choice?: any;
  temperature?: number;
  // Cache control: true → check & store cache; "general" topics only.
  cache?: {
    enabled: boolean;
    subject?: string | null;
    topic?: string | null;
    // override key (e.g. just the user prompt text); defaults to last user message text
    keyText?: string;
  };
  // For logging
  promptForLog: string;
  subject?: string | null;
  topic?: string | null;
};

function todayCutoffIso() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function normalizePrompt(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 4000);
}

function hashPrompt(text: string, model: string) {
  return createHash("sha256").update(`${model}::${normalizePrompt(text)}`).digest("hex");
}

export async function checkLimits(caller: AiCaller) {
  const { data, error } = await supabaseAdmin.rpc("count_ai_requests_today", {
    _user_id: caller.userId as any,
    _ip: caller.ip as any,
  });
  if (error) {
    console.error("count_ai_requests_today failed", error);
    return { userCount: 0, globalApiCount: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    userCount: Number(row?.user_count ?? 0),
    globalApiCount: Number(row?.global_api_count ?? 0),
  };
}

async function logRequest(opts: {
  caller: AiCaller;
  prompt: string;
  subject?: string | null;
  topic?: string | null;
  source: "cache" | "api";
}) {
  const { error } = await supabaseAdmin.from("ai_request_logs").insert({
    user_id: opts.caller.userId,
    ip_address: opts.caller.ip,
    prompt: opts.prompt.slice(0, 4000),
    subject: opts.subject ?? null,
    topic: opts.topic ?? null,
    source: opts.source,
  });
  if (error) console.error("ai_request_logs insert failed", error);
}

async function readCache(promptHash: string) {
  const { data } = await supabaseAdmin
    .from("ai_response_cache")
    .select("id, response_text, usage_count")
    .eq("prompt_hash", promptHash)
    .maybeSingle();
  return data ?? null;
}

async function writeCache(opts: {
  promptHash: string;
  normalized: string;
  responseText: string;
  subject?: string | null;
  topic?: string | null;
}) {
  const { error } = await supabaseAdmin
    .from("ai_response_cache")
    .upsert(
      {
        prompt_hash: opts.promptHash,
        normalized_prompt: opts.normalized,
        response_text: opts.responseText,
        subject: opts.subject ?? null,
        topic: opts.topic ?? null,
      },
      { onConflict: "prompt_hash" },
    );
  if (error) console.error("ai_response_cache upsert failed", error);
}

async function bumpCacheUsage(id: string, current: number) {
  await supabaseAdmin
    .from("ai_response_cache")
    .update({ usage_count: current + 1, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function ensureLimitsOrThrow(caller: AiCaller) {
  const { userCount, globalApiCount } = await checkLimits(caller);
  if (userCount >= PER_USER_DAILY_LIMIT) {
    throw new AiLimitError(
      "user",
      "Вы использовали дневной лимит AI-запросов. Лимит обновится завтра.",
    );
  }
  if (globalApiCount >= GLOBAL_DAILY_API_LIMIT) {
    throw new AiLimitError(
      "global",
      "Сегодня общий лимит AI-запросов исчерпан. Попробуйте завтра.",
    );
  }
  return { userCount, globalApiCount };
}

export async function callChatCompletion(opts: CallChatOptions) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = opts.model ?? "gpt-4o-mini";

  // 1. Limits BEFORE anything (including cache hits — counts toward user limit).
  await ensureLimitsOrThrow(opts.caller);

  // 2. Cache check (only when explicitly enabled and no tools / no images).
  const cacheEnabled =
    !!opts.cache?.enabled &&
    !opts.tools &&
    opts.messages.every((m) => typeof m.content === "string");

  let promptHash: string | null = null;
  let normalized = "";
  if (cacheEnabled) {
    const keyText =
      opts.cache?.keyText ??
      [...opts.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (typeof keyText === "string" && keyText.trim().length > 0) {
      normalized = normalizePrompt(keyText);
      promptHash = hashPrompt(keyText, model);
      const hit = await readCache(promptHash);
      if (hit) {
        await bumpCacheUsage(hit.id, hit.usage_count);
        await logRequest({
          caller: opts.caller,
          prompt: opts.promptForLog,
          subject: opts.subject,
          topic: opts.topic,
          source: "cache",
        });
        return { fromCache: true, raw: null as any, text: hit.response_text };
      }
    }
  }

  // 3. Real API call to OpenAI.
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.tool_choice) body.tool_choice = opts.tool_choice;
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new Error("AI временно недоступен (превышен rate limit). Попробуйте через минуту.");
  }
  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI error", response.status, errText);
    throw new Error("AI временно недоступен. Попробуйте позже.");
  }

  const payload = await response.json();
  const text: string = payload?.choices?.[0]?.message?.content ?? "";

  // 4. Log + maybe cache.
  await logRequest({
    caller: opts.caller,
    prompt: opts.promptForLog,
    subject: opts.subject,
    topic: opts.topic,
    source: "api",
  });

  if (cacheEnabled && promptHash && text) {
    await writeCache({
      promptHash,
      normalized,
      responseText: text,
      subject: opts.subject,
      topic: opts.topic,
    });
  }

  return { fromCache: false, raw: payload, text };
}

// --- Caller resolution from current request ---

export async function resolveCallerFromRequest(): Promise<AiCaller> {
  const { getRequest, getRequestHeader, getRequestIP } = await import(
    "@tanstack/react-start/server"
  );
  let userId: string | null = null;
  let ip: string | null = null;

  try {
    const auth = getRequestHeader("authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const { data } = await supabaseAdmin.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }
  } catch (err) {
    console.warn("resolveCaller: auth header parse failed", err);
  }

  if (!userId) {
    try {
      ip =
        getRequestIP({ xForwardedFor: true }) ??
        getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
        null;
    } catch {
      ip = null;
    }
  }

  return { userId, ip };
}
