import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, User2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { chatWithTutor } from "@/lib/oge-assistant.functions";
import { listDiagnosticHistory } from "@/lib/oge-diagnostic.functions";
import type { PlanItem } from "@/lib/oge-mvp-data";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Что мне сегодня учить?",
  "Объясни мою последнюю ошибку",
  "Дай 5 заданий на слабую тему",
  "Как готовиться к ОГЭ за 2 недели?",
];

type Props = { planItems: PlanItem[] };

export function AssistantPanel({ planItems }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Привет! Я твой AI-репетитор. Могу разобрать ошибку, объяснить тему, предложить задания или помочь с планом подготовки. О чём поговорим?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextSummary, setContextSummary] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Build short student context from plan + recent diagnostics for the AI
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

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
          messages: next.slice(-20),
          contextSummary: contextSummary || undefined,
        },
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (e) {
      console.error("chat failed", e);
      const msg = e instanceof Error ? e.message : "Не удалось получить ответ AI.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  const showSuggestions = useMemo(() => messages.length <= 1, [messages.length]);

  return (
    <div className="diagnostic-stack">
      <section className="diagnostic-hero">
        <div className="diagnostic-hero__copy">
          <span className="focus-pill">AI-репетитор</span>
          <div>
            <div className="list-row__title">Чат с ассистентом по подготовке к ОГЭ</div>
            <div className="list-row__meta">
              Видит твой план занятий и последние диагностики. Спроси что угодно по предметам.
            </div>
          </div>
        </div>
      </section>

      <section className="analytics-surface" style={{ display: "flex", flexDirection: "column", minHeight: 480 }}>
        <div
          ref={scrollRef}
          className="analytics-list-stack"
          style={{ flex: 1, maxHeight: 520, overflowY: "auto", paddingRight: 4 }}
        >
          {messages.map((m, i) => (
            <article
              key={i}
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
  );
}
