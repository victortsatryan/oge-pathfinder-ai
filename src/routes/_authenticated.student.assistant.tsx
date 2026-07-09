import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Check, MessageSquarePlus, Paperclip, Trash2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { PathyLogo } from "@/components/oge/logo";
import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import { chatWithTutor } from "@/lib/oge-assistant.functions";
import { listDiagnosticHistory } from "@/lib/oge-diagnostic.functions";
import { listCalendarEvents } from "@/lib/learning-path.functions";
import { getAiLimitStatus } from "@/lib/ai-limits.functions";

export const Route = createFileRoute("/_authenticated/student/assistant")({
  component: AssistantPage,
});

// ────────────────────────────────────────────────────────────────
// Types & storage
// ────────────────────────────────────────────────────────────────

type Attachment = {
  name: string;
  mimeType: string;
  dataUrl?: string;
  textContent?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};

type Suggestion = {
  id: string;
  action_type: string;
  rationale: string | null;
  payload: Record<string, any> | null;
  status: "pending" | "acknowledged" | "dismissed";
};

type StoredConversation = {
  id: string;
  title: string;
  last_message_at: string;
  messages: ChatMessage[];
  suggestions: Suggestion[];
};

const STORAGE_KEY = "pathy.assistant.conversations.v2";

const QUICK_PROMPTS = [
  "Что мне учить сегодня?",
  "Разбери мою последнюю ошибку",
  "Дай 5 заданий по слабой теме",
  "Перестрой план на 2 недели",
];

const ACTION_LABELS: Record<string, string> = {
  add_lesson: "добавить урок",
  move_lesson: "перенести урок",
  remove_lesson: "убрать урок",
  change_topic: "сменить тему",
  reorder: "перестановка",
};

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Привет. Я — навигатор Pathy. Вижу твой маршрут и последние диагностики. Могу разобрать ошибку, объяснить тему, подобрать задания из банка или предложить изменения в плане.",
};

function loadStore(): StoredConversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveStore(items: StoredConversation[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error("assistant store save failed", e);
  }
}
function makeId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────

