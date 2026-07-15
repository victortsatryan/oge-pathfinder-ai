import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

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

type StudentOverview = {
  profile: { id: string } | null;
  active_subjects: number;
  avg_mastery: number;
  total_topics: number;
  mastered_topics: number;
  learning_topics: number;
  weak_topics: number;
  lessons_count: number;
  diagnostics_count: number;
  streak_days: number;
};

type CalendarEvent = {
  id: string;
  event_type: string;
  title: string | null;
  event_date: string;
  start_time: string | null;
  duration_minutes: number | null;
  status: string;
  lesson_id: string | null;
  diagnostic_session_id: string | null;
  subject_id: string | null;
  topic_id: string | null;
  subjects: { name: string | null } | null;
  topics: { title: string | null } | null;
};

type WeakTopic = {
  topic_id: string;
  subject_id: string | null;
  topic_title: string;
  subject_title: string;
  mastery_score: number;
  status: string;
  mistakes_count: number;
  last_activity_at: string | null;
};

type Recommendation = {
  kind: string;
  topic_id: string;
  topic_title: string;
  subject_title: string;
  reason: string;
  priority: number;
};

function normalizeList<T>(queryName: string, value: T[] | null | undefined): T[] {
  const safe = Array.isArray(value) ? value : [];
  if (import.meta.env.DEV) {
    console.debug(`[StudentHome:${queryName}]`, {
      type: typeof value,
      isArray: Array.isArray(value),
      keys: value && typeof value === "object" ? Object.keys(value) : [],
      sample: safe[0] ?? null,
    });
  }
  return safe;
}

function SectionError({ message }: { message: string }) {
  return (
    <p className="text-sm" role="alert" style={{ color: "var(--pf-cinnabar)" }}>
      {message}
    </p>
  );
}

class StudentHomeSectionBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.debug("[StudentHome:section-error]", { message: error.message, stack: info.componentStack });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

const EMPTY_OVERVIEW: StudentOverview = {
  profile: null,
  active_subjects: 0,
  avg_mastery: 0,
  total_topics: 0,
  mastered_topics: 0,
  learning_topics: 0,
  weak_topics: 0,
  lessons_count: 0,
  diagnostics_count: 0,
  streak_days: 0,
};

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
    initialData: EMPTY_OVERVIEW,
  });
  const weak = useQuery({
    queryKey: ["hub", "weak"],
    queryFn: () => weakFn({ data: { limit: 3 } }),
    initialData: [] as WeakTopic[],
    select: (data) => normalizeList<WeakTopic>("getWeakTopics", data),
  });
  const recs = useQuery({
    queryKey: ["hub", "recs"],
    queryFn: () => recsFn(),
    initialData: [] as Recommendation[],
    select: (data) => normalizeList<Recommendation>("getRecommendations", data),
  });
  const events = useQuery({
    queryKey: ["hub", "events", today, horizon],
    queryFn: () => eventsFn({ data: { from: today, to: horizon } }),
    initialData: [] as CalendarEvent[],
    select: (data) => normalizeList<CalendarEvent>("listCalendarEvents", data),
  });

  const o = overview.data ?? EMPTY_OVERVIEW;
  const upcoming = events.data;
  const next = upcoming.find((e) => e.status !== "completed") ?? upcoming[0] ?? null;
  const weakList = weak.data;
  const recList = recs.data;

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
          {overview.isError ? "прогресс недоступен" : (
            <>
          прогресс {o?.avg_mastery ?? 0}% · слабых тем {o?.weak_topics ?? 0}
          {o?.streak_days ? ` · серия ${o.streak_days} дн.` : ""}
            </>
          )}
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

        <StudentHomeSectionBoundary fallback={<SectionError message="Не удалось показать ближайшее занятие." />}>
        {events.isError ? (
          <SectionError message="Не удалось загрузить ближайшие занятия." />
        ) : next ? (
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
        </StudentHomeSectionBoundary>
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

        <StudentHomeSectionBoundary fallback={<SectionError message="Не удалось показать слабые темы." />}>
        {weak.isError ? (
          <SectionError message="Не удалось загрузить слабые темы." />
        ) : weakList.length === 0 ? (
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
        </StudentHomeSectionBoundary>
      </section>

      {/* Рекомендации */}
      <section className="mb-16">
        <SectionEyebrow section="03" sub="Рекомендации системы" mark="ink" />

        <StudentHomeSectionBoundary fallback={<SectionError message="Не удалось показать рекомендации." />}>
        {recs.isError ? (
          <SectionError message="Не удалось загрузить рекомендации." />
        ) : recList.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
            Рекомендаций пока нет. Пройди диагностику или начни занятие из маршрута.
          </p>
        ) : (
          <ol>
            {recList.slice(0, 4).map((s, i) => (
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
        </StudentHomeSectionBoundary>
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
