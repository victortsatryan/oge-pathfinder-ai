import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageSquarePlus, Send, Sparkles, Trash2, User2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

import {
  chatWithTutor,
  deleteConversation,
  listConversations,
  loadConversation,
  resolvePlanSuggestion,
} from "@/lib/oge-assistant.functions";
import { listDiagnosticHistory } from "@/lib/oge-diagnostic.functions";
import type { PlanItem } from "@/lib/oge-mvp-data";

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

type Suggestion = {
  id: string;
  message_id?: string | null;
  action_type: string;
  rationale: string | null;
  payload: Record<string, any> | null;
  status?: "pending" | "applied" | "rejected";
};

type ConversationListItem = {
  id: string;
  title: string;
  last_message_at: string;
};

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

type Props = { planItems: PlanItem[] };

export function AssistantPanel({ planItems }: Props) {
  const greeting: ChatMessage = {
    role: "assistant",
    content:
      "Привет! Я твой AI-репетитор (GPT-5). Вижу твой план и последние диагностики. Могу разобрать ошибку, объяснить тему, предложить задания или предложить изменения в плане.",
  };
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextSummary, setContextSummary] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

        const hist = await listDiagnosticHistory();
        const items = Array.isArray(hist?.items) ? hist.items.slice(0, 5) : [];
        const recentDiags = items
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

  // Load conversation list on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await listConversations();
        setConversations(res.items as ConversationListItem[]);
      } catch (e) {
        console.error("list conversations failed", e);
      }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function openConversation(id: string) {
    setError(null);
    try {
      const res = await loadConversation({ data: { conversationId: id } });
      const loadedMessages: ChatMessage[] = (res.messages as any[])
        .filter((m) => m.role !== "system")
        .map((m) => ({ id: m.id, role: m.role, content: m.content }));
      setMessages(loadedMessages.length ? loadedMessages : [greeting]);
      setSuggestions(res.suggestions as Suggestion[]);
      setConversationId(id);
    } catch (e) {
      console.error("load conversation failed", e);
      setError(e instanceof Error ? e.message : "Не удалось загрузить диалог");
    }
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([greeting]);
    setSuggestions([]);
    setError(null);
  }

  async function removeConversation(id: string) {
    if (!confirm("Удалить этот диалог?")) return;
    try {
      await deleteConversation({ data: { conversationId: id } });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === conversationId) startNewConversation();
    } catch (e) {
      console.error("delete conversation failed", e);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await chatWithTutor({
        data: {
          conversationId,
          messages: next.slice(-20).map(({ role, content }) => ({ role, content })),
          contextSummary: contextSummary || undefined,
        },
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      if (res.conversationId && res.conversationId !== conversationId) {
        setConversationId(res.conversationId);
        // Refresh conversation list
        try {
          const list = await listConversations();
          setConversations(list.items as ConversationListItem[]);
        } catch {}
      }
      if (res.suggestions?.length) {
        setSuggestions((prev) => [
          ...prev,
          ...res.suggestions.map((s: any) => ({ ...s, status: "pending" as const })),
        ]);
      }
    } catch (e) {
      console.error("chat failed", e);
      const msg = e instanceof Error ? e.message : "Не удалось получить ответ AI.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  async function resolveSuggestion(id: string, decision: "apply" | "reject") {
    setResolvingId(id);
    try {
      const res = await resolvePlanSuggestion({ data: { suggestionId: id, decision } });
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: res.status as Suggestion["status"] } : s)),
      );
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
                          <span>Применить</span>
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="lesson-actions-row"
            style={{ marginTop: 12, gap: 8 }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Напишите сообщение…"
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
              disabled={sending || !input.trim()}
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