function AssistantPage() {
  const chatFn = useServerFn(chatWithTutor);
  const eventsFn = useServerFn(listCalendarEvents);
  const historyFn = useServerFn(listDiagnosticHistory);
  const limitFn = useServerFn(getAiLimitStatus);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // context: upcoming plan + recent diagnostics
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const eventsQ = useQuery({
    queryKey: ["assistant", "events", today, horizon],
    queryFn: () => eventsFn({ data: { from: weekAgo, to: horizon } }),
    staleTime: 60_000,
  });
  const historyQ = useQuery({
    queryKey: ["assistant", "history"],
    queryFn: () => historyFn(),
    staleTime: 60_000,
  });
  const limitQ = useQuery({
    queryKey: ["assistant", "limit"],
    queryFn: () => limitFn(),
    staleTime: 15_000,
  });

  const contextSummary = useMemo(() => {
    const events = (eventsQ.data?.events ?? []) as any[];
    const upcoming = events
      .filter((e) => (e.event_date ?? "").slice(0, 10) >= today)
      .slice(0, 8)
      .map((e) => `${(e.event_date ?? "").slice(0, 10)} ${e.subjects?.name ?? e.event_type}: ${e.title ?? e.topics?.title ?? "занятие"}`)
      .join("; ");
    const recentTopics = events
      .filter((e) => (e.event_date ?? "").slice(0, 10) >= weekAgo && (e.event_date ?? "").slice(0, 10) <= today)
      .map((e) => `${e.subjects?.name ?? e.event_type} — ${e.title ?? e.topics?.title ?? ""}`)
      .join("; ");
    const hist = Array.isArray(historyQ.data?.items) ? historyQ.data!.items.slice(0, 5) : [];
    const recentDiags = hist
      .map((h: any) => {
        const score =
          h.score != null && h.maxScore != null
            ? `${h.score}/${h.maxScore}`
            : h.scorePercent != null
            ? `${h.scorePercent}%`
            : "—";
        const weak = h.weakTopics?.length ? ` слабые: ${h.weakTopics.join(", ")}` : "";
        return `${h.subjectName} (${String(h.date).slice(0, 10)}) — ${score}.${weak}`;
      })
      .join(" | ");
    return [
      recentTopics ? `Темы недели: ${recentTopics}.` : "",
      upcoming ? `Ближайшие занятия: ${upcoming}.` : "",
      recentDiags ? `Последние диагностики: ${recentDiags}.` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [eventsQ.data, historyQ.data, today, weekAgo]);

  // load conversation list once
  useEffect(() => {
    setConversations(loadStore());
  }, []);

  // autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // textarea autoresize
  useEffect(() => {
    const t = textareaRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 200) + "px";
  }, [input]);

  function persist(updater: (prev: StoredConversation[]) => StoredConversation[]) {
    setConversations((prev) => {
      const next = updater(prev);
      saveStore(next);
      return next;
    });
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([GREETING]);
    setSuggestions([]);
    setError(null);
    setPendingAttachments([]);
  }
  function openConversation(id: string) {
    setError(null);
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setMessages(conv.messages.length ? conv.messages : [GREETING]);
    setSuggestions(conv.suggestions);
    setConversationId(id);
  }
  function removeConversation(id: string) {
    if (!confirm("Удалить этот диалог?")) return;
    persist((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) startNewConversation();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setError(null);
    const next: Attachment[] = [];
    for (const file of Array.from(files).slice(0, 6)) {
      if (file.size > 6_000_000) {
        setError(`Файл «${file.name}» слишком большой (макс 6 МБ).`);
        continue;
      }
      const mimeType = file.type || "application/octet-stream";
      const isImage = mimeType.startsWith("image/");
      const isPdf = mimeType === "application/pdf";
      const isText =
        mimeType.startsWith("text/") ||
        mimeType === "application/json" ||
        /\.(md|txt|csv|json)$/i.test(file.name);
      try {
        if (isImage || isPdf) {
          const dataUrl: string = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(r.error);
            r.readAsDataURL(file);
          });
          next.push({ name: file.name, mimeType, dataUrl });
        } else if (isText) {
          const text = await file.text();
          next.push({ name: file.name, mimeType, textContent: text });
        } else {
          setError(`Тип «${file.name}» не поддерживается. Используй фото, PDF или текстовый файл.`);
        }
      } catch (e) {
        console.error("file read failed", e);
        setError(`Не удалось прочитать «${file.name}».`);
      }
    }
    if (next.length) setPendingAttachments((prev) => [...prev, ...next].slice(0, 6));
  }
  function removeAttachment(idx: number) {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function send(text: string) {
    const trimmed = text.trim();
    const atts = pendingAttachments;
    if ((!trimmed && atts.length === 0) || sending) return;
    setError(null);

    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed || (atts.length ? "(см. вложения)" : ""),
      attachments: atts.length ? atts : undefined,
    };
    const next: ChatMessage[] = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPendingAttachments([]);
    setSending(true);
    try {
      const res = await chatFn({
        data: {
          messages: next.slice(-20).map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
          contextSummary: contextSummary || undefined,
        },
      });
      const assistantMsg: ChatMessage = { role: "assistant", content: res.reply };
      const finalMessages = [...next, assistantMsg];
      setMessages(finalMessages);

      const newSuggestions: Suggestion[] = (res.suggestions ?? []).map((s: any) => ({
        id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        action_type: s.action_type,
        rationale: s.rationale,
        payload: s.payload ?? null,
        status: "pending",
      }));
      const finalSuggestions = [...suggestions, ...newSuggestions];
      setSuggestions(finalSuggestions);

      // strip large dataUrls before persisting
      const persistable = finalMessages.map((m) => ({
        ...m,
        attachments: m.attachments?.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          textContent: a.textContent,
        })),
      })) as ChatMessage[];
      const id = conversationId ?? makeId();
      const title = (conversations.find((c) => c.id === id)?.title ?? (trimmed || atts[0]?.name || "Диалог")).slice(0, 80);
      const record: StoredConversation = {
        id,
        title,
        last_message_at: new Date().toISOString(),
        messages: persistable,
        suggestions: finalSuggestions,
      };
      persist((prev) => [record, ...prev.filter((c) => c.id !== id)]);
      if (!conversationId) setConversationId(id);
    } catch (e) {
      console.error("chat failed", e);
      setError(e instanceof Error ? e.message : "Не удалось получить ответ ассистента.");
    } finally {
      setSending(false);
      limitQ.refetch();
    }
  }

  function resolveSuggestion(id: string, decision: "acknowledged" | "dismissed") {
    const updated = suggestions.map((s) => (s.id === id ? { ...s, status: decision } : s));
    setSuggestions(updated);
    if (conversationId) {
      persist((prev) => prev.map((c) => (c.id === conversationId ? { ...c, suggestions: updated } : c)));
    }
  }

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const isEmpty = messages.length <= 1;
  const limit = limitQ.data;

  const todayLabel = new Date().toLocaleDateString("ru", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });

  return (
    <article className="pf-reader-wide pf-rise">
      <div className="pf-section-eyebrow">
        <span className="pf-section-eyebrow__label inline-flex items-center gap-3">
          <PathyLogo size="sm" />
          <span>/ навигатор · {todayLabel}</span>
        </span>
        <span className="pf-section-eyebrow__label">
          {limit
            ? limit.globalExhausted
              ? "общий лимит на сегодня исчерпан"
              : `осталось ${limit.userRemaining} из ${limit.perUserLimit} запросов`
            : "модель gpt-4o"}
        </span>
      </div>

      <header className="mb-12">
        <p className="pf-eyebrow mb-4">персональный ассистент</p>
        <h1 className="pf-h1" style={{ maxWidth: "16ch" }}>
          Спроси <span style={{ color: "var(--pf-cinnabar)" }}>Pathy</span>
        </h1>
        <span
          aria-hidden
          className="block mt-4"
          style={{ width: 56, height: 2, background: "var(--pf-mustard)" }}
        />
        <p className="pf-lead mt-6" style={{ maxWidth: "60ch" }}>
          Навигатор видит твой маршрут, диагностики и слабые темы. Разберёт ошибку, подберёт задания из банка,
          предложит изменения в плане — ты подтверждаешь.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px,1fr] items-start">
        {/* ── Sidebar: conversations ── */}
        <aside className="lg:sticky lg:top-4">
          <SectionEyebrow section="01" sub="Диалоги" mark="ink" />
          <button
            type="button"
            onClick={startNewConversation}
            className="w-full inline-flex items-center justify-between gap-2 py-3 px-4 mb-4 text-[13px] uppercase tracking-widest font-mono border transition"
            style={{
              borderColor: "var(--pf-ink)",
              background: conversationId === null ? "var(--pf-ink)" : "transparent",
              color: conversationId === null ? "var(--pf-paper)" : "var(--pf-ink)",
            }}
          >
            <span>новый диалог</span>
            <MessageSquarePlus className="h-4 w-4" />
          </button>

          {conversations.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--pf-muted)" }}>
              История пока пуста. Задай первый вопрос — диалог сохранится в этом браузере.
            </p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto pr-1">
              {conversations.map((c) => {
                const active = c.id === conversationId;
                return (
                  <li key={c.id} style={{ borderBottom: "1px solid var(--pf-line)" }}>
                    <div
                      className="group grid grid-cols-[1fr,auto] gap-2 items-start py-3 pr-1 cursor-pointer"
                      onClick={() => openConversation(c.id)}
                      style={{
                        borderLeft: active ? "3px solid var(--pf-cinnabar)" : "3px solid transparent",
                        paddingLeft: 10,
                      }}
                    >
                      <div>
                        <div className="text-[14px] font-medium leading-snug line-clamp-2">{c.title}</div>
                        <div className="font-mono text-[10px] uppercase tracking-widest mt-1" style={{ color: "var(--pf-muted)" }}>
                          {new Date(c.last_message_at).toLocaleDateString("ru", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeConversation(c.id);
                        }}
                        aria-label="Удалить диалог"
                        className="opacity-0 group-hover:opacity-100 p-1"
                        style={{ color: "var(--pf-muted)" }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* ── Chat column ── */}
        <section>
          <SectionEyebrow
            section="02"
            sub={isEmpty ? "Начни разговор" : "Диалог"}
            mark="cinnabar"
          />

          <div
            ref={scrollRef}
            className="mb-6 pr-1"
            style={{
              maxHeight: 560,
              overflowY: "auto",
              borderTop: "1px solid var(--pf-line)",
            }}
          >
            {messages.map((m, i) => (
              <MessageRow key={i} message={m} />
            ))}

            {pendingSuggestions.length > 0 && (
              <div className="py-6" style={{ borderTop: "1px solid var(--pf-line)" }}>
                <div className="font-mono text-[11px] uppercase tracking-widest mb-3" style={{ color: "var(--pf-mustard)" }}>
                  предложения к плану
                </div>
                <div className="grid gap-3">
                  {pendingSuggestions.map((s) => (
                    <div
                      key={s.id}
                      className="p-4"
                      style={{
                        border: "1px solid var(--pf-line-strong)",
                        background: "color-mix(in oklab, var(--pf-mustard) 8%, var(--pf-paper))",
                      }}
                    >
                      <div className="font-mono text-[11px] uppercase tracking-widest mb-2" style={{ color: "var(--pf-ink)" }}>
                        {ACTION_LABELS[s.action_type] ?? s.action_type}
                        {s.payload?.subject ? ` · ${s.payload.subject}` : ""}
                        {s.payload?.topic ? ` · ${s.payload.topic}` : ""}
                        {s.payload?.newDate ? ` · ${s.payload.newDate}` : ""}
                      </div>
                      {s.rationale && (
                        <p className="text-[14px] leading-relaxed mb-3">{s.rationale}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="pf-btn pf-btn--accent"
                          onClick={() => resolveSuggestion(s.id, "acknowledged")}
                        >
                          <Check className="h-4 w-4" /> принять к сведению
                        </button>
                        <button
                          type="button"
                          className="pf-btn pf-btn--ghost"
                          onClick={() => resolveSuggestion(s.id, "dismissed")}
                        >
                          <X className="h-4 w-4" /> отклонить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sending && (
              <div className="py-5" style={{ borderTop: "1px solid var(--pf-line)" }}>
                <div className="font-mono text-[11px] uppercase tracking-widest mb-2" style={{ color: "var(--pf-muted)" }}>
                  ассистент
                </div>
                <div className="flex items-center gap-2 text-[14px]" style={{ color: "var(--pf-muted)" }}>
                  <span className="inline-flex gap-1">
                    <Dot delay={0} />
                    <Dot delay={0.15} />
                    <Dot delay={0.3} />
                  </span>
                  думает над ответом
                </div>
              </div>
            )}
          </div>

          {/* Quick prompts */}
          {isEmpty && (
            <div className="flex flex-wrap gap-2 mb-4">
              {QUICK_PROMPTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="pf-btn pf-btn--ghost"
                  onClick={() => send(s)}
                  disabled={sending}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p
              className="mb-3 px-3 py-2 text-[13px] font-mono"
              style={{
                color: "var(--pf-cinnabar)",
                border: "1px solid var(--pf-cinnabar)",
                background: "color-mix(in oklab, var(--pf-cinnabar) 8%, var(--pf-paper))",
              }}
            >
              {error}
            </p>
          )}

          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {pendingAttachments.map((a, idx) => (
                <span
                  key={`${a.name}-${idx}`}
                  className="inline-flex items-center gap-2 px-2 py-1 font-mono text-[11px] uppercase tracking-wider"
                  style={{ border: "1px solid var(--pf-line-strong)", background: "var(--pf-paper)" }}
                  title={a.mimeType}
                >
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    aria-label="Убрать вложение"
                    style={{ color: "var(--pf-muted)" }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="relative"
            style={{ border: "1px solid var(--pf-line-strong)", background: "var(--pf-paper)" }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.txt,.md,.csv,.json,text/*"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Напиши сообщение… (Shift+Enter — новая строка)"
              disabled={sending}
              rows={1}
              className="w-full resize-none bg-transparent outline-none text-[15px] leading-relaxed"
              style={{
                padding: "16px 96px 12px 16px",
                minHeight: 56,
                color: "var(--pf-ink)",
              }}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                title="Прикрепить фото или документ"
                aria-label="Прикрепить файл"
                className="p-2 transition"
                style={{ color: "var(--pf-muted)" }}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="submit"
                disabled={sending || (!input.trim() && pendingAttachments.length === 0)}
                aria-label="Отправить"
                className="inline-flex items-center justify-center transition disabled:opacity-40"
                style={{
                  width: 36,
                  height: 36,
                  background: "var(--pf-ink)",
                  color: "var(--pf-paper)",
                }}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </form>

          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--pf-muted)" }}>
            enter — отправить · shift+enter — перенос · фото и pdf принимаются
          </p>
        </section>
      </div>
    </article>
  );
}

// ────────────────────────────────────────────────────────────────
// Message row (Constructivist style)
// ────────────────────────────────────────────────────────────────

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className="py-6"
      style={{ borderTop: "1px solid var(--pf-line)" }}
    >
      <div
        className="font-mono text-[11px] uppercase tracking-widest mb-2"
        style={{ color: isUser ? "var(--pf-ultramarine)" : "var(--pf-cinnabar)" }}
      >
        {isUser ? "вы" : "ассистент"}
      </div>

      {isUser ? (
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
      ) : (
        <div className="pf-prose text-[15px] leading-relaxed">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      )}

      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {message.attachments.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 px-2 py-1 font-mono text-[10px] uppercase tracking-widest"
              style={{ border: "1px solid var(--pf-line-strong)", color: "var(--pf-muted)" }}
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">{a.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block"
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "var(--pf-ink)",
        animation: "pfDotPulse 1s infinite ease-in-out",
        animationDelay: `${delay}s`,
      }}
    />
  );
}
