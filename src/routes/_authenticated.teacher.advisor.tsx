import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import { getTeacherAdvisorOverview } from "@/lib/advisor.functions";

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

  if (isLoading)
    return (
      <div className="pf-reader-wide py-16 text-sm" style={{ color: "var(--pf-muted)" }}>
        Загрузка…
      </div>
    );

  if (isError)
    return (
      <div className="pf-reader-wide py-16 text-sm space-y-3">
        <p style={{ color: "var(--pf-cinnabar)" }}>
          Не удалось загрузить обзор советника.
        </p>
        <p style={{ color: "var(--pf-muted)" }} className="text-xs">
          {String((error as any)?.message ?? "")}
        </p>
        <button className="pf-btn pf-btn--ghost" onClick={() => refetch()}>
          Повторить
        </button>
      </div>
    );

  const d = data as any;

  return (
    <article className="pf-reader-wide pf-rise">
      <div className="pf-section-eyebrow">
        <span className="pf-section-eyebrow__label">
          <b>Советник</b> / аналитика
        </span>
        <span className="pf-section-eyebrow__label">рабочее место методиста</span>
      </div>

      <header className="mb-14">
        <p className="pf-eyebrow mb-4">аналитическая поддержка</p>
        <h1 className="pf-h1" style={{ maxWidth: "20ch" }}>
          Советник
        </h1>
        <p className="pf-lead">
          Собирает данные, подсвечивает закономерности и готовит черновики. Решения остаются за вами.
        </p>
      </header>

      {!d.has_students && (
        <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
          Советник начнёт работать после того, как вы привяжете хотя бы одного ученика.{" "}
          <Link to="/teacher/students" className="underline">
            Перейти к ученикам
          </Link>
          .
        </p>
      )}

      {d.has_students && (
        <div className="grid gap-14">
          {/* Сегодня */}
          <section>
            <SectionEyebrow
              section="01"
              sub="Сегодня и ближайшее"
              mark="ink"
              right={
                <span className="pf-section-eyebrow__label">
                  {d.today.length} событий
                </span>
              }
            />
            {d.today.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
                Ближайших занятий не запланировано.
              </p>
            ) : (
              <ul>
                {d.today.map((l: any) => (
                  <li
                    key={l.id}
                    className="py-3 flex justify-between items-baseline"
                    style={{ borderBottom: "1px solid var(--pf-line)" }}
                  >
                    <span className="text-[14px]">
                      <Link
                        to="/teacher/students/$studentId"
                        params={{ studentId: l.student_profile_id }}
                        className="font-medium hover:underline"
                      >
                        {l.student_name}
                      </Link>{" "}
                      <span style={{ color: "var(--pf-muted)" }}>·</span>{" "}
                      {l.title}
                    </span>
                    <span
                      className="font-mono text-[11px] uppercase tracking-widest whitespace-nowrap"
                      style={{ color: "var(--pf-muted)" }}
                    >
                      {l.lesson_date}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Внимание */}
          <section>
            <SectionEyebrow
              section="02"
              sub="Можно обратить внимание"
              mark="cinnabar"
              right={
                <span className="pf-section-eyebrow__label">
                  {d.attention.length}
                </span>
              }
            />
            {d.attention.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
                Учеников, требующих внимания, по данным не видно.
              </p>
            ) : (
              <ul>
                {d.attention.map((a: any) => (
                  <li
                    key={a.student_profile_id}
                    className="py-4"
                    style={{ borderBottom: "1px solid var(--pf-line)" }}
                  >
                    <div className="flex justify-between items-baseline mb-2">
                      <Link
                        to="/teacher/students/$studentId"
                        params={{ studentId: a.student_profile_id }}
                        className="text-[15px] font-medium hover:underline"
                      >
                        {a.name}
                      </Link>
                      <span
                        className="font-mono text-[11px] uppercase tracking-widest"
                        style={{ color: "var(--pf-muted)" }}
                      >
                        средний {a.avg}%
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {a.reasons.map((r: string, i: number) => (
                        <span
                          key={i}
                          className="font-mono text-[11px] uppercase tracking-widest"
                          style={{ color: "var(--pf-muted)" }}
                        >
                          — {r}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Изменения */}
          <section>
            <SectionEyebrow
              section="03"
              sub="Последние изменения"
              mark="forest"
              right={<span className="pf-section-eyebrow__label">7 дней</span>}
            />
            {d.recent_changes.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
                Пока мало данных для сравнения.
              </p>
            ) : (
              <ul>
                {d.recent_changes.map((c: any, i: number) => (
                  <li
                    key={i}
                    className="py-3 flex justify-between items-baseline"
                    style={{ borderBottom: "1px solid var(--pf-line)" }}
                  >
                    <span className="text-[14px]">
                      <Link
                        to="/teacher/students/$studentId"
                        params={{ studentId: c.student_profile_id }}
                        className="hover:underline"
                      >
                        {c.student_name}
                      </Link>{" "}
                      <span style={{ color: "var(--pf-muted)" }}>·</span>{" "}
                      {c.topic}
                    </span>
                    <span
                      className="font-mono text-[11px] uppercase tracking-widest whitespace-nowrap"
                      style={{ color: "var(--pf-muted)" }}
                    >
                      {c.mastery_score}% · {c.status} ·{" "}
                      {new Date(c.updated_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </article>
  );
}
