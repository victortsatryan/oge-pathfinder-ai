import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/oge/page-header";
import { Button } from "@/components/ui/button";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

import {
  getDiagnosticSession,
  completeDiagnosticSession,
  getDiagnosticResults,
} from "@/lib/diagnostic.functions";
import { generateLearningPath } from "@/lib/learning-path.functions";

export const Route = createFileRoute("/_authenticated/student/diagnostic/$sessionId")({
  component: DiagnosticSessionPage,
  errorComponent: ({ error }) => (
    <div className="p-10">Ошибка: {String((error as any)?.message ?? error)}</div>
  ),
  notFoundComponent: () => <div className="p-10">Диагностика не найдена</div>,
});

function DiagnosticSessionPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getSession = useServerFn(getDiagnosticSession);
  const completeFn = useServerFn(completeDiagnosticSession);
  const getResults = useServerFn(getDiagnosticResults);
  const generatePathFn = useServerFn(generateLearningPath);

  const sessionQ = useQuery({
    queryKey: ["diagnostic-session", sessionId],
    queryFn: () => getSession({ data: { session_id: sessionId } }),
  });

  const status = (sessionQ.data as any)?.session?.status;
  const isCompleted = status === "completed";

  const resultsQ = useQuery({
    queryKey: ["diagnostic-results", sessionId],
    queryFn: () => getResults({ data: { session_id: sessionId } }),
    enabled: isCompleted,
  });

  // local answers
  const [answers, setAnswers] = useState<Record<string, string>>({});
  useEffect(() => {
    const saved = ((sessionQ.data as any)?.answers ?? []) as any[];
    if (saved.length) {
      const init: Record<string, string> = {};
      for (const a of saved) if (a.student_answer != null) init[a.task_id] = a.student_answer;
      setAnswers((prev) => ({ ...init, ...prev }));
    }
  }, [sessionQ.data]);

  const tasks = (((sessionQ.data as any)?.tasks ?? []) as any[]).map((tt) => tt.task);
  const total = tasks.length;
  const answeredCount = useMemo(
    () => tasks.filter((t) => answers[t.id]?.trim()).length,
    [tasks, answers],
  );

  const completeMut = useMutation({
    mutationFn: () =>
      completeFn({
        data: {
          session_id: sessionId,
          answers: tasks.map((t) => ({
            task_id: t.id,
            student_answer: answers[t.id] ?? null,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Диагностика завершена");
      qc.invalidateQueries({ queryKey: ["diagnostic-session", sessionId] });
      qc.invalidateQueries({ queryKey: ["diagnostic-results", sessionId] });
      qc.invalidateQueries({ queryKey: ["diagnostic-history"] });
      qc.invalidateQueries({ queryKey: ["student-analytics"] });
      qc.invalidateQueries({ queryKey: ["student-weak"] });
      qc.invalidateQueries({ queryKey: ["student-mistakes"] });
      qc.invalidateQueries({ queryKey: ["topic-progress-real"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось завершить"),
  });

  if (sessionQ.isLoading) {
    return <main className="p-10">Загрузка…</main>;
  }

  const session = (sessionQ.data as any)?.session;
  const test = session?.diagnostic_test;
  const subject = session?.subject;

  return (
    <main className="min-h-screen" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-4xl mx-auto px-10 py-10">
        <div className="pf-topbar">
          <Link to="/student/diagnostic" className="pf-crumb hover:text-[color:var(--pf-ink)]">
            <ArrowLeft className="h-3 w-3 inline mr-1" /> к диагностикам
          </Link>
          <div className="pf-crumb">
            <b>{isCompleted ? "результат" : "прохождение"}</b>
            {subject?.name ? ` · ${subject.name}` : ""}
          </div>
        </div>

        <PageHeader
          crumb={<>{isCompleted ? "результат" : "диагностика"}</>}
          title={test?.title ?? "Диагностика"}
          lead={
            isCompleted
              ? "Готово. Карта знаний обновлена. Ниже — общий балл, темы и слабые места."
              : test?.description ||
                "Отметьте ответы. Можно вернуться и продолжить позже."
          }
        />

        {!isCompleted ? (
          <>
            <section className="pf-block mt-8">
              <div className="flex items-center justify-between mb-4">
                <p className="pf-eyebrow">прогресс</p>
                <span className="font-mono text-[12px] text-[color:var(--pf-muted)]">
                  {answeredCount} / {total}
                </span>
              </div>
              <div className="pf-bar">
                <div
                  className="pf-bar__fill"
                  style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }}
                />
              </div>
            </section>

            <section className="grid gap-6 mt-8">
              {tasks.map((t: any, idx: number) => {
                const opts: any[] = Array.isArray(t.options) ? t.options : [];
                const current = answers[t.id] ?? "";
                return (
                  <div key={t.id} className="pf-block">
                    <p className="pf-eyebrow mb-2">
                      задание {idx + 1}
                      {t.topic?.title ? ` · ${t.topic.title}` : ""}
                    </p>
                    <p className="text-[15px] font-medium mb-4">{t.prompt}</p>
                    <RadioGroup
                      value={current}
                      onValueChange={(v) =>
                        setAnswers((prev) => ({ ...prev, [t.id]: v }))
                      }
                    >
                      <div className="grid gap-2">
                        {opts.map((opt, i) => {
                          const val = typeof opt === "string" ? opt : String(opt?.value ?? opt);
                          const id = `${t.id}-${i}`;
                          return (
                            <Label
                              key={id}
                              htmlFor={id}
                              className="flex items-center gap-3 py-1 cursor-pointer font-normal"
                            >
                              <RadioGroupItem id={id} value={val} />
                              <span>{val}</span>
                            </Label>
                          );
                        })}
                      </div>
                    </RadioGroup>
                  </div>
                );
              })}
            </section>

            <div className="flex justify-end mt-8">
              <Button
                onClick={() => completeMut.mutate()}
                disabled={completeMut.isPending || answeredCount === 0}
              >
                {completeMut.isPending ? "Завершение…" : "Завершить диагностику"}
              </Button>
            </div>
          </>
        ) : (
          <CompletedView resultsQ={resultsQ} navigate={navigate} />
        )}
      </div>
    </main>
  );
}

function CompletedView({
  resultsQ,
  navigate,
}: {
  resultsQ: ReturnType<typeof useQuery>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (resultsQ.isLoading) return <p className="mt-8">Загрузка результатов…</p>;
  const data = resultsQ.data as any;
  if (!data) return null;
  const { session, topicResults, mistakes, weak } = data;

  const mistakeAgg = new Map<string, number>();
  for (const m of mistakes ?? []) {
    const t = m.mistake_type ?? "other";
    mistakeAgg.set(t, (mistakeAgg.get(t) ?? 0) + 1);
  }

  return (
    <>
      <section className="pf-block mt-8 mb-8">
        <p className="pf-eyebrow mb-2">общий результат</p>
        <div className="grid sm:grid-cols-3 gap-6 items-end">
          <div>
            <div className="font-mono text-4xl">{session.score_percent ?? 0}%</div>
            <div className="text-[12px] font-mono uppercase tracking-wider text-[color:var(--pf-muted)]">
              {session.score ?? 0} из {session.max_score ?? 0} баллов
            </div>
          </div>
          <div className="sm:col-span-2 text-[14px]">{session.summary}</div>
        </div>
      </section>

      <section className="pf-block mb-8">
        <p className="pf-eyebrow mb-2">по темам</p>
        <h2 className="pf-h2 mb-4">Результат по темам</h2>
        {(topicResults ?? []).length === 0 ? (
          <p className="text-sm text-[color:var(--pf-muted)]">
            Темы не определены для этого теста.
          </p>
        ) : (
          <ul className="grid gap-3">
            {(topicResults as any[]).map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[1fr,80px,140px] items-center gap-4 py-2 border-b border-[color:var(--pf-divider)]"
              >
                <span className="font-medium">{r.topic?.title}</span>
                <span className="font-mono text-[13px] text-right">{r.score_percent}%</span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] text-right">
                  {r.correct_count}/{r.correct_count + r.wrong_count} верно
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pf-block mb-8">
        <p className="pf-eyebrow mb-2">внимание</p>
        <h2 className="pf-h2 mb-4">Слабые темы</h2>
        {(weak ?? []).length === 0 ? (
          <p className="text-sm text-[color:var(--pf-muted)]">
            Слабых тем не выявлено — отличный результат.
          </p>
        ) : (
          <ul className="grid gap-2">
            {(weak as any[]).map((w) => (
              <li key={w.id} className="flex items-center gap-3 text-[14px]">
                <span className="pf-dot pf-dot--cinnabar" />
                <span className="font-medium">{w.topic?.title}</span>
                <span className="ml-auto font-mono text-[12px]">{w.score_percent}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pf-block mb-8">
        <p className="pf-eyebrow mb-2">типичные ошибки</p>
        <h2 className="pf-h2 mb-4">Что чаще всего ломалось</h2>
        {mistakeAgg.size === 0 ? (
          <p className="text-sm text-[color:var(--pf-muted)]">Ошибок не зафиксировано.</p>
        ) : (
          <ul className="grid gap-2">
            {Array.from(mistakeAgg.entries()).map(([type, count]) => (
              <li key={type} className="flex items-center gap-3 text-[14px]">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] w-40">
                  {type}
                </span>
                <span className="font-mono text-[13px]">× {count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pf-block">
        <p className="pf-eyebrow mb-4">следующие действия</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate({ to: "/student/calendar" })}>
            Создать план по слабым темам
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/student/materials" })}>
            Подобрать материалы
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/student/assistant" })}>
            Спросить AI
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/profile" })}>
            Открыть профиль
          </Button>
        </div>
      </section>
    </>
  );
}
