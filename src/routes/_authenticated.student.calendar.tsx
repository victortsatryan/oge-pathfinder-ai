import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/oge/page-header";
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

function CalendarRoute() {
  const fetchEvents = useServerFn(listCalendarEvents);
  const q = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => fetchEvents({ data: {} }),
  });

  const events = q.data?.events ?? [];
  const grouped = events.reduce<Record<string, any[]>>((acc, e: any) => {
    (acc[e.event_date] ??= []).push(e);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();

  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>Маршрут</b> · календарь</div>
        <Link to="/student/path" className="pf-crumb hover:text-[color:var(--pf-ink)]">
          → учебный маршрут
        </Link>
      </div>

      <PageHeader
        title="Календарь"
        lead="События подтягиваются из учебного маршрута: занятия, диагностики, повторения."
      />

      {q.isLoading ? (
        <p className="text-sm text-[color:var(--pf-muted)] mt-6">Загрузка…</p>
      ) : events.length === 0 ? (
        <div className="pf-block mt-6">
          <p className="text-sm text-[color:var(--pf-muted)]">
            В календаре пока нет событий. Сформируйте учебный маршрут и сгенерируйте календарь.
          </p>
          <Link to="/student/path" className="pf-chip mt-3 inline-block">
            → к учебному маршруту
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 mt-8">
          {dates.map((date) => (
            <div key={date} className="pf-block">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] mb-3">
                {new Date(date).toLocaleDateString("ru", {
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                })}
              </div>
              <div className="grid gap-2">
                {grouped[date].map((e: any) => (
                  <EventRow key={e.id} e={e} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function EventRow({ e }: { e: any }) {
  const inner = (
    <div className="grid grid-cols-[80px,1fr,140px] items-center gap-4 py-2 border-b border-[color:var(--pf-divider)] hover:bg-[color:var(--pf-cream,#f5f0e8)] transition">
      <div className="font-mono text-[12px] text-[color:var(--pf-muted)]">
        {e.start_time?.slice(0, 5) ?? "—"}
      </div>
      <div>
        <div className="text-sm font-medium">{e.title}</div>
        <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] mt-0.5">
          {e.event_type}
          {e.subjects?.name ? ` · ${e.subjects.name}` : ""}
          {e.topics?.title ? ` · ${e.topics.title}` : ""}
        </div>
      </div>
      <div className="text-right font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)]">
        {STATUS_LABEL[e.status] ?? e.status}
      </div>
    </div>
  );
  if (e.lesson_id) {
    return (
      <Link to="/student/lesson/$lessonId" params={{ lessonId: e.lesson_id }}>
        {inner}
      </Link>
    );
  }
  return inner;
}
