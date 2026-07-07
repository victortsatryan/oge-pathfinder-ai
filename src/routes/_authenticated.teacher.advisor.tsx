import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { getTeacherAdvisorOverview } from "@/lib/advisor.functions";
import { PageHeader } from "@/components/oge/page-header";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/teacher/advisor")({
  component: AdvisorOverview,
});

function AdvisorOverview() {
  const fn = useServerFn(getTeacherAdvisorOverview);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["teacher", "advisor", "overview"],
    queryFn: () => fn(),
    retry: 1,
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  if (isError)
    return (
      <div className="p-6 text-sm text-red-600 space-y-2">
        <div>Не удалось загрузить обзор советника.</div>
        <div className="text-xs">{String((error as any)?.message ?? "")}</div>
        <button className="underline" onClick={() => refetch()}>Повторить</button>
      </div>
    );

  const d = data as any;

  return (
    <>
      <PageHeader
        title="Советник"
        lead="Аналитическая поддержка для преподавателя. Собирает данные, подсвечивает закономерности и готовит черновики. Решения остаются за вами."
      />

      {!d.has_students && (
        <div className="pf-block p-5 text-sm text-muted-foreground">
          Советник начнёт работать после того, как вы привяжете хотя бы одного ученика.{" "}
          <Link to="/teacher/students" className="underline">Перейти к ученикам</Link>
        </div>
      )}

      {d.has_students && (
        <div className="grid gap-5 md:grid-cols-2">
          <section className="pf-block p-5 space-y-3">
            <div className="pf-eyebrow">Сегодня и ближайшее</div>
            {d.today.length === 0 && <div className="text-sm text-muted-foreground">Ближайших занятий не запланировано.</div>}
            <ul className="space-y-2 text-sm">
              {d.today.map((l: any) => (
                <li key={l.id} className="flex justify-between border-b pb-1.5">
                  <span>
                    <Link to="/teacher/students/$studentId" params={{ studentId: l.student_profile_id }} className="hover:underline">
                      {l.student_name}
                    </Link>{" "}
                    · {l.title}
                  </span>
                  <span className="text-muted-foreground">{l.lesson_date}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="pf-block p-5 space-y-3">
            <div className="pf-eyebrow">Можно обратить внимание</div>
            {d.attention.length === 0 && <div className="text-sm text-muted-foreground">Учеников, требующих внимания, по данным не видно.</div>}
            <ul className="space-y-2 text-sm">
              {d.attention.map((a: any) => (
                <li key={a.student_profile_id} className="border-b pb-2">
                  <div className="flex justify-between">
                    <Link to="/teacher/students/$studentId" params={{ studentId: a.student_profile_id }} className="font-medium hover:underline">
                      {a.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">средний {a.avg}%</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {a.reasons.map((r: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[11px]">{r}</Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="pf-block p-5 space-y-3 md:col-span-2">
            <div className="pf-eyebrow">Последние изменения (7 дней)</div>
            {d.recent_changes.length === 0 && <div className="text-sm text-muted-foreground">Пока мало данных для сравнения.</div>}
            <ul className="space-y-1.5 text-sm">
              {d.recent_changes.map((c: any, i: number) => (
                <li key={i} className="flex justify-between border-b pb-1">
                  <span>
                    <Link to="/teacher/students/$studentId" params={{ studentId: c.student_profile_id }} className="hover:underline">
                      {c.student_name}
                    </Link>{" "}
                    · {c.topic}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {c.mastery_score}% · {c.status} · {new Date(c.updated_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
