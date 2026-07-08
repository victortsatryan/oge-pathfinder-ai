import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { SectionEyebrow } from "@/components/oge/section-eyebrow";
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

export const Route = createFileRoute("/_authenticated/student/profile")({
  component: StudentProfilePage,
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

function StudentProfilePage() {
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
    mutationFn: (data: {
      subject_id: string;
      program_id?: string | null;
      goal?: string;
      target_score?: string;
    }) => addSubject({ data }),
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
      <div className="max-w-5xl mx-auto px-10 py-14 pf-rise">
        <SectionEyebrow section="Pathy" sub="профиль ученика" />

        <header className="mt-10 mb-14 max-w-3xl">
          <p className="pf-eyebrow mb-3">
            исследователь{p?.grade ? ` · ${p.grade}` : ""}
          </p>
          <h1 className="pf-h1" style={{ maxWidth: "18ch" }}>
            {displayName}
          </h1>
          <p className="pf-lead mt-4">
            {p?.learning_goal ||
              "Учебный профиль — карта территории. Здесь живут цели, выбранные предметы, прогресс по темам и слабые места."}
          </p>
        </header>

        {/* Сводка */}
        <section className="mb-16">
          <SectionEyebrow section="сводка" sub="ключевые числа" />
          <dl className="mt-6 grid sm:grid-cols-4 gap-0 border-t border-[color:var(--pf-line-strong)]">
            <Metric label="предметов" value={mySubjects.data?.length ?? 0} />
            <Metric label="слабых тем" value={analytics.data?.weakCount ?? 0} accent />
            <Metric label="на повторение" value={analytics.data?.reviewCount ?? 0} />
            <Metric label="ошибок" value={analytics.data?.mistakesCount ?? 0} />
          </dl>
        </section>

        {/* Предметы */}
        <section className="mb-16">
          <SectionEyebrow
            section="мои предметы"
            sub="карта территорий"
            right={
              <AddSubjectDialog
                available={available}
                loading={addMut.isPending}
                onAdd={(payload) => addMut.mutateAsync(payload)}
              />
            }
          />
          {mySubjects.isLoading ? (
            <p className="mt-6 text-sm text-[color:var(--pf-muted)]">Загрузка…</p>
          ) : (mySubjects.data ?? []).length === 0 ? (
            <p className="mt-6 text-sm text-[color:var(--pf-muted)]">
              Пока ни одного предмета. Нажмите «Добавить предмет», чтобы начать
              формировать маршрут.
            </p>
          ) : (
            <ul className="mt-6 border-t border-[color:var(--pf-line-strong)]">
              {(mySubjects.data as any[]).map((ss) => {
                const stat = (analytics.data?.bySubject ?? []).find(
                  (b: any) => b.subject_id === ss.subject?.id,
                );
                const active = firstSubjectId === ss.subject?.id;
                return (
                  <li
                    key={ss.id}
                    className="border-b border-[color:var(--pf-line)]"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedSubjectId(ss.subject?.id)}
                      className={`w-full text-left grid grid-cols-[40px,1fr,220px,160px] items-center gap-6 py-5 px-2 -mx-2 transition-colors hover:bg-[color:color-mix(in_oklab,var(--pf-line)_25%,transparent)] ${
                        active ? "bg-[color:color-mix(in_oklab,var(--pf-mustard)_10%,transparent)]" : ""
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: active
                            ? "var(--pf-mustard)"
                            : "var(--pf-line-strong)",
                        }}
                      />
                      <div>
                        <p className="pf-eyebrow mb-1">
                          {ss.program?.title
                            ? "программа"
                            : ss.subject?.exam_type ?? "предмет"}
                        </p>
                        <h3 className="pf-h3">{ss.subject?.name}</h3>
                        {ss.goal && (
                          <p className="text-[13px] text-[color:var(--pf-muted)] mt-1">
                            Цель: {ss.goal}
                          </p>
                        )}
                      </div>
                      <div>
                        <div className="pf-bar">
                          <div
                            className="pf-bar__fill"
                            style={{ width: `${stat?.avg ?? 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between font-mono text-[11px] text-[color:var(--pf-muted)] mt-1">
                          <span>{stat?.avg ?? 0}%</span>
                          <span>
                            слабых {stat?.weakCount ?? 0} · тем {stat?.totalTopics ?? 0}
                          </span>
                        </div>
                      </div>
                      <Link
                        to="/student/subjects/$subjectId"
                        params={{ subjectId: ss.subject?.id }}
                        className="justify-self-end text-[12px] font-mono underline underline-offset-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        открыть карту тем →
                      </Link>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Темы */}
        {firstSubjectId && (
          <section className="mb-16">
            <SectionEyebrow section="карта тем" sub="темы и освоение" />
            {topicProgress.isLoading ? (
              <p className="mt-6 text-sm text-[color:var(--pf-muted)]">Загрузка…</p>
            ) : (topicProgress.data ?? []).length === 0 ? (
              <p className="mt-6 text-sm text-[color:var(--pf-muted)]">
                Темы для этого предмета ещё не загружены.
              </p>
            ) : (
              <ul className="mt-6 border-t border-[color:var(--pf-line-strong)]">
                {(topicProgress.data as any[]).map((row) => (
                  <li
                    key={row.id}
                    className="grid grid-cols-[1fr,80px,160px] items-center gap-6 py-3 border-b border-[color:var(--pf-line)]"
                  >
                    <span className="text-[14px]">{row.topic?.title}</span>
                    <span className="font-mono text-[13px] text-right">
                      {row.mastery_score}%
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] text-right">
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Слабые темы */}
        <section className="mb-16">
          <SectionEyebrow section="внимание" sub="слабые зоны" mark="cinnabar" />
          {(weak.data ?? []).length === 0 ? (
            <p className="mt-6 text-sm text-[color:var(--pf-muted)]">
              Слабых тем нет. Пройдите диагностику, чтобы получить срез.
            </p>
          ) : (
            <ul className="mt-6 border-t border-[color:var(--pf-line-strong)]">
              {(weak.data as any[]).map((w) => (
                <li
                  key={w.id}
                  className="grid grid-cols-[16px,1fr,200px,80px] items-center gap-4 py-3 border-b border-[color:var(--pf-line)]"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: "var(--pf-cinnabar)" }}
                  />
                  <span className="text-[14px] font-medium">{w.topic?.title}</span>
                  <span className="text-[12px] text-[color:var(--pf-muted)]">
                    {w.subject?.name}
                  </span>
                  <span className="text-right font-mono text-[12px]">
                    {w.mastery_score}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Ошибки */}
        <section className="mb-16">
          <SectionEyebrow section="журнал" sub="последние ошибки" />
          {(mistakes.data ?? []).length === 0 ? (
            <p className="mt-6 text-sm text-[color:var(--pf-muted)]">
              Пока пусто. Ошибки будут появляться по мере выполнения заданий.
            </p>
          ) : (
            <ul className="mt-6 border-t border-[color:var(--pf-line-strong)]">
              {(mistakes.data as any[]).map((m) => (
                <li
                  key={m.id}
                  className="grid grid-cols-[160px,1fr,120px] gap-4 py-3 border-b border-[color:var(--pf-line)]"
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

        {/* Быстрые действия */}
        <section>
          <SectionEyebrow section="быстрые действия" />
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/student/diagnostic">Пройти диагностику</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/student/calendar">Открыть календарь</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/student/progress">Аналитика</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/student/assistant">Спросить AI</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
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
    <div className="px-5 py-6 border-b border-r border-[color:var(--pf-line)] last:border-r-0">
      <dt className="pf-eyebrow mb-2">{label}</dt>
      <dd
        className="font-mono text-3xl"
        style={accent ? { color: "var(--pf-cinnabar)" } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function AddSubjectDialog({
  available,
  onAdd,
  loading,
}: {
  available: any[];
  onAdd: (data: {
    subject_id: string;
    program_id?: string | null;
    goal?: string;
    target_score?: string;
  }) => Promise<unknown>;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState<string>("");
  const [programId, setProgramId] = useState<string>("none");
  const [goal, setGoal] = useState("");
  const [targetScore, setTargetScore] = useState("");
  const [filter, setFilter] = useState("");

  const getPrograms = useServerFn(listSubjectPrograms);
  const programs = useQuery({
    queryKey: ["subject-programs", subjectId],
    queryFn: () =>
      subjectId
        ? getPrograms({ data: { subject_id: subjectId } })
        : Promise.resolve([]),
    enabled: !!subjectId,
  });

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q) ||
        s.exam_type?.toLowerCase().includes(q),
    );
  }, [available, filter]);

  const handle = async () => {
    if (!subjectId) return;
    await onAdd({
      subject_id: subjectId,
      program_id: programId !== "none" ? programId : null,
      goal: goal || undefined,
      target_score: targetScore || undefined,
    });
    setOpen(false);
    setSubjectId("");
    setProgramId("none");
    setGoal("");
    setTargetScore("");
    setFilter("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Добавить
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить предмет</DialogTitle>
          <DialogDescription>
            Выберите предмет и, при желании, программу подготовки. Карта прогресса
            по темам будет создана автоматически.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Поиск по предметам</Label>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="математика, english, история…"
            />
          </div>
          <div className="grid gap-2">
            <Label>Предмет</Label>
            <Select
              value={subjectId}
              onValueChange={(v) => {
                setSubjectId(v);
                setProgramId("none");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите предмет…" />
              </SelectTrigger>
              <SelectContent>
                {filtered.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Ничего не найдено.
                  </div>
                ) : (
                  filtered.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.exam_type ? ` · ${s.exam_type}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          {subjectId && (programs.data ?? []).length > 0 && (
            <div className="grid gap-2">
              <Label>Программа (опционально)</Label>
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="Без программы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без программы</SelectItem>
                  {(programs.data as any[]).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label>Цель (опционально)</Label>
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="например, сдать на 5"
            />
          </div>
          <div className="grid gap-2">
            <Label>Целевой балл (опционально)</Label>
            <Input
              value={targetScore}
              onChange={(e) => setTargetScore(e.target.value)}
              placeholder="90"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handle} disabled={!subjectId || loading}>
            {loading ? "Добавляем…" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
