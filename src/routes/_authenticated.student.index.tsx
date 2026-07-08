import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import { PathyLogo } from "@/components/oge/logo";
import {
  getStudentOverview,
  getWeakTopics,
  getRecommendations,
} from "@/lib/analytics.functions";
import { listCalendarEvents } from "@/lib/learning-path.functions";

export const Route = createFileRoute("/_authenticated/student/")({
  component: StudentHome,
});

/**
 * Learning Hub — Quiet Constructivism edition.
 * Не dashboard, а рабочий стол: приветствие → ближайший шаг → маршрут → рекомендации.
 */
function StudentHome() {
  const overviewFn = useServerFn(getStudentOverview);
  const weakFn = useServerFn(getWeakTopics);
  const recsFn = useServerFn(getRecommendations);
  const eventsFn = useServerFn(listCalendarEvents);

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
    .toISOString()
    .slice(0, 10);

  const overview = useQuery({
    queryKey: ["hub", "overview"],
    queryFn: () => overviewFn(),
  });
  const weak = useQuery({
    queryKey: ["hub", "weak"],
    queryFn: () => weakFn({ data: { limit: 3 } }),
  });
  const recs = useQuery({
    queryKey: ["hub", "recs"],
    queryFn: () => recsFn(),
  });
  const events = useQuery({
    queryKey: ["hub", "events", today, horizon],
    queryFn: () => eventsFn({ data: { from: today, to: horizon } }),
  });

  const o = overview.data;
  const upcoming = (events.data?.events ?? []) as any[];
  const next = upcoming.find((e) => e.status !== "completed") ?? upcoming[0] ?? null;
  const weakList = (weak.data ?? []) as any[];
  const recList = (recs.data ?? []) as any[];

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
          <span>/ главная · {todayLabel}</span>
        </span>
        <span className="pf-section-eyebrow__label">
          прогресс {o?.avg_mastery ?? 0}% · слабых тем {o?.weak_topics ?? 0}
          {o?.streak_days ? ` · серия ${o.streak_days} дн.` : ""}
        </span>
      </div>

      <header className="mb-14">
        <p className="pf-eyebrow mb-4">рабочий стол</p>
        <h1 className="pf-h1" style={{ maxWidth: "14ch" }}>
          Что делать <span style={{ color: "var(--pf-mustard)" }}>сейчас</span>
        </h1>
        <span
          aria-hidden
          className="block mt-4"
          style={{ width: 56, height: 2, background: "var(--pf-cinnabar)" }}
        />
        <p className="pf-lead mt-6">
          Маршрут построен по диагностике и текущему прогрессу. Начните с ближайшей точки — карта знаний обновится после занятия.
        </p>
      </header>

      {/* Ближайший шаг */}
      <section className="mb-16">
        <SectionEyebrow section="01" sub="Ближайшее занятие" mark="mustard" />

        {next ? (
          <div className="grid grid-cols-[120px,1fr,auto] gap-8 items-center">
            <div
              className="font-mono text-4xl"
              style={{ color: "var(--pf-ink)" }}
            >
              {next.event_date
                ? new Date(next.event_date).toLocaleDateString("ru", {
                    day: "2-digit",
                    month: "2-digit",
                  })
                : "—"}
            </div>
            <div>
              <div
                className="font-mono text-[11px] uppercase tracking-widest mb-2"
                style={{ color: "var(--pf-muted)" }}
              >
                {next.subjects?.name ?? next.event_type} ·{" "}
                {next.event_type === "diagnostic" ? "диагностика" : "занятие"} ·{" "}
                {next.status}
              </div>
              <div className="text-[20px] font-medium leading-snug">
                {next.title ?? next.topics?.title ?? "Занятие"}
              </div>
            </div>
            {next.lesson_id ? (
              <Link
                to="/student/lesson/$lessonId"
                params={{ lessonId: next.lesson_id }}
                className="pf-btn pf-btn--accent"
              >
                Начать <ArrowRight className="h-4 w-4" />
              </Link>
            ) : next.diagnostic_session_id ? (
              <Link
                to="/student/diagnostic/$sessionId"
                params={{ sessionId: next.diagnostic_session_id }}
                className="pf-btn pf-btn--accent"
              >
                Открыть <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link to="/student/path" className="pf-btn pf-btn--ghost">
                Маршрут <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
            В календаре пока пусто.{" "}
            <Link to="/student/path" className="underline">
              Построить маршрут
            </Link>{" "}
            или{" "}
            <Link to="/student/diagnostic" className="underline">
              пройти диагностику
            </Link>
            .
          </p>
        )}
      </section>

      {/* Слабые темы */}
      <section className="mb-16">
        <SectionEyebrow
          section="02"
          sub="Слабые темы"
          mark="cinnabar"
          right={
            <Link
              to="/student/analytics"
              className="pf-section-eyebrow__label hover:text-[color:var(--pf-ink)]"
            >
              вся аналитика →
            </Link>
          }
        />

        {weakList.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
            Слабых тем не обнаружено. Хорошая работа!
          </p>
        ) : (
          <ul>
            {weakList.map((z) => (
              <li key={z.topic_id} style={{ borderBottom: "1px solid var(--pf-line)" }}>
                <Link
                  to="/student/topics/$topicId"
                  params={{ topicId: z.topic_id }}
                  className="grid grid-cols-[1fr,auto] gap-6 items-baseline py-5 hover:bg-[color:color-mix(in_oklab,var(--pf-line)_25%,transparent)]"
                >
                  <div>
                    <div
                      className="font-mono text-[11px] uppercase tracking-widest mb-1"
                      style={{ color: "var(--pf-muted)" }}
                    >
                      {z.subject_title}
                    </div>
                    <div className="text-[16px] font-medium">
                      {z.topic_title}
                    </div>
                  </div>
                  <div
                    className="font-mono text-[13px] whitespace-nowrap"
                    style={{
                      color:
                        (z.mastery_score ?? 0) < 30
                          ? "var(--pf-cinnabar)"
                          : "var(--pf-ink)",
                    }}
                  >
                    {z.mastery_score}% · {z.status}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Рекомендации */}
      <section className="mb-16">
        <SectionEyebrow section="03" sub="Рекомендации системы" mark="ink" />

        {recList.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
            Рекомендаций пока нет. Пройди диагностику или начни занятие из маршрута.
          </p>
        ) : (
          <ol>
            {recList.slice(0, 4).map((s: any, i: number) => (
              <li
                key={`${s.topic_id}-${s.kind}`}
                style={{ borderBottom: "1px solid var(--pf-line)" }}
              >
                <Link
                  to="/student/topics/$topicId"
                  params={{ topicId: s.topic_id }}
                  className="grid grid-cols-[48px,1fr,auto] gap-4 items-center py-4 hover:bg-[color:color-mix(in_oklab,var(--pf-line)_25%,transparent)]"
                >
                  <div
                    className="font-mono text-[12px]"
                    style={{ color: "var(--pf-muted)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="text-[15px] font-medium">{s.topic_title}</div>
                    <div
                      className="mt-1 font-mono text-[11px] uppercase tracking-widest"
                      style={{ color: "var(--pf-muted)" }}
                    >
                      {s.subject_title} · {s.reason}
                    </div>
                  </div>
                  <ArrowRight
                    className="h-4 w-4"
                    style={{ color: "var(--pf-muted)" }}
                  />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Быстрые действия */}
      <section>
        <SectionEyebrow section="04" sub="Быстрые действия" mark="forest" />
        <div className="flex flex-wrap gap-3">
          <Link to="/student/path" className="pf-btn pf-btn--ghost">
            Открыть маршрут <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/student/subjects" className="pf-btn pf-btn--ghost">
            Предметы <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/student/assistant" className="pf-btn pf-btn--ghost">
            Спросить AI <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </article>
  );
}
