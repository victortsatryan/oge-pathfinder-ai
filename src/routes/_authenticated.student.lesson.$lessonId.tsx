import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/oge/page-header";
import { getLessonDetail, submitLessonTaskAttempt, completeLesson } from "@/lib/lesson.functions";

export const Route = createFileRoute("/_authenticated/student/lesson/$lessonId")({
  component: LessonPage,
  errorComponent: ({ error }) => (
    <div className="p-10">Ошибка: {String((error as any)?.message ?? error)}</div>
  ),
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const router = useRouter();
  const fetchDetail = useServerFn(getLessonDetail);
  const submit = useServerFn(submitLessonTaskAttempt);
  const complete = useServerFn(completeLesson);

  const q = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => fetchDetail({ data: { lesson_id: lessonId } }),
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});

  const submitMut = useMutation({
    mutationFn: ({ taskId, answer }: { taskId: string; answer: string }) =>
      submit({ data: { lesson_id: lessonId, task_id: taskId, student_answer: answer } }),
    onSuccess: () => q.refetch(),
  });

  const completeMut = useMutation({
    mutationFn: () => complete({ data: { lesson_id: lessonId } }),
    onSuccess: () => q.refetch(),
  });

  if (q.isLoading) return <p className="p-10 text-sm text-[color:var(--pf-muted)]">Загрузка…</p>;
  const lesson: any = q.data?.lesson;
  const materials = q.data?.materials ?? [];
  const tasks = q.data?.tasks ?? [];
  const result = q.data?.result;
  const attempts = q.data?.attempts ?? [];
  const attemptsByTask = Object.fromEntries(attempts.map((a: any) => [a.task_id, a]));

  return (
    <>
      <div className="pf-topbar">
        <Link to="/student/path" className="pf-crumb hover:text-[color:var(--pf-ink)]">
          <ArrowLeft className="h-3 w-3 inline mr-1" /> к маршруту
        </Link>
        <div className="pf-crumb">
          <b>занятие</b>{lesson?.subjects?.name ? ` · ${lesson.subjects.name}` : ""}
        </div>
      </div>

      <PageHeader
        crumb={<>учебный модуль · {lesson?.topics?.title}</>}
        title={lesson?.title ?? "Занятие"}
        lead={lesson?.goal ?? lesson?.description ?? "Цель, материалы, практика и проверка."}
      />

      <section className="pf-block mt-6">
        <h2 className="pf-h2">Почему эта тема</h2>
        <p className="text-sm text-[color:var(--pf-muted)] mt-2">
          {lesson?.description ?? `Текущий уровень освоения темы: ${q.data?.mastery ?? 0}%.`}
        </p>
      </section>

      {materials.length === 0 ? (
        <section className="pf-block mt-6">
          <h2 className="pf-h2">Материалы</h2>
          <p className="text-sm text-[color:var(--pf-muted)] mt-2">
            Материалы пока не загружены. Мы добавим их по мере наполнения базы.
          </p>
        </section>
      ) : (
        <section className="pf-block mt-6">
          <h2 className="pf-h2">Материалы</h2>
          <ul className="grid gap-2 mt-3">
            {materials.map((m: any) => {
              const mat = m.materials;
              return (
                <li key={m.id} className="py-2 border-b border-[color:var(--pf-divider)]">
                  <div className="text-sm font-medium">
                    {mat?.source_url ? (
                      <a href={mat.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                        {mat.title} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : mat?.title}
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)] mt-1">
                    {mat?.material_type}{mat?.source_name ? ` · ${mat.source_name}` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tasks.length > 0 && (
        <section className="pf-block mt-6">
          <h2 className="pf-h2">Практика</h2>
          <ol className="grid gap-4 mt-3">
            {tasks.map((t: any, idx: number) => {
              const task = t.tasks;
              const a = attemptsByTask[task.id];
              return (
                <li key={t.id} className="py-3 border-b border-[color:var(--pf-divider)]">
                  <div className="text-sm">
                    <span className="font-mono text-[color:var(--pf-muted)] mr-2">{idx + 1}.</span>
                    {task.title ?? task.prompt}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      defaultValue={a?.student_answer ?? ""}
                      onChange={(e) => setAnswers((p) => ({ ...p, [task.id]: e.target.value }))}
                      placeholder="Ваш ответ"
                      className="px-3 py-1.5 bg-transparent border border-[color:var(--pf-divider)] text-sm w-64"
                    />
                    <button
                      onClick={() => submitMut.mutate({ taskId: task.id, answer: answers[task.id] ?? a?.student_answer ?? "" })}
                      className="pf-chip hover:bg-[color:var(--pf-ink)] hover:text-[color:var(--pf-paper)]"
                    >
                      проверить
                    </button>
                    {a && (
                      <span className={`pf-chip ${a.is_correct ? "" : "text-[color:var(--pf-cinnabar)]"}`}>
                        {a.is_correct ? "верно" : "неверно"}
                      </span>
                    )}
                  </div>
                  {a && !a.is_correct && task.explanation && (
                    <div className="text-xs text-[color:var(--pf-muted)] mt-2">{task.explanation}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="pf-block mt-6">
        {result ? (
          <>
            <h2 className="pf-h2">Результат</h2>
            <p className="font-mono text-sm mt-2">
              {result.correct_tasks} / {result.completed_tasks} · {result.score_percent}%
            </p>
            <p className="text-sm text-[color:var(--pf-muted)] mt-2">{result.summary}</p>
          </>
        ) : (
          <button
            onClick={() => completeMut.mutate()}
            disabled={completeMut.isPending || attempts.length === 0}
            className="pf-chip hover:bg-[color:var(--pf-ink)] hover:text-[color:var(--pf-paper)]"
          >
            {completeMut.isPending ? "Завершаю…" : "Завершить занятие"}
          </button>
        )}
      </section>
    </>
  );
}
