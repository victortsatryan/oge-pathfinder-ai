import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import { listMyTeacherStudents } from "@/lib/teacher.functions";

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
    <article className="pf-reader-wide pf-rise">
      <div className="pf-section-eyebrow">
        <span className="pf-section-eyebrow__label">
          <b>Кабинет</b> / преподаватель
        </span>
        <span className="pf-section-eyebrow__label">
          {students.length} учеников · {attention.length} требуют внимания
        </span>
      </div>

      <header className="mb-12">
        <p className="pf-eyebrow mb-4">рабочее место методиста</p>
        <h1 className="pf-h1" style={{ maxWidth: "18ch" }}>
          Кабинет преподавателя
        </h1>
        <p className="pf-lead">
          Прогресс учеников, слабые темы и подсказки советника. Управляйте маршрутами и занятиями.
        </p>
      </header>

      {/* Метрики — редакционные, без карточек */}
      <div className="grid sm:grid-cols-3 gap-x-10 mb-16">
        <Metric label="всего учеников" value={students.length} />
        <Metric label="активных" value={active.length} />
        <Metric label="требуют внимания" value={attention.length} accent />
      </div>

      {/* Ученики */}
      <section className="mb-16">
        <SectionEyebrow
          section="Мои ученики"
          sub="ближайший фокус"
          mark="mustard"
          right={
            <Link
              to="/teacher/students"
              className="pf-section-eyebrow__label hover:text-[color:var(--pf-ink)]"
            >
              все →
            </Link>
          }
        />

        {students.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
            Пока нет учеников.{" "}
            <Link to="/teacher/students" className="underline">
              Привязать ученика
            </Link>
            .
          </p>
        ) : (
          <div>
            {students.slice(0, 6).map((s: any) => (
              <Link
                key={s.link_id}
                to="/teacher/students/$studentId"
                params={{ studentId: s.student?.id ?? "" }}
                className="pf-student-row hover:bg-[color:color-mix(in_oklab,var(--pf-line)_30%,transparent)]"
              >
                <span className="pf-student-row__avatar">
                  {(s.student?.display_name ?? "У")[0]}
                </span>
                <div>
                  <div className="pf-student-row__name">
                    {s.student?.display_name ?? "Без имени"}
                  </div>
                  <div className="pf-student-row__sub">
                    {s.student?.grade ? `${s.student.grade} · ` : ""}
                    прогресс {s.avg_mastery}% · слабых тем {s.weak_count}
                  </div>
                </div>
                <span
                  className="font-mono text-[11px] uppercase tracking-widest"
                  style={{
                    color: s.needs_attention
                      ? "var(--pf-cinnabar)"
                      : "var(--pf-muted)",
                  }}
                >
                  {s.needs_attention ? "внимание" : s.status}
                </span>
                <span
                  className="font-mono text-[11px]"
                  style={{ color: "var(--pf-muted)" }}
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Быстрые действия */}
      <section>
        <SectionEyebrow section="Быстрые действия" mark="ink" />
        <div className="flex flex-wrap gap-3">
          <Link to="/teacher/students" className="pf-btn pf-btn--ghost">
            Список учеников
          </Link>
          <Link to="/teacher/advisor" className="pf-btn pf-btn--ghost">
            Советник
          </Link>
          <Link to="/teacher/analytics" className="pf-btn pf-btn--ghost">
            Аналитика
          </Link>
          <Link to="/teacher/assistant" className="pf-btn pf-btn--ghost">
            AI-помощник
          </Link>
        </div>
      </section>
    </article>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="pf-metric">
      <span className="pf-metric__label">{label}</span>
      <span
        className={`pf-metric__value${accent ? " pf-metric__value--accent" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
