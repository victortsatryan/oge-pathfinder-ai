import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { listMyTeacherStudents } from "@/lib/teacher.functions";
import { PageHeader } from "@/components/oge/page-header";

export const Route = createFileRoute("/_authenticated/teacher/")({
  component: TeacherDashboard,
});

function TeacherDashboard() {
  const fn = useServerFn(listMyTeacherStudents);
  const { data } = useQuery({
    queryKey: ["teacher", "students"],
    queryFn: () => fn(),
  });

  const students = (data?.students ?? []) as any[];
  const active = students.filter((s: any) => s.status === "active");
  const attention = students.filter((s: any) => s.needs_attention);

  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>Кабинет</b> · преподаватель</div>
        <div className="pf-crumb">{students.length} учеников · {attention.length} требуют внимания</div>
      </div>

      <PageHeader
        title="Кабинет преподавателя"
        lead="Видите учеников, прогресс, слабые темы и подсказки AI. Управляйте маршрутами и занятиями."
      />

      <div className="grid lg:grid-cols-3 gap-6 mb-10">
        <StatCard label="Всего учеников" value={students.length} />
        <StatCard label="Активных" value={active.length} />
        <StatCard label="Требуют внимания" value={attention.length} accent />
      </div>

      <div className="grid lg:grid-cols-[1.4fr,1fr] gap-10 items-start">
        <div>
          <div className="flex items-baseline justify-between mb-5">
            <p className="pf-eyebrow">Мои ученики</p>
            <Link to="/teacher/students" className="pf-crumb hover:text-[color:var(--pf-ink)]">все →</Link>
          </div>
          <div className="pf-block">
            {students.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">
                Пока нет учеников.{" "}
                <Link to="/teacher/students" className="underline">Привязать ученика</Link>.
              </div>
            )}
            {students.slice(0, 6).map((s) => (
              <Link
                key={s.link_id}
                to="/teacher/students/$studentId"
                params={{ studentId: s.student?.id ?? "" }}
                className="pf-student-row"
              >
                <span className="pf-student-row__avatar">
                  {(s.student?.display_name ?? "У")[0]}
                </span>
                <div>
                  <div className="pf-student-row__name">{s.student?.display_name ?? "Без имени"}</div>
                  <div className="pf-student-row__sub">
                    {s.student?.grade ? `${s.student.grade} · ` : ""}
                    прогресс {s.avg_mastery}% · слабых тем {s.weak_count}
                  </div>
                </div>
                <div className="pf-chip">{s.needs_attention ? "внимание" : s.status}</div>
                <span className="pf-crumb">→</span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="pf-eyebrow mb-4">Быстрые действия</p>
          <div className="pf-block p-5 space-y-3 text-sm">
            <Link to="/teacher/students" className="block hover:underline">→ Открыть список учеников</Link>
            <Link to="/teacher/assistant" className="block hover:underline">→ AI-помощник преподавателя</Link>
            <Link to="/teacher/analytics" className="block hover:underline">→ Сводная аналитика</Link>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`pf-block p-5 ${accent ? "border-[color:var(--pf-accent,#e11d48)]" : ""}`}>
      <div className="pf-eyebrow">{label}</div>
      <div className="text-4xl font-semibold mt-2">{value}</div>
    </div>
  );
}
