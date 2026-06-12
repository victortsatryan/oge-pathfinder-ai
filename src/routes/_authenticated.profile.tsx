import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/oge/page-header";
import { ConstructivistIllo } from "@/components/oge/constructivist-illo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import {
  getMyStudentProfile,
  listMyStudentSubjects,
  listSubjects,
  listSubjectPrograms,
  addStudentSubject,
  listTopicProgressBySubject,
  listMyWeakTopics,
  listMyRecentMistakes,
  getStudentProfileAnalytics,
} from "@/lib/student-profile.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const STATUS_LABEL: Record<string, string> = {
  not_started: "не начато",
  weak: "слабая",
  learning: "в работе",
  stable: "стабильно",
  mastered: "освоено",
  needs_review: "на повторение",
};

const MISTAKE_LABEL: Record<string, string> = {
  concept_gap: "пробел в понятии",
  careless_error: "невнимательность",
  calculation_error: "ошибка вычислений",
  grammar_error: "грамматика",
  misread_task: "неверно понял условие",
  no_strategy: "нет стратегии",
  vocabulary_gap: "лексика",
  memory_gap: "память",
  other: "другое",
};

function ProfilePage() {
  const qc = useQueryClient();
  const getProfile = useServerFn(getMyStudentProfile);
  const getSubjects = useServerFn(listMyStudentSubjects);
  const getCatalog = useServerFn(listSubjects);
  const getAnalytics = useServerFn(getStudentProfileAnalytics);
  const getWeak = useServerFn(listMyWeakTopics);
  const getMistakes = useServerFn(listMyRecentMistakes);
  const addSubject = useServerFn(addStudentSubject);

  const profile = useSuspenseQuery({
    queryKey: ["student-profile"],
    queryFn: () => getProfile(),
  });
  const mySubjects = useQuery({
    queryKey: ["student-subjects"],
    queryFn: () => getSubjects(),
  });
  const catalog = useQuery({
    queryKey: ["subjects-catalog"],
    queryFn: () => getCatalog(),
  });
  const analytics = useQuery({
    queryKey: ["student-analytics"],
    queryFn: () => getAnalytics(),
  });
  const weak = useQuery({
    queryKey: ["student-weak"],
    queryFn: () => getWeak(),
  });
  const mistakes = useQuery({
    queryKey: ["student-mistakes"],
    queryFn: () => getMistakes(),
  });

  const taken = new Set((mySubjects.data ?? []).map((s: any) => s.subject?.id));
  const available = (catalog.data ?? []).filter((s: any) => !taken.has(s.id));

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const firstSubjectId =
    selectedSubjectId ?? (mySubjects.data?.[0] as any)?.subject?.id ?? null;

  // Прогресс по темам выбранного предмета
  const getProgress = useServerFn(listTopicProgressBySubject);
  const topicProgress = useQuery({
    queryKey: ["topic-progress-real", firstSubjectId],
    queryFn: () =>
      firstSubjectId
        ? getProgress({ data: { subject_id: firstSubjectId } })
        : Promise.resolve([]),
    enabled: !!firstSubjectId,
  });

  const addMut = useMutation({
    mutationFn: (data: { subject_id: string; program_id?: string | null; goal?: string; target_score?: string }) =>
      addSubject({ data }),
    onSuccess: () => {
      toast.success("Предмет добавлен");
      qc.invalidateQueries({ queryKey: ["student-subjects"] });
      qc.invalidateQueries({ queryKey: ["student-analytics"] });
      qc.invalidateQueries({ queryKey: ["topic-progress-real"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось добавить"),
  });

  const p = profile.data as any;
  const displayName = p?.display_name || "Ученик";

  return (
    <main className="min-h-screen" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-6xl mx-auto px-10 py-10">
        <div className="pf-topbar">
          <Link to="/student" className="pf-crumb hover:text-[color:var(--pf-ink)]">
            <ArrowLeft className="h-3 w-3 inline mr-1" /> к маршруту
          </Link>
          <div className="pf-crumb"><b>Профиль ученика</b> · карта территории</div>
        </div>

        <div className="grid lg:grid-cols-[1.3fr,1fr] gap-12 items-start mb-12">
          <PageHeader
            crumb={<>исследователь {p?.grade ? `· ${p.grade}` : ""}</>}
            title={displayName}
            lead={
              p?.learning_goal ||
              "Учебный профиль — центральная карта подготовки. Здесь живут цели, выбранные предметы, прогресс по темам и слабые места."
            }
          />
          <ConstructivistIllo variant="profile" className="w-full" />
        </div>

        {/* ===== Сводка ===== */}
        <div className="grid sm:grid-cols-4 gap-4 mb-10">
          <Metric label="предметов" value={mySubjects.data?.length ?? 0} />
          <Metric label="слабых тем" value={analytics.data?.weakCount ?? 0} accent />
          <Metric label="на повторение" value={analytics.data?.reviewCount ?? 0} />
          <Metric label="типичных ошибок" value={analytics.data?.mistakesCount ?? 0} />
        </div>

        {/* ===== Мои предметы ===== */}
        <section className="pf-block mb-8">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <p className="pf-eyebrow mb-2">мои предметы</p>
              <h2 className="pf-h2">Карта территорий</h2>
            </div>
            <AddSubjectDialog
              available={available}
              loading={addMut.isPending}
              onAdd={(payload) => addMut.mutateAsync(payload)}
            />
          </div>

          {mySubjects.isLoading ? (
            <p className="text-sm text-[color:var(--pf-muted)]">Загрузка…</p>
          ) : (mySubjects.data ?? []).length === 0 ? (
            <p className="text-sm text-[color:var(--pf-muted)]">
              Пока ни одного предмета не выбрано. Нажмите «Добавить предмет», чтобы
              начать формировать маршрут.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {(mySubjects.data as any[]).map((ss) => {
                const stat = (analytics.data?.bySubject ?? []).find(
                  (b: any) => b.subject_id === ss.subject?.id,
                );
                const active = firstSubjectId === ss.subject?.id;
                return (
                  <button
                    key={ss.id}
                    onClick={() => setSelectedSubjectId(ss.subject?.id)}
                    className={`pf-role-tile text-left ${active ? "ring-2 ring-[color:var(--pf-ink)]" : ""}`}
                  >
                    <p className="pf-eyebrow">{ss.program?.title ? "программа" : (ss.subject?.exam_type ?? "предмет")}</p>
                    <h3 className="pf-h2">{ss.subject?.name}</h3>
                    {ss.program?.title && (
                      <p className="text-[12px] font-mono text-[color:var(--pf-muted)] uppercase tracking-wider">
                        {ss.program.title}
                      </p>
                    )}
                    {ss.goal && (
                      <p className="text-[14px] text-[color:var(--pf-muted)]">
                        Цель: {ss.goal}
                      </p>
                    )}
                    <div className="pf-bar mt-3">
                      <div
                        className="pf-bar__fill"
                        style={{ width: `${stat?.avg ?? 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between font-mono text-[12px] text-[color:var(--pf-muted)] mt-1">
                      <span>{stat?.avg ?? 0}% средний</span>
                      <span>
                        слабых: {stat?.weakCount ?? 0} · тем: {stat?.totalTopics ?? 0}
                      </span>
                    </div>
                    <div className="mt-3">
                      <Link
                        to="/student/subjects/$subjectId"
                        params={{ subjectId: ss.subject?.id }}
                        className="text-[12px] font-mono underline underline-offset-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        открыть карту тем →
                      </Link>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ===== Карта тем по выбранному предмету ===== */}
        {firstSubjectId && (
          <section className="pf-block mb-8">
            <p className="pf-eyebrow mb-2">карта тем</p>
            <h2 className="pf-h2 mb-6">Темы и освоение</h2>
            {topicProgress.isLoading ? (
              <p className="text-sm text-[color:var(--pf-muted)]">Загрузка…</p>
            ) : (topicProgress.data ?? []).length === 0 ? (
              <p className="text-sm text-[color:var(--pf-muted)]">
                Темы для этого предмета ещё не загружены.
              </p>
            ) : (
              <div className="grid gap-3">
                {(topicProgress.data as any[]).map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr,80px,140px] items-center gap-4 py-2 border-b border-[color:var(--pf-divider)]"
                  >
                    <div className="font-medium">{row.topic?.title}</div>
                    <div className="font-mono text-[13px] text-right">
                      {row.mastery_score}%
                    </div>
                    <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] text-right">
                      {STATUS_LABEL[row.status] ?? row.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ===== Слабые темы ===== */}
        <section className="pf-block mb-8">
          <p className="pf-eyebrow mb-2">внимание</p>
          <h2 className="pf-h2 mb-6">Слабые зоны и повторение</h2>
          {(weak.data ?? []).length === 0 ? (
            <p className="text-sm text-[color:var(--pf-muted)]">
              Слабых тем нет — данных пока недостаточно для диагноза. Пройдите диагностику.
            </p>
          ) : (
            <ul className="grid gap-2">
              {(weak.data as any[]).map((w) => (
                <li key={w.id} className="flex items-center gap-3 text-[14px]">
                  <span className="pf-dot pf-dot--cinnabar" />
                  <span className="font-medium">{w.topic?.title}</span>
                  <span className="text-[color:var(--pf-muted)]">
                    · {w.subject?.name}
                  </span>
                  <span className="ml-auto font-mono text-[12px]">
                    {w.mastery_score}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ===== Ошибки ===== */}
        <section className="pf-block mb-8">
          <p className="pf-eyebrow mb-2">журнал</p>
          <h2 className="pf-h2 mb-6">Последние ошибки</h2>
          {(mistakes.data ?? []).length === 0 ? (
            <p className="text-sm text-[color:var(--pf-muted)]">
              Пока пусто. Ошибки будут появляться по мере выполнения заданий.
            </p>
          ) : (
            <ul className="grid gap-3">
              {(mistakes.data as any[]).map((m) => (
                <li
                  key={m.id}
                  className="grid grid-cols-[140px,1fr,120px] gap-4 py-2 border-b border-[color:var(--pf-divider)]"
                >
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)]">
                    {MISTAKE_LABEL[m.mistake_type] ?? m.mistake_type}
                  </span>
                  <span className="text-[14px]">
                    {m.mistake_description || m.topic?.title || "—"}
                  </span>
                  <span className="font-mono text-[11px] text-[color:var(--pf-muted)] text-right">
                    {new Date(m.created_at).toLocaleDateString("ru-RU")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ===== Быстрые действия ===== */}
        <section className="pf-block">
          <p className="pf-eyebrow mb-4">быстрые действия</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline"><Link to="/student/diagnostic">Пройти диагностику</Link></Button>
            <Button asChild variant="outline"><Link to="/student/calendar">Открыть календарь</Link></Button>
            <Button asChild variant="outline"><Link to="/student/progress">Аналитика</Link></Button>
            <Button asChild variant="outline"><Link to="/student/assistant">Спросить AI</Link></Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="pf-block">
      <p className="pf-eyebrow mb-2">{label}</p>
      <div
        className="font-mono text-3xl"
        style={accent ? { color: "var(--pf-cinnabar)" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function AddSubjectDialog({
  available,
  onAdd,
  loading,
}: {
  available: any[];
  onAdd: (data: { subject_id: string; goal?: string; target_score?: string }) => Promise<unknown>;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState<string>("");
  const [goal, setGoal] = useState("");
  const [targetScore, setTargetScore] = useState("");

  const handle = async () => {
    if (!subjectId) return;
    await onAdd({ subject_id: subjectId, goal: goal || undefined, target_score: targetScore || undefined });
    setOpen(false);
    setSubjectId("");
    setGoal("");
    setTargetScore("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" /> Добавить предмет
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить предмет</DialogTitle>
          <DialogDescription>
            Выберите предмет из каталога. Базовые темы будут добавлены автоматически.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Предмет</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Выберите предмет…" /></SelectTrigger>
              <SelectContent>
                {available.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Все доступные предметы уже добавлены.
                  </div>
                ) : (
                  available.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.exam_type ? ` · ${s.exam_type}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Цель</Label>
            <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="например: уверенная четвёрка" />
          </div>
          <div className="grid gap-2">
            <Label>Целевой балл</Label>
            <Input value={targetScore} onChange={(e) => setTargetScore(e.target.value)} placeholder="например: 4 или 28 баллов" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
          <Button onClick={handle} disabled={!subjectId || loading}>
            {loading ? "Добавление…" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
