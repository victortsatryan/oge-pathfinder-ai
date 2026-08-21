import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import {
  linkStudent,
  updateLinkStatus,
  listAvailableStudents,
} from "@/lib/teacher.functions";
import { listQuery } from "@/lib/query/defaults";
import { teacherRepo } from "@/lib/repositories/teacher.repository";
import { isDevOpenAccess } from "@/lib/admin-access";

export const Route = createFileRoute("/_authenticated/teacher/students/")({
  component: StudentsPage,
});

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "attention", label: "Требуют внимания" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function StudentsPage() {
  const qc = useQueryClient();
  const linkFn = useServerFn(linkStudent);
  const statusFn = useServerFn(updateLinkStatus);
  const availFn = useServerFn(listAvailableStudents);

  const devMode = typeof window !== "undefined" && isDevOpenAccess();
  const { data: students } = useQuery(
    listQuery(["teacher", "students"], () => teacherRepo.students()),
  );
  const { data: avail } = useQuery({
    queryKey: ["teacher", "available-students"],
    queryFn: () => availFn(),
    enabled: devMode,
  });

  const [filter, setFilter] = useState<FilterKey>("all");
  const [studentId, setStudentId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const linkMut = useMutation({
    mutationFn: (id: string) => linkFn({ data: { student_profile_id: id } }),
    onSuccess: () => {
      setStudentId("");
      setErr(null);
      toast.success("Ученик привязан");
      qc.invalidateQueries({ queryKey: ["teacher", "students"] });
      qc.invalidateQueries({ queryKey: ["teacher", "available-students"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Не удалось привязать ученика.";
      setErr(msg);
      toast.error(msg);
    },
  });

  const statusMut = useMutation({
    mutationFn: (vars: {
      link_id: string;
      status: "active" | "paused" | "archived";
    }) => statusFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher", "students"] }),
  });

  const filtered = students.filter((s) => {
    if (filter === "active") return s.status === "active";
    if (filter === "attention") return s.needs_attention;
    return true;
  });

  return (
    <article className="pf-reader-wide pf-rise">
      <div className="pf-section-eyebrow">
        <span className="pf-section-eyebrow__label">
          <b>Ученики</b> / {students.length}
        </span>
      </div>

      <header className="mb-12">
        <p className="pf-eyebrow mb-4">кабинет</p>
        <h1 className="pf-h1">Мои ученики</h1>
        <p className="pf-lead">
          Привяжите ученика по ID его профиля — карточка появится в списке ниже.
        </p>
      </header>

      {/* Привязка */}
      <section className="mb-12">
        <SectionEyebrow section="01" sub="Привязать ученика" mark="mustard" />
        <div className="grid grid-cols-[1fr,auto] gap-6 items-end">
          <div>
            <label
              htmlFor="sid"
              className="block pf-eyebrow mb-2"
            >
              ID профиля ученика
            </label>
            <input
              id="sid"
              className="pf-input-line"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="uuid…"
            />
          </div>
          <button
            className="pf-btn pf-btn--accent"
            disabled={!studentId || linkMut.isPending}
            onClick={() => linkMut.mutate(studentId.trim())}
          >
            Привязать
          </button>
        </div>
        {err && (
          <p className="mt-3 text-sm" style={{ color: "var(--pf-cinnabar)" }}>
            {err}
          </p>
        )}
        <p className="mt-3 text-[12px]" style={{ color: "var(--pf-muted)" }}>
          Ученик может найти ID в своём профиле и передать преподавателю.
        </p>
      </section>

      {devMode && (avail?.students?.length ?? 0) > 0 && (
        <section className="mb-12">
          <SectionEyebrow
            section="dev"
            sub="Тестовые ученики"
            mark="forest"
          />
          <ul>
            {(avail?.students ?? []).map((s: { id: string; display_name?: string | null; grade?: string | null; learning_goal?: string | null; target_exam?: string | null; linked?: boolean }) => (
              <li
                key={s.id}
                className="py-3 grid grid-cols-[1fr,auto] gap-4 items-center"
                style={{ borderBottom: "1px solid var(--pf-line)" }}
              >
                <div>
                  <div className="text-[14px] font-medium">
                    {s.display_name ?? "Без имени"}
                  </div>
                  <div
                    className="mt-1 font-mono text-[11px] uppercase tracking-widest"
                    style={{ color: "var(--pf-muted)" }}
                  >
                    {s.grade ?? "—"} · {s.learning_goal ?? "—"} ·{" "}
                    {s.target_exam ?? "—"}
                  </div>
                </div>
                {s.linked ? (
                  <span
                    className="font-mono text-[11px] uppercase tracking-widest"
                    style={{ color: "var(--pf-muted)" }}
                  >
                    уже привязан
                  </span>
                ) : (
                  <button
                    className="pf-btn pf-btn--ghost"
                    disabled={linkMut.isPending}
                    onClick={() => linkMut.mutate(s.id)}
                  >
                    Привязать
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Список */}
      <section>
        <SectionEyebrow
          section="02"
          sub="Список"
          mark="ink"
          right={
            <div className="flex gap-4">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="font-mono text-[11px] uppercase tracking-widest"
                  style={{
                    color:
                      filter === f.key ? "var(--pf-ink)" : "var(--pf-muted)",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        />

        {filtered.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
            Никого по этому фильтру.
          </p>
        ) : (
          <div>
            {filtered.map((s) => {
              const studentId = s.student?.id ?? s.student_profile_id ?? null;
              const name = s.student?.display_name?.trim() || "Ученик без имени";
              const body = (
                <>
                  <span className="pf-student-row__avatar">{name[0]}</span>
                  <div>
                    <div className="pf-student-row__name">{name}</div>
                    <div className="pf-student-row__sub">
                      прогресс {s.avg_mastery}% · слабых тем {s.weak_count}
                      {s.last_active &&
                        ` · посл. активность ${new Date(s.last_active).toLocaleDateString()}`}
                    </div>
                  </div>
                </>
              );
              return (
              <div key={s.link_id} className="pf-student-row">
                {studentId ? (
                  <Link
                    to="/teacher/students/$studentId"
                    params={{ studentId }}
                    className="contents"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
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
                <select
                  className="font-mono text-[11px] uppercase tracking-widest bg-transparent px-2 py-1"
                  style={{
                    border: "1px solid var(--pf-line-strong)",
                    color: "var(--pf-muted)",
                  }}
                  value={s.status ?? "active"}
                  onChange={(e) =>
                    statusMut.mutate({
                      link_id: s.link_id,
                      status: e.target.value as "active" | "paused" | "archived",
                    })
                  }
                >
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="archived">archived</option>
                </select>
              </div>
              );
            })}
          </div>
        )}
      </section>
    </article>
  );
}
