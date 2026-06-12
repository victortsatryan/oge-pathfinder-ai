import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, queryOptions } from "@tanstack/react-query";

import { PageHeader } from "@/components/oge/page-header";
import {
  getStudentOverview,
  getSubjectAnalytics,
  getWeakTopics,
  getMistakeAnalysis,
  getProgressDynamics,
  getTopicsToReview,
  getRecommendations,
  getGoalForecast,
  getActivityStats,
} from "@/lib/analytics.functions";

const overviewQO = queryOptions({
  queryKey: ["analytics", "overview"],
  queryFn: () => getStudentOverview(),
});
const subjectsQO = queryOptions({
  queryKey: ["analytics", "subjects"],
  queryFn: () => getSubjectAnalytics(),
});
const weakQO = queryOptions({
  queryKey: ["analytics", "weak"],
  queryFn: () => getWeakTopics({ data: { limit: 10 } }),
});
const mistakesQO = queryOptions({
  queryKey: ["analytics", "mistakes"],
  queryFn: () => getMistakeAnalysis(),
});
const dynamicsQO = queryOptions({
  queryKey: ["analytics", "dynamics"],
  queryFn: () => getProgressDynamics({ data: { days: 30 } }),
});
const reviewQO = queryOptions({
  queryKey: ["analytics", "review"],
  queryFn: () => getTopicsToReview(),
});
const recsQO = queryOptions({
  queryKey: ["analytics", "recs"],
  queryFn: () => getRecommendations(),
});
const forecastQO = queryOptions({
  queryKey: ["analytics", "forecast"],
  queryFn: () => getGoalForecast(),
});
const activityQO = queryOptions({
  queryKey: ["analytics", "activity"],
  queryFn: () => getActivityStats(),
});

export const Route = createFileRoute("/_authenticated/student/analytics")({
  errorComponent: ({ error }) => (
    <div role="alert" className="pf-block">Ошибка загрузки аналитики: {error.message}</div>
  ),
  notFoundComponent: () => <div className="pf-block">Аналитика не найдена.</div>,
  component: StudentAnalytics,
});


const STATUS_COLOR: Record<string, string> = {
  weak: "var(--pf-cinnabar, #c0392b)",
  needs_review: "var(--pf-blue, #1d4ed8)",
  learning: "var(--pf-mustard, #d69e2e)",
  stable: "var(--pf-mustard, #d69e2e)",
  mastered: "var(--pf-green, #2f855a)",
  not_started: "var(--pf-muted, #888)",
};

function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="h-2 w-full bg-[color:var(--pf-line)] rounded">
      <div className="h-2 bg-[color:var(--pf-ink)] rounded" style={{ width: `${pct}%` }} />
    </div>
  );
}

