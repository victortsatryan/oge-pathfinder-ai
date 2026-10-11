import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import {
  getLessonDetail,
  submitLessonTaskAttempt,
  completeLesson,
  buildLessonFromPathItem,
} from "@/lib/lesson.functions";

export const Route = createFileRoute("/_authenticated/student/lesson/$lessonId")({
  component: LessonPage,
  errorComponent: ({ error }) => (
    <div className="pf-reader py-16 text-sm" style={{ color: "var(--pf-cinnabar)" }}>
      Ошибка: {String((error as any)?.message ?? error)}
    </div>
  ),
});

const THEORY_TYPES = new Set(["theory", "video", "article", "reference", "scheme"]);

type Step =
  | { kind: "theory"; key: string; mat: any }
  | { kind: "task"; key: string; task: any }
  | { kind: "self"; key: string; mat: any }
  | { kind: "finish"; key: string };

const KIND_LABEL: Record<Step["kind"], string> = {
  theory: "теория",
  task: "задание с проверкой",
  self: "самостоятельная работа",
  finish: "завершение",
};

function fmtAnswer(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.join(" / ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function LessonPage() {
  const { lessonId } = Route.useParams();
  const router = useRouter();
  const fetchDetail = useServerFn(getLessonDetail);
  const submit = useServerFn(submitLessonTaskAttempt);
  const complete = useServerFn(completeLesson);
  const buildLesson = useServerFn(buildLessonFromPathItem);

  const q = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => fetchDetail({ data: { lesson_id: lessonId } }),
  });

  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const submitMut = useMutation({
    mutationFn: ({ taskId, answer }: { taskId: string; answer: string }) =>
      submit({ data: { lesson_id: lessonId, task_id: taskId, student_answer: answer } }),
    onSuccess: () => q.refetch(),
  });

  const completeMut = useMutation({
    mutationFn: () => complete({ data: { lesson_id: lessonId } }),
    onSuccess: () => {
      q.refetch();
      router.invalidate();
    },
  });

  const nextLessonMut = useMutation({
    mutationFn: (itemId: string) => buildLesson({ data: { path_item_id: itemId } }),
    onSuccess: (res) => {
      const id = (res as { lesson_id?: string } | null)?.lesson_id;
      if (id) {
        setStepIdx(0);
        setAnswers({});
        router.navigate({ to: "/student/lesson/$lessonId", params: { lessonId: id } });
      }
    },
  });

  const materials = (q.data?.materials ?? []) as any[];
  const tasks = (q.data?.tasks ?? []) as any[];

  const steps: Step[] = useMemo(() => {
    const theory = materials.filter((m) => THEORY_TYPES.has(m.materials?.material_type));
    const self = materials.filter((m) => m.materials && !THEORY_TYPES.has(m.materials.material_type));
    return [
      ...theory.map((m) => ({ kind: "theory" as const, key: m.id, mat: m.materials })),
      ...tasks.filter((t) => t.tasks).map((t) => ({ kind: "task" as const, key: t.id, task: t.tasks })),
      ...self.map((m) => ({ kind: "self" as const, key: m.id, mat: m.materials })),
      { kind: "finish" as const, key: "finish" },
    ];
  }, [materials, tasks]);

  if (q.isLoading) {
    return (
      <div className="pf-reader py-16">
        <p className="pf-eyebrow">загрузка…</p>
      </div>
    );
  }

  const lesson: any = q.data?.lesson;
  const readOnly = q.data ? !(q.data as any).viewer_is_owner : false;
  if (!lesson) {
    return (
      <div className="pf-reader py-16">
        <p className="pf-eyebrow">занятие недоступно</p>
        <p className="text-[14px] mt-2" style={{ color: "var(--pf-muted)" }}>
          Занятие не найдено или у вас нет к нему доступа.
        </p>
      </div>
    );
  }

  const result: any = q.data?.result;
  const attempts = (q.data?.attempts ?? []) as any[];
  const attemptsByTask = Object.fromEntries(attempts.map((a) => [a.task_id, a]));
  const nextPathItemId = (q.data as any)?.next_path_item_id as string | null;
  const taskSteps = steps.filter((s) => s.kind === "task");
  const unanswered = taskSteps.filter((s) => s.kind === "task" && !attemptsByTask[s.task.id]).length;
  const isEmpty = materials.length === 0 && tasks.length === 0;

  const idx = Math.min(stepIdx, steps.length - 1);
  const step = steps[idx];
  const go = (i: number) => {
    setStepIdx(Math.max(0, Math.min(steps.length - 1, i)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <article className="pf-reader pf-rise">
      <div className="pf-section-eyebrow">
        <Link
          to="/student/path"
          className="pf-section-eyebrow__label inline-flex items-center gap-2 hover:text-[color:var(--pf-ink)]"
        >
          <ArrowLeft className="h-3 w-3" /> <b>Мой маршрут</b>
          {lesson?.subjects?.name ? <span> / {lesson.subjects.name}</span> : null}
        </Link>
        <span className="pf-section-eyebrow__label">{lesson?.topics?.title ?? ""}</span>
      </div>

      <header className="mb-8">
        <p className="pf-eyebrow mb-4">занятие{readOnly ? " · просмотр преподавателя" : ""}</p>
        <h1 className="pf-h1" style={{ maxWidth: "18ch" }}>
          {lesson?.title ?? "Занятие"}
        </h1>
        {(lesson?.goal || lesson?.description) && (
          <p className="pf-lead">{lesson?.goal ?? lesson?.description}</p>
        )}
      </header>

      {/* Шкала шагов */}
      <nav aria-label="Шаги занятия" className="mb-10">
        <div className="flex flex-wrap gap-1">
          {steps.map((s, i) => {
            const done =
              s.kind === "task" ? !!attemptsByTask[s.task.id] : s.kind === "finish" ? !!result : i < idx;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => go(i)}
                aria-label={`Шаг ${i + 1}: ${KIND_LABEL[s.kind]}`}
                aria-current={i === idx ? "step" : undefined}
                className="h-2 flex-1 min-w-[14px]"
                style={{
                  background:
                    i === idx
                      ? "var(--pf-mustard)"
                      : done
                        ? "var(--pf-ink)"
                        : "var(--pf-line-strong)",
                }}
              />
            );
          })}
        </div>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--pf-muted)" }}>
          шаг {idx + 1} из {steps.length} · {KIND_LABEL[step.kind]}
          {taskSteps.length > 0 ? ` · ответов ${attempts.length} / ${taskSteps.length}` : ""}
        </p>
      </nav>

      <section className="mb-10" key={step.key}>
        {step.kind === "theory" && <MaterialBody mat={step.mat} label="Теория" />}

        {step.kind === "self" && (
          <>
            <MaterialBody mat={step.mat} label="Практика" />
            <p
              className="mt-6 font-mono text-[11px] uppercase tracking-widest"
              style={{ color: "var(--pf-muted)" }}
            >
              Материал для самостоятельной работы — ключа ответа нет, автоматическая проверка не проводится.
            </p>
          </>
        )}

        {step.kind === "task" && (
          <TaskStep
            task={step.task}
            attempt={attemptsByTask[step.task.id]}
            readOnly={readOnly}
            value={answers[step.task.id] ?? ""}
            onChange={(v) => setAnswers((p) => ({ ...p, [step.task.id]: v }))}
            pending={submitMut.isPending}
            error={submitMut.error ? (submitMut.error as Error).message : null}
            onCheck={() => {
              const answer = (answers[step.task.id] ?? "").trim();
              if (!answer || submitMut.isPending) return;
              submitMut.mutate({ taskId: step.task.id, answer });
            }}
          />
        )}

        {step.kind === "finish" && (
          <div>
            <SectionEyebrow section="итог" sub={result ? "Результат" : "Завершение"} mark={result ? "forest" : "ink"} />
            {result ? (
              <div>
                {result.completed_tasks > 0 ? (
                  <p className="text-4xl font-medium">
                    {result.correct_tasks} / {result.completed_tasks}
                    <span className="ml-3 text-2xl" style={{ color: "var(--pf-muted)" }}>
                      {result.score_percent}%
                    </span>
                  </p>
                ) : null}
                {result.summary && (
                  <p className="mt-4 text-[14px] leading-relaxed" style={{ color: "var(--pf-muted)" }}>
                    {result.summary}
                  </p>
                )}
                {!readOnly && (
                  <div className="mt-8 flex flex-wrap gap-3">
                    {nextPathItemId ? (
                      <button
                        type="button"
                        onClick={() => nextLessonMut.mutate(nextPathItemId)}
                        disabled={nextLessonMut.isPending}
                        className="pf-btn pf-btn--accent"
                      >
                        {nextLessonMut.isPending ? "Готовлю…" : "Следующее занятие"} <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <p className="text-[14px]">Все занятия маршрута пройдены.</p>
                    )}
                    <Link to="/student/path" className="pf-btn pf-btn--ghost">
                      К маршруту
                    </Link>
                  </div>
                )}
              </div>
            ) : readOnly ? (
              <p className="text-[14px]" style={{ color: "var(--pf-muted)" }}>
                Ученик ещё не завершил занятие.
              </p>
            ) : isEmpty ? (
              <p className="text-[14px]" style={{ color: "var(--pf-muted)" }}>
                В этом занятии пока нет материалов, поэтому его нельзя завершить. Вернитесь к маршруту.
              </p>
            ) : (
              <div>
                {unanswered > 0 && (
                  <p className="text-[14px] mb-4" style={{ color: "var(--pf-cinnabar)" }}>
                    Осталось ответить на заданий: {unanswered}.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => completeMut.mutate()}
                  disabled={completeMut.isPending || unanswered > 0}
                  className="pf-btn pf-btn--accent"
                >
                  {completeMut.isPending ? "Завершаю…" : "Завершить занятие →"}
                </button>
                {completeMut.error && (
                  <p className="text-sm mt-3" style={{ color: "var(--pf-cinnabar)" }}>
                    {(completeMut.error as Error).message}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Навигация по шагам */}
      <div
        className="flex justify-between gap-3 pt-6 mb-16"
        style={{ borderTop: "1px solid var(--pf-line-strong)" }}
      >
        <button type="button" onClick={() => go(idx - 1)} disabled={idx === 0} className="pf-btn pf-btn--ghost">
          <ArrowLeft className="h-4 w-4" /> Назад
        </button>
        {step.kind !== "finish" && (
          <button
            type="button"
            onClick={() => go(idx + 1)}
            className={
              step.kind !== "task" || readOnly || attemptsByTask[step.task.id]
                ? "pf-btn pf-btn--accent"
                : "pf-btn pf-btn--ghost"
            }
          >
            {idx + 1 === steps.length - 1 ? "К завершению" : "Далее"} <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </article>
  );
}

function MaterialBody({ mat, label }: { mat: any; label: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-widest mb-3" style={{ color: "var(--pf-muted)" }}>
        {label}
        {mat?.source_name ? ` · ${mat.source_name}` : ""}
      </p>
      <h2 className="text-[22px] font-medium leading-snug mb-5">{mat?.title}</h2>
      {mat?.content_text ? (
        <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{mat.content_text}</div>
      ) : (
        <p className="text-[14px]" style={{ color: "var(--pf-muted)" }}>
          {mat?.description ?? "Текст материала не загружен."}
        </p>
      )}
      {mat?.id && (
        <Link
          to="/material/$materialId"
          params={{ materialId: mat.id }}
          className="inline-block mt-6 text-[12px] font-mono uppercase tracking-widest underline underline-offset-4"
        >
          открыть отдельно →
        </Link>
      )}
    </div>
  );
}

function TaskStep({
  task,
  attempt,
  readOnly,
  value,
  onChange,
  onCheck,
  pending,
  error,
}: {
  task: any;
  attempt: any;
  readOnly: boolean;
  value: string;
  onChange: (v: string) => void;
  onCheck: () => void;
  pending: boolean;
  error: string | null;
}) {
  const options: string[] = Array.isArray(task.options) ? task.options.map(String) : [];
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-widest mb-3" style={{ color: "var(--pf-muted)" }}>
        Задание с автопроверкой
      </p>
      {task.title && <h2 className="text-[22px] font-medium leading-snug mb-5">{task.title}</h2>}
      {task.prompt && (
        <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{task.prompt}</div>
      )}
      {options.length > 0 && (
        <ol className="mt-4 list-decimal pl-6 text-[15px] leading-relaxed">
          {options.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ol>
      )}

      <div className="mt-6">
        {attempt ? (
          <div>
            <p className="text-[14px]">
              {readOnly ? "Ответ ученика" : "Ваш ответ"}: <b>{fmtAnswer(attempt.student_answer)}</b>
            </p>
            <p
              className="mt-2 font-mono text-[12px] uppercase tracking-widest"
              style={{ color: attempt.is_correct ? "var(--pf-forest)" : "var(--pf-cinnabar)" }}
            >
              {attempt.is_correct ? "верно" : `неверно · правильный ответ: ${fmtAnswer(attempt.correct_answer)}`}
            </p>
            {!attempt.is_correct && task.explanation && (
              <p className="text-[14px] leading-relaxed mt-3" style={{ color: "var(--pf-muted)" }}>
                {task.explanation}
              </p>
            )}
          </div>
        ) : readOnly ? (
          <p className="text-[14px]" style={{ color: "var(--pf-muted)" }}>
            Ученик ещё не ответил.
          </p>
        ) : (
          <form
            className="flex flex-wrap items-baseline gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              onCheck();
            }}
          >
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Ваш ответ"
              aria-label="Ваш ответ"
              className="pf-input-line max-w-xs"
              maxLength={200}
            />
            <button type="submit" disabled={pending || !value.trim()} className="pf-btn pf-btn--accent">
              {pending ? "Проверяю…" : "Проверить"}
            </button>
            {error && (
              <span className="text-sm w-full" style={{ color: "var(--pf-cinnabar)" }}>
                {error}
              </span>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
