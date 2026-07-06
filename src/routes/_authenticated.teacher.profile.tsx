import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getMyTeacherProfile, updateMyTeacherProfile, listMyTeacherStudents } from "@/lib/teacher.functions";
import { PageHeader } from "@/components/oge/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/teacher/profile")({
  component: TeacherProfilePage,
});

function TeacherProfilePage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyTeacherProfile);
  const updFn = useServerFn(updateMyTeacherProfile);
  const listFn = useServerFn(listMyTeacherStudents);

  const { data: profile, isLoading: profileLoading, isError: profileError, error: profileErr, refetch: refetchProfile } = useQuery({ queryKey: ["teacher", "profile"], queryFn: () => getFn(), retry: 1 });
  const { data: list } = useQuery({ queryKey: ["teacher", "students"], queryFn: () => listFn(), retry: 1 });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (profile) setForm({
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

  if (profileLoading) return <div className="p-6 text-sm text-muted-foreground">Загрузка профиля…</div>;
  if (profileError || !profile) {
    return (
      <div className="p-6 space-y-3">
        <PageHeader title="Профиль преподавателя" lead="Не удалось загрузить профиль." />
        <div className="pf-block p-5 space-y-2 text-sm">
          <div className="font-medium text-destructive">Ошибка загрузки</div>
          <div className="text-muted-foreground">function: getMyTeacherProfile</div>
          <div className="whitespace-pre-wrap break-words">
            {(profileErr as any)?.message ?? "Профиль преподавателя не найден и не удалось создать автоматически."}
          </div>
          <div className="text-xs text-muted-foreground">
            Действие: убедитесь, что вы авторизованы. Профиль создастся автоматически при повторной попытке.
          </div>
          <button onClick={() => refetchProfile()} className="text-sm underline">Повторить</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Профиль преподавателя" lead="Ваша информация, специализация и статистика по ученикам." />

      <div className="grid lg:grid-cols-[1.4fr,1fr] gap-6">
        <div className="pf-block p-6 space-y-4">
          {!editing ? (
            <>
              <Row label="Имя" value={profile.display_name ?? "—"} />
              <Row label="Специализация" value={profile.specialization ?? "—"} />
              <Row label="Предметы" value={(profile.subjects ?? []).join(", ") || "—"} />
              <Row label="Опыт (лет)" value={profile.experience_years ?? "—"} />
              <Row label="Часовой пояс" value={profile.timezone ?? "—"} />
              <Row label="Язык" value={profile.language ?? "ru"} />
              <div>
                <div className="text-xs text-muted-foreground mb-1">О себе</div>
                <div className="text-sm whitespace-pre-wrap">{profile.bio ?? "—"}</div>
              </div>
              <Button onClick={() => setEditing(true)}>Редактировать профиль</Button>
            </>
          ) : (
            <div className="space-y-3">
              <Field label="Имя" v={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
              <Field label="Специализация" v={form.specialization} onChange={(v) => setForm({ ...form, specialization: v })} />
              <Field label="Предметы (через запятую)" v={form.subjects} onChange={(v) => setForm({ ...form, subjects: v })} />
              <Field label="Опыт (лет)" v={form.experience_years} onChange={(v) => setForm({ ...form, experience_years: v })} />
              <Field label="Часовой пояс" v={form.timezone} onChange={(v) => setForm({ ...form, timezone: v })} />
              <Field label="Язык" v={form.language} onChange={(v) => setForm({ ...form, language: v })} />
              <div className="space-y-1.5">
                <Label>О себе</Label>
                <Textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditing(false)}>Отмена</Button>
                <Button
                  disabled={upd.isPending}
                  onClick={() =>
                    upd.mutate({
                      display_name: form.display_name || null,
                      specialization: form.specialization || null,
                      bio: form.bio || null,
                      timezone: form.timezone || null,
                      language: form.language || "ru",
                      subjects: String(form.subjects || "").split(",").map((s: string) => s.trim()).filter(Boolean),
                      experience_years: form.experience_years === "" ? null : Number(form.experience_years),
                    })
                  }
                >
                  Сохранить
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="pf-block p-6 space-y-3">
          <div className="pf-eyebrow">Статистика</div>
          <Stat label="Всего учеников" value={students.length} />
          <Stat label="Активных" value={active} />
          <Stat label="Требуют внимания" value={attention} />
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
function Field({ label, v, onChange }: { label: string; v: any; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={v ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
