import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { listTeacherLessons } from "@/lib/teacher.functions";
import { PageHeader } from "@/components/oge/page-header";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/teacher/lessons")({
  component: LessonsPage,
});

function LessonsPage() {
  const fn = useServerFn(listTeacherLessons);
  const { data, isLoading } = useQuery({ queryKey: ["teacher", "lessons"], queryFn: () => fn() });
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed" | "missed">("all");

  const lessons = ((data?.lessons ?? []) as any[]).filter((l) => {
    if (filter === "upcoming") return l.status === "planned" || l.status === "scheduled";
    if (filter === "completed") return l.status === "completed";
    if (filter === "missed") return l.status === "missed" || l.status === "skipped";
    return true;
  });

  return (
    <>
      <PageHeader title="Занятия" lead="Все занятия ваших учеников: планирование, проведение, результаты." />

      <div className="flex gap-2 mb-4 text-sm">
        {(["all", "upcoming", "completed", "missed"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={`pf-chip ${filter === k ? "is-active" : ""}`}>
            {k === "all" ? "Все" : k === "upcoming" ? "Ближайшие" : k === "completed" ? "Завершённые" : "Пропущенные"}
          </button>
        ))}
      </div>

      <div className="pf-block">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>}
        {!isLoading && lessons.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">У связанных учеников пока нет занятий.</div>
        )}
        {lessons.map((l: any) => (
          <Link
            key={l.id}
            to="/lesson/$lessonId"
            params={{ lessonId: l.id }}
            className="pf-student-row"
          >
            <div className="flex-1">
              <div className="pf-student-row__name">{l.title ?? "Занятие"}</div>
              <div className="pf-student-row__sub">
                {l.lesson_date ?? "—"} · {l.student_name} · {l.subject?.name ?? "—"} · {l.topic?.title ?? "—"}
              </div>
            </div>
            {l.score_percent != null && <span className="pf-chip">{l.score_percent}%</span>}
            <Badge variant="outline">{l.status}</Badge>
          </Link>
        ))}
      </div>
    </>
  );
}