function StudentAnalytics() {
  const results = useQueries({
    queries: [overviewQO, subjectsQO, weakQO, mistakesQO, dynamicsQO, reviewQO, recsQO, forecastQO, activityQO],
  });
  const [overviewQ, subjectsQ, weakQ, mistakesQ, dynamicsQ, reviewQ, recsQ, forecastQ, activityQ] = results;

  if (results.some((r) => r.isLoading)) {
    return <div className="pf-block text-[14px] text-[color:var(--pf-muted)]">Загружаем аналитику…</div>;
  }

  const overview = overviewQ.data!;
  const subjects = subjectsQ.data ?? [];
  const weak = weakQ.data ?? [];
  const mistakes = mistakesQ.data ?? { total: 0, by_type: [], by_topic: [] };
  const dynamics = dynamicsQ.data ?? { history: [], total_delta: 0, lessons_done: 0, tasks_done: 0, diagnostics_done: 0 };
  const review = reviewQ.data ?? [];
  const recs = recsQ.data ?? [];
  const forecast = forecastQ.data;
  const activity = activityQ.data ?? { path: null, path_total: 0, path_done: 0, path_remaining: 0, path_progress: 0, scheduled: 0, completed: 0, skipped: 0, regularity: 0 };

  if (!overview?.profile) {
    return (
      <div className="pf-block">
        <PageHeader title="Аналитика" lead="Чтобы увидеть аналитику, заполни профиль ученика и выбери предметы." />
        <Link to="/onboarding" className="pf-btn mt-4">Перейти к онбордингу</Link>
      </div>
    );
  }


  return (
    <>
      <PageHeader
        title="Аналитика обучения"
        lead="Карта твоего прогресса: что освоено, где слабые места и что делать дальше."
      />

      {/* Overview */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[color:var(--pf-line-strong)] border border-[color:var(--pf-line-strong)] rounded mb-10">
        {[
          { label: "Средний уровень", value: `${overview.avg_mastery}%` },
          { label: "Освоено тем", value: `${overview.mastered_topics} / ${overview.total_topics}` },
          { label: "Слабые темы", value: overview.weak_topics },
          { label: "Серия дней", value: overview.streak_days },
        ].map((s) => (
          <div key={s.label} className="bg-[color:var(--pf-paper)] p-5">
            <div className="pf-eyebrow mb-2">{s.label}</div>
            <div className="pf-h2" style={{ fontFamily: "var(--font-mono)" }}>{s.value}</div>
          </div>
        ))}
      </section>

      {/* Goal forecast */}
      {forecast && (
        <section className="pf-block mb-10">
          <p className="pf-eyebrow mb-3">Прогноз достижения цели</p>
          <div className="grid sm:grid-cols-3 gap-6 items-end">
            <div>
              <div className="text-[13px] text-[color:var(--pf-muted)] mb-1">Цель</div>
              <div className="text-[20px] font-medium">{forecast.target_score}%</div>
              {forecast.goal && <div className="text-[12px] text-[color:var(--pf-muted)] mt-1">{forecast.goal}</div>}
            </div>
            <div>
              <div className="text-[13px] text-[color:var(--pf-muted)] mb-1">Текущий уровень</div>
              <div className="text-[20px] font-medium">{forecast.current_score}%</div>
              <div className="mt-2"><Bar value={forecast.current_score} max={forecast.target_score} /></div>
            </div>
            <div>
              <div className="text-[13px] text-[color:var(--pf-muted)] mb-1">Вероятность</div>
              <div className="text-[20px] font-medium">
                {forecast.likelihood === "high" && "Высокая"}
                {forecast.likelihood === "medium" && "Средняя"}
                {forecast.likelihood === "low" && "Низкая"}
              </div>
              <div className="text-[12px] text-[color:var(--pf-muted)] mt-1">
                {forecast.active_topics_last_14d} активных тем за 14 дней
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Subjects */}
      <section className="mb-10">
        <p className="pf-eyebrow mb-4">Прогресс по предметам</p>
        <div className="pf-block">
          {subjects.length === 0 && <div className="text-[14px] text-[color:var(--pf-muted)]">Нет выбранных предметов.</div>}
          {subjects.map((s, i) => (
            <div key={s.subject_id} className="py-4" style={{ borderTop: i === 0 ? 0 : "1px solid var(--pf-line-strong)" }}>
              <div className="flex items-baseline justify-between mb-2">
                <Link to="/student/subjects/$subjectId" params={{ subjectId: s.subject_id }} className="text-[16px] font-medium">
                  {s.subject_title}
                </Link>
                <div className="text-[13px] text-[color:var(--pf-muted)]">
                  {s.program_title ?? "Программа не выбрана"} · {s.topics_total} тем
                </div>
              </div>
              <Bar value={s.avg_mastery} />
              <div className="grid sm:grid-cols-2 gap-4 mt-3 text-[13px]">
                {s.weak_topics.length > 0 && (
                  <div>
                    <span className="text-[color:var(--pf-muted)]">Слабые: </span>
                    {s.weak_topics.join(", ")}
                  </div>
                )}
                {s.in_progress_topics.length > 0 && (
                  <div>
                    <span className="text-[color:var(--pf-muted)]">В работе: </span>
                    {s.in_progress_topics.join(", ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Weak topics & recommendations */}
      <section className="grid lg:grid-cols-2 gap-10 mb-10">
        <div>
          <p className="pf-eyebrow mb-4">Слабые темы</p>
          <div className="pf-block">
            {weak.length === 0 && <div className="text-[14px] text-[color:var(--pf-muted)]">Нет слабых тем 🎉</div>}
            {weak.map((t) => (
              <Link
                key={t.topic_id}
                to="/student/topics/$topicId"
                params={{ topicId: t.topic_id }}
                className="grid grid-cols-[1fr,auto] gap-4 py-3 border-t first:border-t-0 border-[color:var(--pf-line)]"
              >
                <div>
                  <div className="text-[15px] font-medium">{t.topic_title}</div>
                  <div className="text-[12px] text-[color:var(--pf-muted)] mt-1">
                    {t.subject_title} · ошибок: {t.mistakes_count}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-medium" style={{ color: STATUS_COLOR[t.status] }}>{t.mastery_score}%</div>
                  <div className="text-[11px] text-[color:var(--pf-muted)]">{t.status}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="pf-eyebrow mb-4">Рекомендации системы</p>
          <div className="pf-block">
            {recs.length === 0 && <div className="text-[14px] text-[color:var(--pf-muted)]">Пока нет рекомендаций.</div>}
            {recs.map((r, i) => (
              <Link
                key={`${r.topic_id}-${r.kind}-${i}`}
                to="/student/topics/$topicId"
                params={{ topicId: r.topic_id }}
                className="block py-3 border-t first:border-t-0 border-[color:var(--pf-line)]"
              >
                <div className="text-[15px] font-medium">{r.topic_title}</div>
                <div className="text-[12px] text-[color:var(--pf-muted)] mt-1">{r.subject_title} · {r.kind}</div>
                <div className="text-[13px] mt-1">{r.reason}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Mistakes */}
      <section className="grid lg:grid-cols-2 gap-10 mb-10">
        <div>
          <p className="pf-eyebrow mb-4">Типичные ошибки ({mistakes.total})</p>
          <div className="pf-block">
            {mistakes.by_type.length === 0 && <div className="text-[14px] text-[color:var(--pf-muted)]">Ошибок пока нет.</div>}
            {mistakes.by_type.map((m) => (
              <div key={m.type} className="flex justify-between py-2 border-t first:border-t-0 border-[color:var(--pf-line)]">
                <span className="text-[14px]">{m.type}</span>
                <span className="font-mono text-[14px]">{m.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="pf-eyebrow mb-4">Ошибки по темам</p>
          <div className="pf-block">
            {mistakes.by_topic.length === 0 && <div className="text-[14px] text-[color:var(--pf-muted)]">—</div>}
            {mistakes.by_topic.map((t) => (
              <div key={t.topic_id} className="py-3 border-t first:border-t-0 border-[color:var(--pf-line)]">
                <div className="flex justify-between">
                  <span className="text-[14px] font-medium">{t.topic_title}</span>
                  <span className="font-mono text-[14px]">{t.count}</span>
                </div>
                <div className="text-[12px] text-[color:var(--pf-muted)] mt-1">
                  {t.subject_title} · {t.types.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamics & Activity */}
      <section className="grid lg:grid-cols-2 gap-10 mb-10">
        <div>
          <p className="pf-eyebrow mb-4">Динамика за 30 дней</p>
          <div className="pf-block">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-[12px] text-[color:var(--pf-muted)]">Δ уровень</div>
                <div className="pf-h2" style={{ fontFamily: "var(--font-mono)" }}>{dynamics.total_delta > 0 ? "+" : ""}{dynamics.total_delta}</div>
              </div>
              <div>
                <div className="text-[12px] text-[color:var(--pf-muted)]">Занятий</div>
                <div className="pf-h2" style={{ fontFamily: "var(--font-mono)" }}>{dynamics.lessons_done}</div>
              </div>
              <div>
                <div className="text-[12px] text-[color:var(--pf-muted)]">Задач</div>
                <div className="pf-h2" style={{ fontFamily: "var(--font-mono)" }}>{dynamics.tasks_done}</div>
              </div>
            </div>
            <div className="text-[12px] text-[color:var(--pf-muted)] mb-2">Последние изменения</div>
            {dynamics.history.length === 0 && <div className="text-[13px] text-[color:var(--pf-muted)]">Истории пока нет.</div>}
            {dynamics.history.slice(0, 8).map((h: any, i: number) => (
              <div key={i} className="flex justify-between py-2 border-t first:border-t-0 border-[color:var(--pf-line)] text-[13px]">
                <span>{h.topics?.title ?? "—"} <span className="text-[color:var(--pf-muted)]">· {h.source}</span></span>
                <span className="font-mono">{h.old_score} → {h.new_score} ({h.delta > 0 ? "+" : ""}{h.delta})</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="pf-eyebrow mb-4">Маршрут и календарь</p>
          <div className="pf-block">
            {activity.path ? (
              <>
                <div className="text-[15px] font-medium mb-1">{activity.path.title}</div>
                <div className="text-[12px] text-[color:var(--pf-muted)] mb-3">
                  {activity.path_done} / {activity.path_total} шагов · осталось {activity.path_remaining}
                </div>
                <Bar value={activity.path_progress} />
              </>
            ) : (
              <div className="text-[13px] text-[color:var(--pf-muted)] mb-3">Учебный маршрут не создан.</div>
            )}
            <div className="grid grid-cols-3 gap-4 mt-5">
              <div>
                <div className="text-[12px] text-[color:var(--pf-muted)]">Запланировано</div>
                <div className="text-[18px] font-medium">{activity.scheduled}</div>
              </div>
              <div>
                <div className="text-[12px] text-[color:var(--pf-muted)]">Проведено</div>
                <div className="text-[18px] font-medium">{activity.completed}</div>
              </div>
              <div>
                <div className="text-[12px] text-[color:var(--pf-muted)]">Регулярность</div>
                <div className="text-[18px] font-medium">{activity.regularity}%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Review */}
      <section className="mb-10">
        <p className="pf-eyebrow mb-4">Темы на повторение</p>
        <div className="pf-block">
          {review.length === 0 && <div className="text-[14px] text-[color:var(--pf-muted)]">Все освоенные темы свежи в памяти.</div>}
          {review.map((t) => (
            <Link
              key={t.topic_id}
              to="/student/topics/$topicId"
              params={{ topicId: t.topic_id }}
              className="grid grid-cols-[1fr,auto] gap-4 py-3 border-t first:border-t-0 border-[color:var(--pf-line)]"
            >
              <div>
                <div className="text-[15px] font-medium">{t.topic_title}</div>
                <div className="text-[12px] text-[color:var(--pf-muted)] mt-1">{t.subject_title}</div>
              </div>
              <div className="text-right text-[13px]">
                <div>{t.days_since} дн. назад</div>
                <div className="text-[11px] text-[color:var(--pf-muted)]">риск: {t.risk}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
