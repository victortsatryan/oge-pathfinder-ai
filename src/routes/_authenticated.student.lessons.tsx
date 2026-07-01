import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/oge/page-header";
import { listCalendarEvents } from "@/lib/learning-path.functions";

export const Route = createFileRoute("/_authenticated/student/lessons")({
  component: LessonsList,
});

const STATUS_LABEL: Record<string, string> = {
  planned: "запланировано",
  in_progress: "в работе",
  completed: "пройдено",
  skipped: "пропущено",
};

function LessonsList() {
  const fetchEvents = useServerFn(listCalendarEvents);
  const q = useQuery({
    queryKey: ["student-lessons"],
    queryFn: () => fetchEvents({ data: {} }),
  });

  const lessons = (q.data?.events ?? []).filter((e: any) => e.event_type === "lesson" && e.lesson_id);

  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>Занятия</b> · план подготовки</div>
        <Link to="/student/path" className="pf-crumb hover:text-[color:var(--pf-ink)]">→ маршрут</Link>
      </div>

      <PageHeader
        title="Занятия"
        lead="Все занятия из твоего маршрута. Открой любое, чтобы начать."
      />

      {q.isLoading ? (
        <p className="text-sm text-[color:var(--pf-muted)] mt-6">Загрузка…</p>
      ) : lessons.length === 0 ? (
        <div className="pf-block mt-6">
          <p className="text-sm text-[color:var(--pf-muted)]">
            Занятий пока нет. Сформируй маршрут — они появятся автоматически.
          </p>
          <Link to="/student/path" className="pf-chip mt-3 inline-block">→ к маршруту</Link>
        </div>
      ) : (
        <ul className="pf-block mt-6 grid gap-2">
          {lessons.map((l: any) => (
            <li key={l.id} className="border-b border-[color:var(--pf-divider)]">
              <Link
                to="/student/lesson/$lessonId"
                params={{ lessonId: l.lesson_id }}
                className="grid grid-cols-[100px,1fr,120px] gap-4 py-3 items-center hover:bg-[color:var(--pf-cream,#f5f0e8)] transition"
              >
                <div className="font-mono text-[12px] text-[color:var(--pf-muted)]">
                  {l.event_date}
                </div>
                <div>
                  <div className="text-sm font-medium">{l.title}</div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] mt-0.5">
                    {l.subjects?.name ?? ""}
                    {l.topics?.title ? ` · ${l.topics.title}` : ""}
                  </div>
                </div>
                <div className="text-right font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)]">
                  {STATUS_LABEL[l.status] ?? l.status}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
