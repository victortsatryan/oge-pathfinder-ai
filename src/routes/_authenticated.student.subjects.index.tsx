import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/oge/page-header";
import { listMyStudentSubjects } from "@/lib/student-profile.functions";
import { getSubjectAnalytics } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/student/subjects/")({
  component: SubjectsList,
});

/**
 * Список предметов ученика — вход в содержание обучения.
 * Для каждого предмета: прогресс, число тем, слабых тем, переход в карту тем.
 */
function SubjectsList() {
  const subjectsFn = useServerFn(listMyStudentSubjects);
  const analyticsFn = useServerFn(getSubjectAnalytics);

  const subjects = useQuery({ queryKey: ["my-subjects"], queryFn: () => subjectsFn() });
  const analytics = useQuery({ queryKey: ["subject-analytics"], queryFn: () => analyticsFn() });

  const rows = (subjects.data ?? []) as any[];
  const stats = new Map<string, any>(
    ((analytics.data ?? []) as any[]).map((s: any) => [s.subject_id, s]),
  );

  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb">
          <b>Предметы</b> · содержание обучения
        </div>
        <div className="pf-crumb">{rows.length} активных</div>
      </div>

      <PageHeader
        title="Мои предметы"
        lead="Каждый предмет — это карта тем с прогрессом, материалами и заданиями. Открой предмет, чтобы увидеть темы и слабые места."
      />

      {rows.length === 0 ? (
        <div className="pf-block p-6 text-sm text-[color:var(--pf-muted)]">
          Предметы ещё не выбраны.{" "}
          <Link to="/onboarding" className="underline">
            Пройти онбординг
          </Link>{" "}
          и выбрать предмет.
        </div>
      ) : (
        <div className="pf-block">
          {rows.map((s: any, i: number) => {
            const stat = stats.get(s.subject?.id);
            return (
              <Link
                key={s.id}
                to="/student/subjects/$subjectId"
                params={{ subjectId: s.subject?.id ?? "" }}
                className="grid grid-cols-[1fr,auto,auto,auto] gap-6 items-center py-5 px-5 hover:bg-[color:var(--pf-paper-2,#fafafa)]"
                style={{ borderTop: i === 0 ? 0 : "1px solid var(--pf-line-strong)" }}
              >
                <div>
                  <div className="text-[13px] text-[color:var(--pf-muted)] mb-1">
                    {s.program?.title ?? s.subject?.exam_type ?? "—"}
                  </div>
                  <div className="text-[18px] font-medium">{s.subject?.name ?? "Предмет"}</div>
                  {s.goal && (
                    <div className="text-[12px] text-[color:var(--pf-muted)] mt-1">
                      Цель: {s.goal}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="pf-eyebrow">прогресс</div>
                  <div className="text-[20px] font-medium">{stat?.avg_mastery ?? 0}%</div>
                </div>
                <div className="text-right">
                  <div className="pf-eyebrow">тем</div>
                  <div className="text-[20px] font-medium">{stat?.total_topics ?? 0}</div>
                </div>
                <div className="text-right">
                  <div className="pf-eyebrow">слабых</div>
                  <div className="text-[20px] font-medium text-[color:var(--pf-accent,#e11d48)]">
                    {stat?.weak_topics ?? 0}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[color:var(--pf-muted)] col-start-5" />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
