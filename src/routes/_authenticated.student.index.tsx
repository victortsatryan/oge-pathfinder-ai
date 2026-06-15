import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/oge/page-header";
import { ConstructivistIllo } from "@/components/oge/constructivist-illo";
import { getStudentOverview, getWeakTopics, getRecommendations } from "@/lib/analytics.functions";
import { listCalendarEvents } from "@/lib/learning-path.functions";

export const Route = createFileRoute("/_authenticated/student/")({
  component: StudentHome,
});

/**
 * Learning Hub — главный экран ученика.
 * Отвечает на вопрос: «Что мне делать сейчас?»
 * Источники данных:
 *   – Сегодня        ← calendar_events (ближайшее событие)
 *   – Прогресс       ← getStudentOverview
 *   – Слабые темы    ← getWeakTopics (источник истины — analytics)
 *   – Рекомендации   ← getRecommendations
 */
function StudentHome() {
  const overviewFn = useServerFn(getStudentOverview);
  const weakFn = useServerFn(getWeakTopics);
  const recsFn = useServerFn(getRecommendations);
  const eventsFn = useServerFn(listCalendarEvents);

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10);

  const overview = useQuery({ queryKey: ["hub", "overview"], queryFn: () => overviewFn() });
  const weak = useQuery({ queryKey: ["hub", "weak"], queryFn: () => weakFn({ data: { limit: 3 } }) });
  const recs = useQuery({ queryKey: ["hub", "recs"], queryFn: () => recsFn() });
  const events = useQuery({
    queryKey: ["hub", "events", today, horizon],
    queryFn: () => eventsFn({ data: { from: today, to: horizon } }),
  });

  const o = overview.data;
  const upcoming = (events.data?.events ?? []) as any[];
  const next = upcoming.find((e) => e.status !== "completed") ?? upcoming[0] ?? null;
  const weakList = (weak.data ?? []) as any[];
  const recList = (recs.data ?? []) as any[];

  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb">
          <b>Главная</b> ·{" "}
          {new Date().toLocaleDateString("ru", { day: "numeric", month: "long", weekday: "long" })}
        </div>
        <div className="pf-crumb">
          прогресс {o?.avg_mastery ?? 0}% · слабых тем {o?.weak_topics ?? 0}
          {o?.streak_days ? ` · серия ${o.streak_days} дн.` : ""}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.3fr,1fr] gap-12 items-start mb-16">
        <div>
          <PageHeader
            title="Что делать сейчас"
            lead="Маршрут на ближайшие дни построен на основе диагностики и прогресса. Начни с ближайшей точки — система обновит карту знаний после занятия."
          />

          <div className="pf-block mb-6">
            <p className="pf-eyebrow mb-4">Ближайшее занятие</p>
            {next ? (
              <div className="grid grid-cols-[90px,1fr,auto] gap-6 items-center">
                <div className="pf-h2" style={{ fontFamily: "var(--font-mono)" }}>
                  {next.event_date
                    ? new Date(next.event_date).toLocaleDateString("ru", {
                        day: "2-digit",
                        month: "2-digit",
                      })
                    : "—"}
                </div>
                <div>
                  <div className="text-[13px] text-[color:var(--pf-muted)] mb-1">
                    {next.subjects?.name ?? next.event_type}
                  </div>
                  <div className="text-[20px] font-medium leading-tight">
                    {next.title ?? next.topics?.title ?? "Занятие"}
                  </div>
                  <div className="mt-2 text-[13px]">
                    <span className="pf-dot pf-dot--cinnabar" />
                    {next.event_type === "diagnostic" ? "диагностика" : "занятие"} · {next.status}
                  </div>
                </div>
                {next.lesson_id ? (
                  <Link to="/student/lesson/$lessonId" params={{ lessonId: next.lesson_id }} className="pf-btn">
                    Начать <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : next.diagnostic_session_id ? (
                  <Link
                    to="/student/diagnostic/$sessionId"
                    params={{ sessionId: next.diagnostic_session_id }}
                    className="pf-btn"
                  >
                    Открыть <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link to="/student/path" className="pf-btn">
                    Маршрут <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-sm text-[color:var(--pf-muted)]">
                В календаре пока пусто.{" "}
                <Link to="/student/path" className="underline">
                  Построить маршрут
                </Link>{" "}
                или{" "}
                <Link to="/student/diagnostic" className="underline">
                  пройти диагностику
                </Link>
                .
              </div>
            )}
          </div>

          <div className="pf-block">
            <div className="flex items-baseline justify-between mb-5">
              <p className="pf-eyebrow">Слабые темы</p>
              <Link to="/student/analytics" className="pf-crumb hover:text-[color:var(--pf-ink)]">
                вся аналитика →
              </Link>
            </div>
            {weakList.length === 0 ? (
              <div className="p-2 text-sm text-[color:var(--pf-muted)]">
                Слабых тем не обнаружено. Хорошая работа!
              </div>
            ) : (
              <div className="grid sm:grid-cols-3 gap-px bg-[color:var(--pf-line-strong)] border border-[color:var(--pf-line-strong)] rounded">
                {weakList.map((z) => (
                  <Link
                    key={z.topic_id}
                    to="/student/topics/$topicId"
                    params={{ topicId: z.topic_id }}
                    className="bg-[color:var(--pf-paper)] p-5 hover:bg-[color:var(--pf-paper-2,#fafafa)]"
                  >
                    <div className="text-[13px] text-[color:var(--pf-muted)] mb-2">
                      {z.subject_title}
                    </div>
                    <div className="text-[15px] font-medium mb-3 leading-snug">{z.topic_title}</div>
                    <div className="text-[12px]">
                      <span
                        className={`pf-dot pf-dot--${
                          (z.mastery_score ?? 0) < 30 ? "cinnabar" : "mustard"
                        }`}
                      />
                      {z.mastery_score}% · {z.status}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <ConstructivistIllo variant="today" className="w-full" />
      </div>

      <section className="grid lg:grid-cols-[1fr,1fr] gap-10">
        <div>
          <p className="pf-eyebrow mb-4">Рекомендации системы</p>
          <div className="pf-block">
            {recList.length === 0 ? (
              <div className="p-5 text-sm text-[color:var(--pf-muted)]">
                Рекомендаций пока нет. Пройди диагностику или начни занятие из маршрута.
              </div>
            ) : (
              recList.slice(0, 4).map((s: any, i: number) => (
                <Link
                  key={`${s.topic_id}-${s.kind}`}
                  to="/student/topics/$topicId"
                  params={{ topicId: s.topic_id }}
                  className="grid grid-cols-[40px,1fr,auto] gap-4 items-center py-4 px-5"
                  style={{ borderTop: i === 0 ? 0 : "1px solid var(--pf-line-strong)" }}
                >
                  <div className="font-mono text-[12px] text-[color:var(--pf-muted)]">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="text-[15px] font-medium">{s.topic_title}</div>
                    <div className="text-[12px] text-[color:var(--pf-muted)] mt-1">
                      {s.subject_title} · {s.reason}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[color:var(--pf-muted)]" />
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="pf-eyebrow mb-4">Быстрые действия</p>
          <div className="pf-ai-block">
            Маршрут — это последовательность шагов от слабых тем к цели. Открой маршрут, чтобы
            увидеть путь, или спроси AI-ассистента о любой теме.
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/student/path" className="pf-btn">
                Открыть маршрут <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/student/subjects" className="pf-btn pf-btn--ghost">
                Предметы <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/student/assistant" className="pf-btn pf-btn--ghost">
                Спросить AI <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
