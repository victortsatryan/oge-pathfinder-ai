import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import { listCalendarEvents } from "@/lib/learning-path.functions";

export const Route = createFileRoute("/_authenticated/student/calendar")({
  component: CalendarRoute,
});

const STATUS_LABEL: Record<string, string> = {
  planned: "запланировано",
  in_progress: "в работе",
  completed: "пройдено",
  skipped: "пропущено",
  rescheduled: "перенесено",
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

function isToday(dateStr: string) {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr === today;
}

function CalendarRoute() {
  const fetchEvents = useServerFn(listCalendarEvents);
  const q = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => fetchEvents({ data: {} }),
  });

  const events = Array.isArray(q.data) ? q.data : [];
  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    (acc[e.event_date] ??= []).push(e);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();

  return (
    <article className="pf-reader-wide pf-rise">
      <div className="pf-section-eyebrow">
        <span className="pf-section-eyebrow__label">
          <b>Календарь</b> / маршрут
        </span>
        <Link
          to="/student/path"
          className="pf-section-eyebrow__label hover:text-[color:var(--pf-ink)]"
        >
          Маршрут →
        </Link>
      </div>

      <header className="mb-12">
        <p className="pf-eyebrow mb-4">учебные события</p>
        <h1 className="pf-h1">Календарь</h1>
        <p className="pf-lead">
          События подтягиваются из учебного маршрута: занятия, диагностики, повторения.
        </p>
      </header>

      {q.isLoading ? (
        <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
          Загрузка…
        </p>
      ) : events.length === 0 ? (
        <div>
          <p className="text-sm mb-4" style={{ color: "var(--pf-muted)" }}>
            В календаре пока нет событий. Сформируйте маршрут и сгенерируйте календарь.
          </p>
          <Link to="/student/path" className="pf-btn pf-btn--ghost">
            → к учебному маршруту
          </Link>
        </div>
      ) : (
        <div className="grid gap-0">
          {dates.map((date) => {
            const today = isToday(date);
            return (
              <section
                key={date}
                className="py-6"
                style={{
                  borderTop: "1px solid var(--pf-line-strong)",
                }}
              >
                <div className="grid grid-cols-[140px,1fr] gap-8 items-start">
                  <div>
                    <div
                      className="font-mono text-[11px] uppercase tracking-widest"
                      style={{
                        color: today ? "var(--pf-ink)" : "var(--pf-muted)",
                      }}
                    >
                      {today ? "Сегодня" : new Date(date).toLocaleDateString("ru", { weekday: "short" })}
                    </div>
                    <div
                      className="mt-1 text-2xl font-medium leading-tight"
                      style={{
                        color: today ? "var(--pf-cinnabar)" : "var(--pf-ink)",
                      }}
                    >
                      {new Date(date).toLocaleDateString("ru", {
                        day: "numeric",
                        month: "long",
                      })}
                    </div>
                  </div>

                  <ul className="grid gap-0">
                    {grouped[date].map((e) => (
                      <li key={e.id}>
                        <EventRow e={e} />
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
          <div style={{ borderTop: "1px solid var(--pf-line-strong)" }} />
        </div>
      )}
    </article>
  );
}

function EventRow({ e }: { e: CalendarEvent }) {
  const inner = (
    <div
      className="grid grid-cols-[64px,1fr,120px] items-center gap-4 py-3"
      style={{ borderBottom: "1px solid var(--pf-line)" }}
    >
      <div
        className="font-mono text-[12px]"
        style={{ color: "var(--pf-muted)" }}
      >
        {e.start_time?.slice(0, 5) ?? "—"}
      </div>
      <div>
        <div className="text-[14px] font-medium">{e.title}</div>
        <div
          className="mt-0.5 font-mono text-[11px] uppercase tracking-widest"
          style={{ color: "var(--pf-muted)" }}
        >
          {e.event_type}
          {e.subjects?.name ? ` · ${e.subjects.name}` : ""}
          {e.topics?.title ? ` · ${e.topics.title}` : ""}
        </div>
      </div>
      <div
        className="text-right font-mono text-[11px] uppercase tracking-widest"
        style={{ color: "var(--pf-muted)" }}
      >
        {STATUS_LABEL[e.status] ?? e.status}
      </div>
    </div>
  );
  if (e.lesson_id) {
    return (
      <Link
        to="/student/lesson/$lessonId"
        params={{ lessonId: e.lesson_id }}
        className="block hover:bg-[color:color-mix(in_oklab,var(--pf-line)_40%,transparent)]"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
