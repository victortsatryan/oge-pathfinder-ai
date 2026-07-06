import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { getTeacherAnalytics } from "@/lib/teacher.functions";
import { PageHeader } from "@/components/oge/page-header";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/teacher/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const fn = useServerFn(getTeacherAnalytics);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["teacher", "analytics"], queryFn: () => fn(), retry: 1 });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Загрузка аналитики…</div>;
  if (isError) {
    return (
      <div className="p-6 space-y-3">
        <PageHeader title="Аналитика" lead="Не удалось загрузить данные." />
        <div className="pf-block p-5 space-y-2 text-sm">
          <div className="font-medium text-destructive">Ошибка загрузки</div>
          <div className="text-muted-foreground">function: getTeacherAnalytics</div>
          <div className="whitespace-pre-wrap break-words">{(error as any)?.message ?? String(error)}</div>
          <div className="text-xs text-muted-foreground">Действие: убедитесь, что вы авторизованы как преподаватель, и попробуйте ещё раз.</div>
          <button onClick={() => refetch()} className="text-sm underline">Повторить</button>
        </div>
      </div>
    );
  }
  if (!data) return null;
  if ((data as any).total_students === 0) {
    return (
      <>
        <PageHeader title="Аналитика" lead="Сводная картина по всем связанным ученикам." />
        <div className="pf-block p-6 text-sm text-muted-foreground">
          Пока нет связанных учеников. Привяжите ученика в разделе «Ученики», чтобы увидеть аналитику.
        </div>
      </>
    );
  }
  const a = data as any;

  return (
    <>
      <PageHeader title="Аналитика" lead="Сводная картина по всем связанным ученикам." />

      <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <Metric label="Учеников" value={a.total_students} />
        <Metric label="Средний прогресс" value={`${a.avg_mastery}%`} />
        <Metric label="Слабых тем" value={a.weak_topics_total} />
        <Metric label="Ошибок" value={a.mistakes_total} />
        <Metric label="Уроков завершено" value={a.lessons_completed} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="pf-block p-5">
          <h2 className="font-medium mb-3">Требуют внимания</h2>
          {a.needs_attention.length === 0 ? (
            <div className="text-sm text-muted-foreground">Все ученики в норме.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {a.needs_attention.map((n: any) => (
                <li key={n.student_profile_id} className="border-b pb-2">
                  <Link
                    to="/teacher/students/$studentId"
                    params={{ studentId: n.student_profile_id }}
                    className="font-medium hover:underline"
                  >
                    {n.name ?? "—"}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    прогресс {n.avg}% · слабых {n.weak} · {n.reasons.join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pf-block p-5">
          <h2 className="font-medium mb-3">Топ слабых тем</h2>
          {a.top_weak.length === 0 ? (
            <div className="text-sm text-muted-foreground">Слабых тем не найдено.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {a.top_weak.map((t: any) => (
                <li key={t.id} className="border-b pb-2 flex justify-between gap-3">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.subject} · учеников: {t.students}</div>
                  </div>
                  <Badge variant="outline">{t.avg}%</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="pf-block p-4">
      <div className="pf-eyebrow">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  );
}
