import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/oge/page-header";
import { ConstructivistIllo } from "@/components/oge/constructivist-illo";
import { demoStudents } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/teacher/")({
  component: TeacherHome,
});

function TeacherHome() {
  const students = demoStudents;
  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>Кабинет</b> · преподаватель</div>
        <div className="pf-crumb">{students.length} учеников · 2 маршрута активны</div>
      </div>

      <div className="grid lg:grid-cols-[1.3fr,1fr] gap-12 items-start mb-12">
        <PageHeader
          title="Кабинет"
          lead="Карта учеников и их маршрутов. Открой профиль, чтобы посмотреть слабые темы и рекомендации навигатора."
        />
        <ConstructivistIllo variant="today" className="w-full" />
      </div>

      <div className="grid lg:grid-cols-[1.4fr,1fr] gap-10 items-start">
        <div>
          <div className="flex items-baseline justify-between mb-5">
            <p className="pf-eyebrow">Мои ученики</p>
            <Link to="/teacher/students" className="pf-crumb hover:text-[color:var(--pf-ink)]">все →</Link>
          </div>
          <div className="pf-block">
            {students.map((s) => (
              <Link
                key={s.id}
                to="/teacher/students/$studentId"
                params={{ studentId: s.id }}
                className="pf-student-row"
              >
                <span className="pf-student-row__avatar">
                  {s.first_name[0]}{s.last_name?.[0] ?? ""}
                </span>
                <div>
                  <div className="pf-student-row__name">{s.first_name} {s.last_name ?? ""}</div>
                  <div className="pf-student-row__sub">{s.grade ? `${s.grade} класс · ` : ""}{(s.subjects ?? []).join(", ")}</div>
                </div>
                <div className="pf-chip">маршрут активен</div>
                <span className="pf-crumb">→</span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="pf-eyebrow mb-4">Рекомендации AI</p>
          <div className="pf-ai-block">
            У ученика <b>Анна Петрова</b> выявлен системный пробел по теме «Проценты».
            Рекомендуется включить блок повторения в ближайшее занятие и назначить
            короткий контрольный срез через 3 дня.
          </div>
        </div>
      </div>
    </>
  );
}
