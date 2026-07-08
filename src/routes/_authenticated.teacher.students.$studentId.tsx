import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, StickyNote } from "lucide-react";

import {
  getTeacherStudentDetail,
  createTeacherNote,
} from "@/lib/teacher.functions";
import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import { AdvisorPanel } from "@/components/oge/advisor-panel";

export const Route = createFileRoute("/_authenticated/teacher/students/$studentId")({
  component: StudentDetail,
});

const TABS = [
  { key: "overview", label: "Обзор" },
  { key: "progress", label: "Прогресс" },
  { key: "mistakes", label: "Ошибки" },
  { key: "path", label: "Маршрут" },
  { key: "lessons", label: "Занятия" },
  { key: "notes", label: "Заметки" },
  { key: "advisor", label: "Советник" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function StudentDetail() {
  const { studentId } = Route.useParams();
  const qc = useQueryClient();
  const detailFn = useServerFn(getTeacherStudentDetail);
  const noteFn = useServerFn(createTeacherNote);

  const [tab, setTab] = useState<TabKey>("overview");

  const { data, isLoading, error } = useQuery({
    queryKey: ["teacher", "student", studentId],
    queryFn: () => detailFn({ data: { student_profile_id: studentId } }),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["teacher", "student", studentId] });

  const noteMut = useMutation({
    mutationFn: (vars: { content: string; note_type: any }) =>
      noteFn({ data: { student_profile_id: studentId, ...vars } }),
    onSuccess: invalidate,
  });

  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<string>("observation");

  if (isLoading)
    return (
      <div className="pf-reader-wide py-16 text-sm" style={{ color: "var(--pf-muted)" }}>
        Загрузка…
      </div>
    );
  if (error || !data)
    return (
      <div className="pf-reader-wide py-16 text-sm" style={{ color: "var(--pf-cinnabar)" }}>
        Нет доступа или ученик не найден.
      </div>
    );

  const d = data as any;
  const upcoming = (d.lessons ?? []).filter((l: any) => l.status !== "completed");
  const activePath =
    (d.paths ?? []).find((p: any) => p.status === "active") ?? d.paths?.[0];

  return (
    <article className="pf-reader-wide pf-rise">
      <div className="pf-section-eyebrow">
        <Link
          to="/teacher/students"
          className="pf-section-eyebrow__label inline-flex items-center gap-2 hover:text-[color:var(--pf-ink)]"
        >
          <ArrowLeft className="h-3 w-3" /> <b>К списку учеников</b>
        </Link>
        <span className="pf-section-eyebrow__label">
          {d.profile?.grade ?? ""}
          {d.profile?.target_exam ? ` · ${d.profile.target_exam}` : ""}
        </span>
      </div>

      <header className="mb-10">
        <p className="pf-eyebrow mb-4">карточка ученика</p>
        <h1 className="pf-h1">{d.profile?.display_name ?? "Без имени"}</h1>
        {d.profile?.learning_goal ? (
          <p className="pf-lead">{d.profile.learning_goal}</p>
        ) : null}
      </header>

      <nav className="pf-tabs" aria-label="Разделы карточки">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pf-tabs__item ${tab === t.key ? "is-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-4">
          <dl>
            <DefRow label="Цель" v={d.profile?.learning_goal ?? "—"} />
            <DefRow label="Экзамен" v={d.profile?.target_exam ?? "—"} />
            <DefRow label="Класс" v={d.profile?.grade ?? "—"} />
            <DefRow
              label="Предметы"
              v={
                (d.subjects ?? [])
                  .map((s: any) => s.subject?.name)
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <DefRow
              label="Слабых тем"
              v={String(
                (d.progress ?? []).filter(
                  (p: any) => (p.mastery_score ?? 0) < 50,
                ).length,
              )}
            />
            <DefRow label="Ошибок" v={String(d.mistakes.length)} />
            <DefRow
              label="Ближайшее занятие"
              v={upcoming[0] ? `${upcoming[0].lesson_date} · ${upcoming[0].title}` : "—"}
            />
            <DefRow label="Активный маршрут" v={activePath?.title ?? "—"} />
          </dl>

          <div>
            <p className="pf-eyebrow mb-4">свежие ошибки</p>
            {d.mistakes.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
                Ошибки пока не зафиксированы.
              </p>
            ) : (
              <ul>
                {d.mistakes.slice(0, 5).map((m: any) => (
                  <li
                    key={m.id}
                    className="py-3"
                    style={{ borderBottom: "1px solid var(--pf-line)" }}
                  >
                    <div className="text-[14px] font-medium">
                      {m.mistake_type ?? "ошибка"}
                    </div>
                    <div
                      className="mt-1 font-mono text-[11px] uppercase tracking-widest"
                      style={{ color: "var(--pf-muted)" }}
                    >
                      {new Date(m.created_at).toLocaleDateString()} ·{" "}
                      {m.source ?? "—"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "progress" && (
        <div>
          {d.progress.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
              Данных о прогрессе пока нет.
            </p>
          ) : (
            <ul>
              {d.progress.map((p: any) => (
                <li
                  key={p.topic_id}
                  className="py-4"
                  style={{ borderBottom: "1px solid var(--pf-line)" }}
                >
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[14px]">{p.topic?.title ?? "—"}</span>
                    <span
                      className="font-mono text-[11px] uppercase tracking-widest"
                      style={{ color: "var(--pf-muted)" }}
                    >
                      {p.status} · {p.mastery_score ?? 0}%
                    </span>
                  </div>
                  <div className="pf-bar">
                    <div
                      className={`pf-bar__fill ${
                        (p.mastery_score ?? 0) < 30
                          ? "pf-bar__fill--cinnabar"
                          : (p.mastery_score ?? 0) < 60
                            ? "pf-bar__fill--mustard"
                            : ""
                      }`}
                      style={{ width: `${p.mastery_score ?? 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "mistakes" && (
        <div>
          {d.mistakes.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
              Ошибки пока не зафиксированы.
            </p>
          ) : (
            <ul>
              {d.mistakes.map((m: any) => (
                <li
                  key={m.id}
                  className="py-4"
                  style={{ borderBottom: "1px solid var(--pf-line)" }}
                >
                  <div className="text-[14px] font-medium">
                    {m.mistake_type ?? "ошибка"}
                  </div>
                  <div
                    className="mt-1 font-mono text-[11px] uppercase tracking-widest"
                    style={{ color: "var(--pf-muted)" }}
                  >
                    {new Date(m.created_at).toLocaleString()} · источник:{" "}
                    {m.source ?? "—"}
                  </div>
                  {m.mistake_description && (
                    <p
                      className="mt-2 text-[13px] leading-relaxed"
                      style={{ color: "var(--pf-muted)" }}
                    >
                      {m.mistake_description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "path" && (
        <div>
          {d.paths.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
              Маршрут ученика ещё не сформирован.
            </p>
          ) : (
            <ul>
              {d.paths.map((p: any) => (
                <li
                  key={p.id}
                  className="py-4 flex justify-between items-baseline"
                  style={{ borderBottom: "1px solid var(--pf-line)" }}
                >
                  <div>
                    <div className="text-[15px] font-medium">{p.title}</div>
                    <div
                      className="mt-1 text-[13px]"
                      style={{ color: "var(--pf-muted)" }}
                    >
                      {p.description ?? p.goal ?? "—"}
                    </div>
                  </div>
                  <span
                    className="font-mono text-[11px] uppercase tracking-widest whitespace-nowrap"
                    style={{ color: "var(--pf-muted)" }}
                  >
                    {p.status} · {p.generated_by}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "lessons" && (
        <div>
          {d.lessons.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
              Занятий пока нет.
            </p>
          ) : (
            <ul>
              {d.lessons.map((l: any) => (
                <li
                  key={l.id}
                  className="py-3 flex justify-between items-baseline"
                  style={{ borderBottom: "1px solid var(--pf-line)" }}
                >
                  <Link
                    to="/lesson/$lessonId"
                    params={{ lessonId: l.id }}
                    className="text-[14px] hover:underline"
                  >
                    {l.title}
                  </Link>
                  <span
                    className="font-mono text-[11px] uppercase tracking-widest"
                    style={{ color: "var(--pf-muted)" }}
                  >
                    {l.lesson_date} · {l.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div>
          <div className="mb-8">
            <label className="pf-eyebrow block mb-3">новая заметка</label>
            <div className="flex flex-wrap gap-3 mb-3">
              {[
                { v: "observation", l: "Наблюдение" },
                { v: "lesson", l: "По занятию" },
                { v: "diagnostic", l: "По диагностике" },
                { v: "recommendation", l: "Рекомендация" },
                { v: "parent_note", l: "Родителю" },
                { v: "other", l: "Другое" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setNoteType(o.v)}
                  className="text-[11px] font-mono uppercase tracking-widest px-3 py-1"
                  style={{
                    border: "1px solid var(--pf-line-strong)",
                    background:
                      noteType === o.v ? "var(--pf-ink)" : "transparent",
                    color:
                      noteType === o.v ? "var(--pf-paper)" : "var(--pf-muted)",
                  }}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Заметка по ученику…"
              className="w-full bg-transparent p-3 text-[14px]"
              style={{ border: "1px solid var(--pf-line-strong)" }}
            />
            <div className="flex justify-end mt-3">
              <button
                disabled={!noteText.trim() || noteMut.isPending}
                onClick={() => {
                  noteMut.mutate({
                    content: noteText.trim(),
                    note_type: noteType,
                  });
                  setNoteText("");
                }}
                className="pf-btn pf-btn--accent"
              >
                <StickyNote className="h-4 w-4" /> Сохранить
              </button>
            </div>
          </div>

          <ul>
            {d.notes.length === 0 && (
              <li className="text-sm" style={{ color: "var(--pf-muted)" }}>
                Заметок пока нет.
              </li>
            )}
            {d.notes.map((n: any) => (
              <li
                key={n.id}
                className="py-4"
                style={{ borderBottom: "1px solid var(--pf-line)" }}
              >
                <div
                  className="font-mono text-[11px] uppercase tracking-widest mb-1"
                  style={{ color: "var(--pf-muted)" }}
                >
                  {new Date(n.created_at).toLocaleString()} · {n.note_type}
                </div>
                <div className="text-[14px] leading-relaxed">{n.content}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "advisor" && <AdvisorPanel studentProfileId={studentId} />}
    </article>
  );
}

function DefRow({ label, v }: { label: string; v: string }) {
  return (
    <div className="pf-def">
      <dt>{label}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
