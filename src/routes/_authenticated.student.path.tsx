import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";

import { PageHeader } from "@/components/oge/page-header";
import {
  generateLearningPath,
  generateCalendarFromLearningPath,
  getLearningPath,
  listMyLearningPaths,
} from "@/lib/learning-path.functions";
import { buildLessonFromPathItem } from "@/lib/lesson.functions";

export const Route = createFileRoute("/_authenticated/student/path")({
  component: PathPage,
});

const PRIORITY_LABEL: Record<number, string> = {
  4: "критический",
  3: "высокий",
  2: "средний",
  1: "низкий",
};

function PathPage() {
  const router = useRouter();
  const fetchList = useServerFn(listMyLearningPaths);
  const fetchPath = useServerFn(getLearningPath);
  const genPath = useServerFn(generateLearningPath);
  const genCal = useServerFn(generateCalendarFromLearningPath);
  const buildLesson = useServerFn(buildLessonFromPathItem);

  const list = useQuery({ queryKey: ["learning-paths"], queryFn: () => fetchList() });
  const activeId = list.data?.paths[0]?.id as string | undefined;

  const detail = useQuery({
    queryKey: ["learning-path", activeId],
    queryFn: () => fetchPath({ data: { path_id: activeId! } }),
    enabled: !!activeId,
  });

  const generate = useMutation({
    mutationFn: () => genPath({ data: { weeks: 4 } }),
    onSuccess: () => router.invalidate(),
  });

  const buildCalendar = useMutation({
    mutationFn: () => genCal({ data: { path_id: activeId! } }),
    onSuccess: () => router.invalidate(),
  });

  const openLesson = useMutation({
    mutationFn: (itemId: string) => buildLesson({ data: { path_item_id: itemId } }),
    onSuccess: (res: any) => {
      if (res?.lesson_id) router.navigate({ to: "/student/lesson/$lessonId", params: { lessonId: res.lesson_id } });
    },
  });

  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>Маршрут</b> · план</div>
        <Link to="/student/calendar" className="pf-crumb hover:text-[color:var(--pf-ink)]">→ календарь</Link>
      </div>

      <PageHeader
        title="Учебный маршрут"
        lead="План построен по слабым темам и текущему прогрессу. Каждый шаг превращается в занятие."
      />

      <div className="pf-block mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="pf-chip hover:bg-[color:var(--pf-ink)] hover:text-[color:var(--pf-paper)]"
        >
          {generate.isPending ? "Собираю…" : activeId ? "Пересобрать маршрут" : "Сформировать маршрут"}
        </button>
        {activeId && (
          <button
            onClick={() => buildCalendar.mutate()}
            disabled={buildCalendar.isPending}
            className="pf-chip hover:bg-[color:var(--pf-ink)] hover:text-[color:var(--pf-paper)]"
          >
            {buildCalendar.isPending ? "Раскладываю…" : "Сгенерировать календарь"}
          </button>
        )}
      </div>

      {generate.error && (
        <p className="text-sm text-[color:var(--pf-cinnabar)] mt-3">
          {(generate.error as Error).message}
        </p>
      )}

      {!activeId && !list.isLoading && (
        <p className="text-sm text-[color:var(--pf-muted)] mt-6">
          Маршрут ещё не создан. Нажмите «Сформировать маршрут».
        </p>
      )}

      {activeId && detail.data && (
        <section className="pf-block mt-6">
          <h2 className="pf-h2">{detail.data.path.title}</h2>
          <p className="text-xs font-mono text-[color:var(--pf-muted)] mt-1">
            {detail.data.path.start_date} → {detail.data.path.end_date} · {detail.data.items.length} шагов
          </p>

          <ul className="grid gap-2 mt-4">
            {detail.data.items.map((it: any) => (
              <li
                key={it.id}
                className="grid grid-cols-[24px,1fr,120px,120px] items-center gap-4 py-2 border-b border-[color:var(--pf-divider)]"
              >
                <PriorityDot priority={it.priority} />
                <div>
                  <div className="text-sm font-medium">{it.title}</div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] mt-0.5">
                    {it.subjects?.name ?? ""} · приоритет: {PRIORITY_LABEL[it.priority] ?? it.priority}
                  </div>
                </div>
                <div className="font-mono text-[11px] text-[color:var(--pf-muted)]">
                  {it.planned_date}
                </div>
                <button
                  onClick={() => openLesson.mutate(it.id)}
                  disabled={openLesson.isPending}
                  className="pf-chip text-right hover:bg-[color:var(--pf-ink)] hover:text-[color:var(--pf-paper)]"
                >
                  → к занятию
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function PriorityDot({ priority }: { priority: number }) {
  const color =
    priority >= 4 ? "var(--pf-cinnabar)" :
    priority === 3 ? "var(--pf-ochre,#d4a017)" :
    priority === 2 ? "var(--pf-ink)" : "var(--pf-divider)";
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />;
}
