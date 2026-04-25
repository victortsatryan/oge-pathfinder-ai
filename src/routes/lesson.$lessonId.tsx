import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LessonEditorDialog } from "@/components/oge/lesson-editor-dialog";
import { checkLessonAnswers, answerValueSchema } from "@/lib/oge-lesson.functions";
import type { LessonPracticeTask } from "@/lib/oge-mvp-data";
import { getLessonDetail } from "@/lib/oge-mvp-data";
import { loadMvpState } from "@/lib/oge-mvp.functions";

export const Route = createFileRoute("/lesson/$lessonId")({
  loader: async ({ params }) => {
    const state = await loadMvpState();
    const detail = getLessonDetail(state, params.lessonId);

    if (!detail) {
      throw notFound();
    }

    return detail;
  },
  staleTime: 30_000,
  errorComponent: LessonError,
  notFoundComponent: LessonNotFound,
  component: LessonPage,
});

function LessonPage() {
  const detail = Route.useLoaderData();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<null | Awaited<ReturnType<typeof checkLessonAnswers>>>(null);
  const [isChecking, setIsChecking] = useState(false);

  const progressLabel = useMemo(() => {
    if (step === 1) return "Шаг 1 из 3 · Теория";
    if (step === 2) return "Шаг 2 из 3 · Практика";
    return "Шаг 3 из 3 · Проверка и рекомендации";
  }, [step]);

  const handleAnswerChange = (taskId: string, value: string) => {
    setAnswers((current) => ({ ...current, [taskId]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  };

  const validateAnswers = () => {
    const nextErrors: Record<string, string> = {};

    detail.practiceTasks.forEach((task: LessonPracticeTask) => {
      const parsed = answerValueSchema.safeParse(answers[task.id] ?? "");
      if (!parsed.success) {
        nextErrors[task.id] = parsed.error.issues[0]?.message ?? "Проверьте ответ";
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCheck = async () => {
    if (!validateAnswers()) {
      setStep(2);
      return;
    }

    setIsChecking(true);
    try {
      const checked = await checkLessonAnswers({
        data: {
          lessonId: detail.lesson.id,
          answers,
        },
      });
      setResult(checked);
      setStep(3);
      await router.invalidate();
    } catch (error) {
      console.error(error);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <main className="app-shell">
      <div className="page-grid lesson-page-layout">
        <section className="panel panel-hero lesson-hero">
          <div className="hero-stack">
            <p className="eyebrow">{progressLabel}</p>
            <h1 className="display-title lesson-display-title">{detail.lesson.subject}</h1>
            <p className="lead-copy lesson-subtitle">{detail.lesson.topic}</p>
            <p className="lead-copy">{detail.coachIntro}</p>
          </div>

          <div className="lesson-stepper" role="tablist" aria-label="Этапы занятия">
            {[1, 2, 3].map((item) => (
              <button
                key={item}
                type="button"
                className={step === item ? "lesson-stepper__item is-active" : "lesson-stepper__item"}
                onClick={() => setStep(item as 1 | 2 | 3)}
              >
                {item === 1 ? "Теория" : item === 2 ? "Практика" : "Проверка"}
              </button>
            ))}
          </div>
        </section>

        <section className="lesson-main-grid">
          <div className="lesson-main-stack">
            <Card className="panel content-panel">
              <CardHeader>
                <CardTitle>1. Теория</CardTitle>
                <CardDescription>Сначала разбираем тему коротко и по делу, как на уроке с репетитором.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                <div className="theory-card">
                  <p className="theory-text">{detail.theoryText}</p>
                  {detail.videoUrl ? (
                    <a className="action-link" href={detail.videoUrl} target="_blank" rel="noreferrer">
                      Открыть видео
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="panel content-panel">
              <CardHeader>
                <CardTitle>2. Практика</CardTitle>
                <CardDescription>Решаем задания формата ОГЭ по шагам, без перегруза интерфейса.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                {detail.practiceTasks.map((task: LessonPracticeTask, index: number) => (
                  <article key={task.id} className="practice-task-card">
                    <div className="practice-task-card__head">
                      <div>
                        <div className="list-row__title">Задание {index + 1}</div>
                        <div className="list-row__meta">{task.sourceLabel}</div>
                      </div>
                    </div>
                    <p className="theory-text">{task.prompt}</p>
                    <label className="editor-field">
                      <span>Ваш ответ</span>
                      <input
                        value={answers[task.id] ?? ""}
                        onChange={(event) => handleAnswerChange(task.id, event.target.value)}
                        maxLength={200}
                        aria-invalid={Boolean(errors[task.id])}
                      />
                    </label>
                    {errors[task.id] ? <p className="field-error">{errors[task.id]}</p> : null}
                  </article>
                ))}
                <div className="lesson-actions-row">
                  <button type="button" className="tab-chip is-active" onClick={handleCheck} disabled={isChecking}>
                    {isChecking ? "Проверяем…" : "Проверить"}
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card className="panel content-panel">
              <CardHeader>
                <CardTitle>3. Проверка</CardTitle>
                <CardDescription>После проверки видны результаты, правильные ответы и объяснения.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                {result ? (
                  <>
                    <article className="result-card result-card--lesson-page">
                      <span className="result-card__label">Результат</span>
                      <strong className="result-card__value">{result.scorePercent}%</strong>
                      <span className="result-card__meta">
                        Верно {result.correctCount} из {result.total} · {result.summary}
                      </span>
                    </article>

                    {result.taskResults.map((taskResult) => (
                      <article key={taskResult.taskId} className="check-result-card">
                        <div className="check-result-card__head">
                          <span className={taskResult.isCorrect ? "status-pill status-pill--done" : "status-pill status-pill--pending"}>
                            {taskResult.isCorrect ? "Done" : "Pending"}
                          </span>
                        </div>
                        <div className="check-result-card__grid">
                          <div>
                            <span className="result-card__label">Ваш ответ</span>
                            <div className="list-row__title">{taskResult.userAnswer}</div>
                          </div>
                          <div>
                            <span className="result-card__label">Правильный ответ</span>
                            <div className="list-row__title">{taskResult.correctAnswer}</div>
                          </div>
                        </div>
                        <p className="status-line">{taskResult.explanation}</p>
                      </article>
                    ))}
                  </>
                ) : (
                  <div className="calendar-empty">Сначала заполните ответы и нажмите «Проверить».</div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="rail-stack">
            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>AI-рекомендации</CardTitle>
                <CardDescription>Следующий шаг после этого занятия.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                <div className="recommendation-block">
                  <strong>Что повторить</strong>
                  <div className="content-stack">
                    {(result?.recommendations.review ?? detail.recommendations.review).map((item: string) => (
                      <div key={item} className="check-row">
                        <span>•</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {result?.recommendations.weakTopics?.length ? (
                  <div className="recommendation-block">
                    <strong>Слабые места</strong>
                    <div className="content-stack">
                      {result.recommendations.weakTopics.map((item: string) => (
                        <div key={item} className="check-row">
                          <span>•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="recommendation-block">
                  <strong>Дополнительные задания</strong>
                  <div className="content-stack">
                    {(result?.recommendations.extraTasks ?? detail.recommendations.extraTasks).map((item: string) => (
                      <div key={item} className="check-row">
                        <span>•</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {result?.recommendations.difficulty ? (
                  <div className="recommendation-block">
                    <strong>Следующая сложность</strong>
                    <div className="check-row">
                      <span>•</span>
                      <span>{result.recommendations.difficulty}</span>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Материалы урока</CardTitle>
                <CardDescription>Источники, привязанные к этой теме.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                {detail.resourceLinks.length ? (
                  detail.resourceLinks.map((item: { id: string; title: string; url: string | null }) => (
                    <article key={item.id} className="resource-card">
                      <div className="list-row__title">{item.title}</div>
                      {item.url ? (
                        <a className="action-link" href={item.url} target="_blank" rel="noreferrer">
                          Открыть источник
                        </a>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <div className="calendar-empty">Ссылки-источники пока не загружены.</div>
                )}
              </CardContent>
            </Card>

            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Навигация</CardTitle>
                <CardDescription>Вернуться к плану или продолжить урок.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                <Link to="/" className="action-link">
                  Назад к календарю
                </Link>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

function LessonError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">Не удалось открыть занятие</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            className="action-link"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Повторить
          </button>
          <Link to="/" className="action-link">
            К календарю
          </Link>
        </div>
      </div>
    </div>
  );
}

function LessonNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">Занятие не найдено</h1>
        <p className="mt-2 text-sm text-muted-foreground">Похоже, ссылка устарела или урок ещё не создан.</p>
        <div className="mt-6">
          <Link to="/" className="action-link">
            Вернуться к календарю
          </Link>
        </div>
      </div>
    </div>
  );
}
