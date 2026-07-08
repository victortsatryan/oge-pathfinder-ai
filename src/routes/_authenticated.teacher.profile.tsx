import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  getMyTeacherProfile,
  updateMyTeacherProfile,
  listMyTeacherStudents,
} from "@/lib/teacher.functions";
import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import { PathyLogo } from "@/components/oge/logo";

export const Route = createFileRoute("/_authenticated/teacher/profile")({
  component: TeacherProfilePage,
});

function TeacherProfilePage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyTeacherProfile);
  const updFn = useServerFn(updateMyTeacherProfile);
  const listFn = useServerFn(listMyTeacherStudents);

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    error: profileErr,
    refetch,
  } = useQuery({ queryKey: ["teacher", "profile"], queryFn: () => getFn(), retry: 1 });
  const { data: list } = useQuery({
    queryKey: ["teacher", "students"],
    queryFn: () => listFn(),
    retry: 1,
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (profile)
      setForm({
        display_name: profile.display_name ?? "",
        specialization: profile.specialization ?? "",
        bio: profile.bio ?? "",
        timezone: profile.timezone ?? "",
        language: profile.language ?? "ru",
        subjects: (profile.subjects ?? []).join(", "),
        experience_years: profile.experience_years ?? "",
      });
  }, [profile]);

  const upd = useMutation({
    mutationFn: (payload: any) => updFn({ data: payload }),
    onSuccess: () => {
      toast.success("Профиль обновлён");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["teacher", "profile"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Ошибка сохранения"),
  });

  const students = (list?.students ?? []) as any[];
  const active = students.filter((s) => s.status === "active").length;
  const attention = students.filter((s) => s.needs_attention).length;

  if (profileLoading) {
    return (
      <div className="pf-reader-wide pf-rise">
        <p className="pf-eyebrow">загрузка профиля…</p>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <article className="pf-reader-wide pf-rise">
        <div className="pf-section-eyebrow">
          <span className="pf-section-eyebrow__label">
            <b>Профиль</b> / ошибка
          </span>
        </div>
        <h1 className="pf-h1 mb-4" style={{ maxWidth: "18ch" }}>
          Не удалось загрузить профиль
        </h1>
        <p className="pf-lead mb-8">
          {(profileErr as any)?.message ??
            "Профиль преподавателя не найден и не удалось создать автоматически."}
        </p>
        <button className="pf-btn pf-btn--ghost" onClick={() => refetch()}>
          Повторить
        </button>
      </article>
    );
  }

  return (
    <article className="pf-reader-wide pf-rise">
      <div className="pf-section-eyebrow">
        <span className="pf-section-eyebrow__label inline-flex items-center gap-3">
          <PathyLogo size="sm" />
          <span>/ профиль · преподаватель</span>
        </span>
        <span className="pf-section-eyebrow__label">
          {students.length} учеников · {attention} требуют внимания
        </span>
      </div>

      <header className="mb-12">
        <p className="pf-eyebrow mb-4">личное дело</p>
        <h1 className="pf-h1" style={{ maxWidth: "18ch" }}>
          {(() => {
            const n = profile.display_name || "Преподаватель";
            const chars = Array.from(n);
            return (
              <>
                {chars.slice(0, -1).join("")}
                <span style={{ color: "var(--pf-mustard)" }}>{chars.slice(-1).join("")}</span>
              </>
            );
          })()}
        </h1>
        <span
          aria-hidden
          className="block mt-4"
          style={{ width: 56, height: 2, background: "var(--pf-cinnabar)" }}
        />
        {profile.specialization ? (
          <p className="pf-lead mt-6">{profile.specialization}</p>
        ) : (
          <p className="pf-lead mt-6">
            Ваша информация, специализация и статистика по ученикам. Всё, что видит
            платформа, когда рекомендует ученикам занятия.
          </p>
        )}
      </header>

      {/* Метрики */}
      <div className="grid sm:grid-cols-3 gap-x-10 mb-16">
        <Metric label="всего учеников" value={students.length} />
        <Metric label="активных" value={active} />
        <Metric label="требуют внимания" value={attention} accent />
      </div>

      {/* Данные */}
      <section className="mb-16">
        <SectionEyebrow
          section="Данные"
          sub={editing ? "редактирование" : "просмотр"}
          mark="mustard"
          right={
            !editing ? (
              <button
                className="pf-section-eyebrow__label hover:text-[color:var(--pf-ink)]"
                onClick={() => setEditing(true)}
              >
                редактировать →
              </button>
            ) : null
          }
        />

        {!editing ? (
          <dl>
            <Row label="Имя" value={profile.display_name ?? "—"} />
            <Row label="Специализация" value={profile.specialization ?? "—"} />
            <Row
              label="Предметы"
              value={(profile.subjects ?? []).join(", ") || "—"}
            />
            <Row label="Опыт (лет)" value={profile.experience_years ?? "—"} />
            <Row label="Часовой пояс" value={profile.timezone ?? "—"} />
            <Row label="Язык" value={profile.language ?? "ru"} />
            <Row label="О себе" value={profile.bio ?? "—"} multiline />
          </dl>
        ) : (
          <div className="grid gap-5">
            <Field
              label="Имя"
              value={form.display_name}
              onChange={(v) => setForm({ ...form, display_name: v })}
            />
            <Field
              label="Специализация"
              value={form.specialization}
              onChange={(v) => setForm({ ...form, specialization: v })}
            />
            <Field
              label="Предметы (через запятую)"
              value={form.subjects}
              onChange={(v) => setForm({ ...form, subjects: v })}
            />
            <Field
              label="Опыт (лет)"
              value={form.experience_years}
              onChange={(v) => setForm({ ...form, experience_years: v })}
            />
            <Field
              label="Часовой пояс"
              value={form.timezone}
              onChange={(v) => setForm({ ...form, timezone: v })}
            />
            <Field
              label="Язык"
              value={form.language}
              onChange={(v) => setForm({ ...form, language: v })}
            />
            <div className="grid gap-2">
              <label className="pf-section-eyebrow__label">О себе</label>
              <textarea
                rows={4}
                value={form.bio ?? ""}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="pf-input-line"
                style={{ borderBottomWidth: 1, resize: "vertical", minHeight: 88 }}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                className="pf-btn pf-btn--accent"
                disabled={upd.isPending}
                onClick={() =>
                  upd.mutate({
                    display_name: form.display_name || null,
                    specialization: form.specialization || null,
                    bio: form.bio || null,
                    timezone: form.timezone || null,
                    language: form.language || "ru",
                    subjects: String(form.subjects || "")
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean),
                    experience_years:
                      form.experience_years === "" ? null : Number(form.experience_years),
                  })
                }
              >
                {upd.isPending ? "Сохранение…" : "Сохранить"}
              </button>
              <button
                className="pf-btn pf-btn--ghost"
                onClick={() => setEditing(false)}
                disabled={upd.isPending}
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </section>
    </article>
  );
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value: any;
  multiline?: boolean;
}) {
  return (
    <div className="pf-def">
      <dt>{label}</dt>
      <dd style={multiline ? { whiteSpace: "pre-wrap" } : undefined}>{value}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <label className="pf-section-eyebrow__label">{label}</label>
      <input
        className="pf-input-line"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
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
