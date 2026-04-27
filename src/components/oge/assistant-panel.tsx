import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageSquarePlus, Paperclip, Send, Sparkles, Trash2, User2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { chatWithTutor } from "@/lib/oge-assistant.functions";
import { listDiagnosticHistory } from "@/lib/oge-diagnostic.functions";
import type { PlanItem } from "@/lib/oge-mvp-data";

type Attachment = {
  name: string;
  mimeType: string;
  dataUrl?: string;
  textContent?: string;
};

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};

type Suggestion = {
  id: string;
  action_type: string;
  rationale: string | null;
  payload: Record<string, any> | null;
  status: "pending" | "applied" | "rejected";
};

type StoredConversation = {
  id: string;
  title: string;
  last_message_at: string;
  messages: ChatMessage[];
  suggestions: Suggestion[];
};

const STORAGE_KEY = "oge.assistant.conversations.v1";

const SUGGESTIONS = [
  "Что мне сегодня учить?",
  "Объясни мою последнюю ошибку",
  "Дай 5 заданий на слабую тему",
  "Перестрой мой план под ОГЭ за 2 недели",
];

const ACTION_LABELS: Record<string, string> = {
  add_lesson: "Добавить урок",
  move_lesson: "Перенести урок",
  remove_lesson: "Убрать урок",
  change_topic: "Сменить тему",
  reorder: "Перестановка",
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

type Props = { planItems: PlanItem[] };

export function AssistantPanel({ planItems }: Props) {
  const greeting: ChatMessage = {
    role: "assistant",
    content:
      "Привет! Я твой AI-репетитор (GPT-5). Вижу твой план и последние диагностики. Могу разобрать ошибку, объяснить тему, предложить задания или предложить изменения в плане.",
  };
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextSummary, setContextSummary] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Build student context from plan + diagnostics
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
        const upcoming = planItems
          .filter((p) => p.dateISO >= today)
          .slice(0, 8)
          .map((p) => `${p.dateISO} ${p.subject}: ${p.topic}`)
          .join("; ");
        const recentTopics = planItems
          .filter((p) => p.dateISO >= weekAgo && p.dateISO <= today)
          .map((p) => `${p.subject} — ${p.topic}`)
          .join("; ");

        let recentDiags = "";
        try {
          const hist = await listDiagnosticHistory();
          const items = Array.isArray(hist?.items) ? hist.items.slice(0, 5) : [];
          recentDiags = items
            .map((h) => {
              const score =
                h.score != null && h.maxScore != null
                  ? `${h.score}/${h.maxScore}`
                  : h.scorePercent != null
                  ? `${h.scorePercent}%`
                  : "—";
              const weak = h.weakTopics?.length ? ` слабые: ${h.weakTopics.join(", ")}` : "";
              return `${h.subjectName} (${h.date.slice(0, 10)}) — ${score}.${weak}`;
            })
            .join(" | ");
        } catch {
          // ok — гость без диагностик
        }

        if (!alive) return;
        const summary = [
          recentTopics ? `Темы недели: ${recentTopics}.` : "",
          upcoming ? `Ближайшие занятия: ${upcoming}.` : "",
          recentDiags ? `Последние диагностики: ${recentDiags}.` : "",
        ]
          .filter(Boolean)
          .join("\n");
        setContextSummary(summary);
      } catch (e) {
        console.error("assistant context failed", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [planItems]);

  // Load conversation list from localStorage on mount
  useEffect(() => {
    setConversations(loadStore());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function persist(updater: (prev: StoredConversation[]) => StoredConversation[]) {
    setConversations((prev) => {
      const next = updater(prev);
      saveStore(next);
      return next;
    });
  }

  function openConversation(id: string) {
    setError(null);
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setMessages(conv.messages.length ? conv.messages : [greeting]);
    setSuggestions(conv.suggestions);
    setConversationId(id);
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([greeting]);
    setSuggestions([]);
    setError(null);
  }

  function removeConversation(id: string) {
    if (!confirm("Удалить этот диалог?")) return;
    persist((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) startNewConversation();
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
      const res = await chatWithTutor({
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

      // Persist conversation (strip large dataUrls to keep localStorage small)
      const persistable = finalMessages.map((m) => ({
        ...m,
        attachments: m.attachments?.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          textContent: a.textContent,
          // omit dataUrl to avoid blowing localStorage quota
        })),
      }));
      const id = conversationId ?? makeId();
      const title = (conversations.find((c) => c.id === id)?.title ?? (trimmed || atts[0]?.name || "Диалог")).slice(0, 80);
      const record: StoredConversation = {
        id,
        title,
        last_message_at: new Date().toISOString(),
        messages: persistable as ChatMessage[],
        suggestions: finalSuggestions,
      };
      persist((prev) => {
        const without = prev.filter((c) => c.id !== id);
        return [record, ...without];
      });
      if (!conversationId) setConversationId(id);
    } catch (e) {
      console.error("chat failed", e);
      const msg = e instanceof Error ? e.message : "Не удалось получить ответ AI.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  function resolveSuggestion(id: string, decision: "apply" | "reject") {
    setResolvingId(id);
    try {
      const newStatus: Suggestion["status"] = decision === "apply" ? "applied" : "rejected";
      const updated = suggestions.map((s) => (s.id === id ? { ...s, status: newStatus } : s));
      setSuggestions(updated);
      if (conversationId) {
        persist((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, suggestions: updated } : c)),
        );
      }
    } catch (e) {
      console.error("resolve failed", e);
      setError(e instanceof Error ? e.message : "Не удалось обработать предложение");
    } finally {
      setResolvingId(null);
    }
  }

  const showSuggestions = useMemo(() => messages.length <= 1, [messages.length]);
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");

  return (
    <div className="diagnostic-stack">
      <section className="diagnostic-hero">
        <div className="diagnostic-hero__copy">
          <span className="focus-pill">AI-репетитор · GPT-5</span>
          <div>
            <div className="list-row__title">Чат с ассистентом по подготовке к ОГЭ</div>
            <div className="list-row__meta">
              Видит твой план и диагностики. Может предлагать изменения в плане — ты подтверждаешь.
              История диалогов сохраняется в этом браузере.
            </div>
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 260px) 1fr", gap: 16 }}>
        {/* Conversation history sidebar */}
        <aside className="analytics-surface" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 600 }}>
          <button
            type="button"
            className="action-link diagnostic-primary-action"
            onClick={startNewConversation}
            style={{ justifyContent: "center" }}
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span>Новый диалог</span>
          </button>
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {conversations.length === 0 ? (
              <p className="status-line" style={{ opacity: 0.7 }}>
                История диалогов пока пуста.
              </p>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className="analytics-list-card"
                  style={{
                    padding: "8px 10px",
                    cursor: "pointer",
                    borderLeft:
                      c.id === conversationId ? "3px solid var(--primary)" : "3px solid transparent",
                  }}
                  onClick={() => openConversation(c.id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="list-row__title" style={{ fontSize: 13, lineHeight: 1.3 }}>
                        {c.title}
                      </div>
                      <div className="list-row__meta" style={{ fontSize: 11 }}>
                        {new Date(c.last_message_at).toLocaleDateString("ru-RU", {
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
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--muted-foreground)",
                        padding: 2,
                      }}
                      aria-label="Удалить диалог"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Chat */}
        <section className="analytics-surface" style={{ display: "flex", flexDirection: "column", minHeight: 480 }}>
          <div
            ref={scrollRef}
            className="analytics-list-stack"
            style={{ flex: 1, maxHeight: 520, overflowY: "auto", paddingRight: 4 }}
          >
            {messages.map((m, i) => (
              <article
                key={m.id ?? i}
                className="analytics-list-card"
                style={{
                  borderLeft: m.role === "user" ? "3px solid var(--primary)" : "3px solid var(--accent)",
                }}
              >
                <div className="analytics-list-card__head">
                  <span className="subject-chip">
                    {m.role === "user" ? (
                      <>
                        <User2 className="h-3 w-3" /> Вы
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" /> Ассистент
                      </>
                    )}
                  </span>
                </div>
                <div className="status-line" style={{ whiteSpace: "pre-wrap" }}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </article>
            ))}

            {pendingSuggestions.length > 0 ? (
              <article
                className="analytics-list-card"
                style={{ borderLeft: "3px solid var(--primary)", background: "var(--secondary)" }}
              >
                <div className="analytics-list-card__head">
                  <span className="subject-chip">
                    <Sparkles className="h-3 w-3" /> Предложения по плану
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                  {pendingSuggestions.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                        {ACTION_LABELS[s.action_type] ?? s.action_type}
                        {s.payload?.subject ? ` · ${s.payload.subject}` : ""}
                        {s.payload?.topic ? ` · ${s.payload.topic}` : ""}
                      </div>
                      {s.rationale ? (
                        <div className="status-line" style={{ marginBottom: 8 }}>
                          {s.rationale}
                        </div>
                      ) : null}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="action-link diagnostic-primary-action"
                          disabled={resolvingId === s.id}
                          onClick={() => resolveSuggestion(s.id, "apply")}
                        >
                          <Check className="h-3 w-3" />
                          <span>Принять к сведению</span>
                        </button>
                        <button
                          type="button"
                          className="action-link"
                          disabled={resolvingId === s.id}
                          onClick={() => resolveSuggestion(s.id, "reject")}
                        >
                          <X className="h-3 w-3" />
                          <span>Отклонить</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {sending ? (
              <article className="analytics-list-card">
                <div className="status-line">Ассистент печатает…</div>
              </article>
            ) : null}
          </div>

          {showSuggestions ? (
            <div className="lesson-actions-row" style={{ flexWrap: "wrap", marginTop: 12 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="action-link" onClick={() => send(s)} disabled={sending}>
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="status-line" style={{ color: "var(--destructive)", marginTop: 8 }}>
              {error}
            </p>
          ) : null}

          {pendingAttachments.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 10,
                padding: 8,
                borderRadius: 10,
                border: "1px dashed var(--border)",
                background: "var(--secondary)",
              }}
            >
              {pendingAttachments.map((a, idx) => (
                <span
                  key={`${a.name}-${idx}`}
                  className="subject-chip"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  title={a.mimeType}
                >
                  <Paperclip className="h-3 w-3" />
                  <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    aria-label="Убрать вложение"
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--muted-foreground)",
                      padding: 0,
                      display: "inline-flex",
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="lesson-actions-row"
            style={{ marginTop: 12, gap: 8 }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.txt,.md,.csv,.json,text/*"
              style={{ display: "none" }}
              onChange={(e) => {
                handleFiles(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              className="action-link"
              disabled={sending}
              onClick={() => fileInputRef.current?.click()}
              title="Прикрепить фото или документ"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Напишите сообщение или прикрепите файл…"
              disabled={sending}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
            <button
              type="submit"
              className="action-link diagnostic-primary-action"
              disabled={sending || (!input.trim() && pendingAttachments.length === 0)}
            >
              <Send className="h-4 w-4" />
              <span>Отправить</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
