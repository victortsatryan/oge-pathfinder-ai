import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { SectionEyebrow } from "@/components/oge/section-eyebrow";
import {
  getLessonDetail,
  submitLessonTaskAttempt,
  completeLesson,
} from "@/lib/lesson.functions";

export const Route = createFileRoute("/_authenticated/student/lesson/$lessonId")({
  component: LessonPage,
  errorComponent: ({ error }) => (
    <div className="pf-reader py-16 text-sm" style={{ color: "var(--pf-cinnabar)" }}>
      Ошибка: {String((error as any)?.message ?? error)}
    </div>
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
    onSuccess: () => {
      q.refetch();
      router.invalidate();
    },
  });

  if (q.isLoading) {
    return (
      <div className="pf-reader py-16">
        <p className="pf-eyebrow">загрузка…</p>
      </div>
    );
  }

  const lesson: any = q.data?.lesson;
  const materials = q.data?.materials ?? [];
  const tasks = q.data?.tasks ?? [];
  const result = q.data?.result;
  const attempts = q.data?.attempts ?? [];
  const attemptsByTask = Object.fromEntries(attempts.map((a: any) => [a.task_id, a]));

  return (
    <article className="pf-reader pf-rise">
      {/* Верхняя мета-строка: путь назад + мета-инфо */}
      <div className="pf-section-eyebrow">
        <Link
          to="/student/path"
          className="pf-section-eyebrow__label inline-flex items-center gap-2 hover:text-[color:var(--pf-ink)]"
        >
          <ArrowLeft className="h-3 w-3" /> <b>Занятие</b>
          {lesson?.subjects?.name ? <span> / {lesson.subjects.name}</span> : null}
        </Link>
        <span
          className="pf-section-eyebrow__label"
          title="Тема"
        >
          {lesson?.topics?.title ?? ""}
        </span>
      </div>

      {/* Заголовок */}
      <header className="mb-12">
        <p className="pf-eyebrow mb-4">учебный модуль</p>
        <h1 className="pf-h1" style={{ maxWidth: "18ch" }}>
          {lesson?.title ?? "Занятие"}
        </h1>
        {(lesson?.goal || lesson?.description) && (
          <p className="pf-lead">
            {lesson?.goal ?? lesson?.description}
          </p>
        )}
      </header>

      {/* Почему эта тема */}
      <section className="mb-12">
        <SectionEyebrow section="01" sub="Почему эта тема" mark="ink" />
        <p className="text-[15px] leading-relaxed" style={{ color: "var(--pf-muted)" }}>
          {lesson?.description ??
            `Текущий уровень освоения темы — ${q.data?.mastery ?? 0}%. Разберитесь с материалами, затем пройдите практику.`}
        </p>
      </section>

      {/* Материалы */}
      <section className="mb-12">
        <SectionEyebrow
          section="02"
          sub="Материалы"
          mark="ink"
          right={
            <span className="pf-section-eyebrow__label">
              {materials.length ? `${materials.length}` : "—"}
            </span>
          }
        />
        {materials.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
            Материалы пока не загружены. Мы добавим их по мере наполнения базы.
          </p>
        ) : (
          <ul className="grid gap-0">
            {materials.map((m: any) => {
              const mat = m.materials;
              return (
                <li
                  key={m.id}
                  className="py-4"
                  style={{ borderBottom: "1px solid var(--pf-line)" }}
                >
                  <div className="text-[15px] font-medium">
                    {mat?.source_url ? (
                      <a
                        href={mat.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        {mat.title} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      mat?.title
                    )}
                  </div>
                  <div
                    className="mt-1 font-mono text-[11px] uppercase tracking-widest"
                    style={{ color: "var(--pf-muted)" }}
                  >
                    {mat?.material_type}
                    {mat?.source_name ? ` · ${mat.source_name}` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Практика */}
      <section className="mb-12">
        <SectionEyebrow
          section="03"
          sub="Практика"
          mark="mustard"
          right={
            <span className="pf-section-eyebrow__label">
              {tasks.length ? `${attempts.length} / ${tasks.length}` : "—"}
            </span>
          }
        />
        {tasks.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pf-muted)" }}>
            Задания будут доступны после наполнения базы. Занятие можно завершить как «изучено».
          </p>
        ) : (
          <ol className="grid gap-0">
            {tasks.map((t: any, idx: number) => {
              const task = t.tasks;
              const a = attemptsByTask[task.id];
              return (
                <li
                  key={t.id}
                  className="py-5"
                  style={{ borderBottom: "1px solid var(--pf-line)" }}
                >
                  <div className="text-[15px] leading-relaxed">
                    <span
                      className="font-mono mr-3"
                      style={{ color: "var(--pf-muted)" }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    {task.title ?? task.prompt}
                  </div>

                  <div className="flex flex-wrap items-baseline gap-4 mt-4">
                    <input
                      defaultValue={a?.student_answer ?? ""}
                      onChange={(e) =>
                        setAnswers((p) => ({ ...p, [task.id]: e.target.value }))
                      }
                      placeholder="Ваш ответ"
                      className="pf-input-line max-w-xs"
                    />
                    <button
                      onClick={() =>
                        submitMut.mutate({
                          taskId: task.id,
                          answer: answers[task.id] ?? a?.student_answer ?? "",
                        })
                      }
                      className="pf-btn pf-btn--ghost"
                    >
                      Проверить
                    </button>
                    {a && (
                      <span
                        className="font-mono text-[11px] uppercase tracking-widest"
                        style={{
                          color: a.is_correct
                            ? "var(--pf-forest)"
                            : "var(--pf-cinnabar)",
                        }}
                      >
                        {a.is_correct ? "верно" : "неверно"}
                      </span>
                    )}
                  </div>

                  {a && !a.is_correct && task.explanation && (
                    <p
                      className="text-[13px] leading-relaxed mt-3"
                      style={{ color: "var(--pf-muted)" }}
                    >
                      {task.explanation}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Результат / завершить */}
      <section className="mb-16">
        <SectionEyebrow
          section="04"
          sub={result ? "Результат" : "Завершение"}
          mark={result ? "forest" : "ink"}
        />
        {result ? (
          <div>
            <p
              className="font-mono text-[13px] uppercase tracking-widest mb-2"
              style={{ color: "var(--pf-muted)" }}
            >
              итог
            </p>
            <p className="text-4xl font-medium">
              {result.correct_tasks} / {result.completed_tasks}
              <span
                className="ml-3 text-2xl"
                style={{ color: "var(--pf-muted)" }}
              >
                {result.score_percent}%
              </span>
            </p>
            {result.summary && (
              <p
                className="mt-4 text-[14px] leading-relaxed"
                style={{ color: "var(--pf-muted)" }}
              >
                {result.summary}
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={() => completeMut.mutate()}
            disabled={
              completeMut.isPending ||
              (tasks.length > 0 && attempts.length === 0)
            }
            className="pf-btn pf-btn--accent"
          >
            {completeMut.isPending ? "Завершаю…" : "Завершить занятие →"}
          </button>
        )}
      </section>
    </article>
  );
}
