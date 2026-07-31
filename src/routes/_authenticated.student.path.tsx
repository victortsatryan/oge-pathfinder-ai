import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";

import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import {
  generateLearningPath,
  generateCalendarFromLearningPath,
} from "@/lib/learning-path.functions";
import { buildLessonFromPathItem } from "@/lib/lesson.functions";
import type { LearningPathItem } from "@/lib/models/schemas";
import { listQuery } from "@/lib/query/defaults";
import { learningPathRepo } from "@/lib/repositories/learning-path.repository";

export const Route = createFileRoute("/_authenticated/student/path")({
  component: PathPage,
});

const PRIORITY_LABEL: Record<number, string> = {
  4: "критический",
  3: "высокий",
  2: "средний",
  1: "низкий",
};

function nodeVariant(item: LearningPathItem, isNext: boolean): string {
  if (item.lessons?.status === "completed") return "pf-timeline__node--done";
  if (isNext) return "pf-timeline__node--next";
  if (item.priority >= 4) return "pf-timeline__node--critical";
  return "";
}

function PathPage() {
  const router = useRouter();
  const genPath = useServerFn(generateLearningPath);
  const genCal = useServerFn(generateCalendarFromLearningPath);
  const buildLesson = useServerFn(buildLessonFromPathItem);

  const list = useQuery(listQuery(["learning-paths"], () => learningPathRepo.paths()));
  const activeId = list.data[0]?.id;

  const detail = useQuery({
    queryKey: ["learning-path", activeId],
    queryFn: () => learningPathRepo.detail(activeId!),
    enabled: !!activeId,
  });

  const generate = useMutation({
    mutationFn: () => genPath({ data: { weeks: 4 } }),
    onSuccess: (res) => {
      if ((res as { ok?: boolean } | null)?.ok) router.invalidate();
    },
  });

  const buildCalendar = useMutation({
    mutationFn: () => genCal({ data: { path_id: activeId! } }),
    onSuccess: () => router.invalidate(),
  });

  const openLesson = useMutation({
    mutationFn: (itemId: string) => buildLesson({ data: { path_item_id: itemId } }),
    onSuccess: (res) => {
      const lessonId = (res as { lesson_id?: string } | null)?.lesson_id;
      if (lessonId)
        router.navigate({
          to: "/student/lesson/$lessonId",
          params: { lessonId },
        });
    },
  });

  const generated = generate.data as { ok?: boolean; message?: string } | undefined;
  const generateNotice =
    generated && !generated.ok
      ? (generated.message ?? null)
      : generate.error
        ? (generate.error as Error).message
        : null;

  const items = detail.data?.items ?? [];
  const nextItem = items.find((it) => it.lessons?.status !== "completed");
  const nextLessonId = nextItem?.lessons?.id ?? null;

  return (
    <article className="pf-reader-wide pf-rise">
      <div className="pf-section-eyebrow">
        <span className="pf-section-eyebrow__label">
          <b>Маршрут</b> / план подготовки
        </span>
        <Link
          to="/student/calendar"
          className="pf-section-eyebrow__label hover:text-[color:var(--pf-ink)]"
        >
          Календарь →
        </Link>
      </div>

      <header className="mb-12">
        <p className="pf-eyebrow mb-4">учебная навигация</p>
        <h1 className="pf-h1" style={{ maxWidth: "16ch" }}>
          Учебный маршрут
        </h1>
        <p className="pf-lead">
          План собран по слабым темам и текущему прогрессу. Каждый узел — шаг, который превращается в занятие.
        </p>
      </header>

      {/* Панель действий: набор ссылок, а не карточек */}
      <div className="flex flex-wrap gap-4 items-baseline mb-12">
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className={activeId ? "pf-btn pf-btn--ghost" : "pf-btn pf-btn--accent"}
        >
          {generate.isPending
            ? "Собираю…"
            : activeId
              ? "Пересобрать маршрут"
              : "Сформировать маршрут"}
        </button>
        {activeId && nextLessonId && (
          <Link
            to="/student/lesson/$lessonId"
            params={{ lessonId: nextLessonId }}
            className="pf-btn pf-btn--accent"
          >
            Ближайшее занятие →
          </Link>
        )}
        {activeId && !nextLessonId && (
          <button
            onClick={() => buildCalendar.mutate()}
            disabled={buildCalendar.isPending}
            className="pf-btn pf-btn--ghost"
          >
            {buildCalendar.isPending ? "Раскладываю…" : "Сгенерировать календарь"}
          </button>
        )}
      </div>

      {generateNotice && (
        <p className="text-sm mb-8" style={{ color: "var(--pf-cinnabar)" }}>
          {generateNotice}
        </p>
      )}

      {!activeId && !list.isLoading && (
        <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
          Маршрут ещё не создан. Нажмите «Сформировать маршрут».
        </p>
      )}

      {activeId && detail.data && (
        <section>
          <SectionEyebrow
            section={detail.data.path?.title || "Маршрут"}
            sub={`${items.length} шагов`}
            mark="mustard"
            right={
              <span className="pf-section-eyebrow__label">
                {detail.data.path?.start_date} → {detail.data.path?.end_date}
              </span>
            }
          />

          <ol className="pf-timeline">
            {items.map((it) => {
              const isNext = nextItem?.id === it.id;
              return (
                <li
                  key={it.id}
                  className={`pf-timeline__node ${nodeVariant(it, isNext)}`}
                >
                  <div className="grid grid-cols-[1fr,auto] gap-6 items-baseline">
                    <div>
                      <div
                        className="font-mono text-[11px] uppercase tracking-widest mb-1"
                        style={{ color: "var(--pf-muted)" }}
                      >
                        {it.subjects?.name ?? ""} · приоритет{" "}
                        {PRIORITY_LABEL[it.priority] ?? it.priority}
                        {isNext ? " · следующий" : ""}
                      </div>
                      <div className="text-[17px] font-medium leading-snug">
                        {it.title}
                      </div>
                    </div>
                    <div
                      className="font-mono text-[12px] whitespace-nowrap"
                      style={{ color: "var(--pf-muted)" }}
                    >
                      {it.planned_date}
                    </div>
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={() => openLesson.mutate(it.id)}
                      disabled={openLesson.isPending}
                      className="text-[12px] font-mono uppercase tracking-widest underline underline-offset-4 hover:no-underline"
                      style={{ color: "var(--pf-ink)" }}
                    >
                      → к занятию
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </article>
  );
}
