import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueries } from "@tanstack/react-query";

import { PageHeader } from "@/components/oge/page-header";
import {
  getStudentOverview,
  getWeakTopics,
  getMistakeAnalysis,
  getGoalForecast,
  getRecommendations,
  getSubjectAnalytics,
} from "@/lib/analytics.functions";

const qos = {
  overview: queryOptions({ queryKey: ["report", "overview"], queryFn: () => getStudentOverview() }),
  subjects: queryOptions({ queryKey: ["report", "subjects"], queryFn: () => getSubjectAnalytics() }),
  weak: queryOptions({ queryKey: ["report", "weak"], queryFn: () => getWeakTopics({ data: { limit: 8 } }) }),
  mistakes: queryOptions({ queryKey: ["report", "mistakes"], queryFn: () => getMistakeAnalysis() }),
  forecast: queryOptions({ queryKey: ["report", "forecast"], queryFn: () => getGoalForecast() }),
  recs: queryOptions({ queryKey: ["report", "recs"], queryFn: () => getRecommendations() }),
};

export const Route = createFileRoute("/_authenticated/student/report")({
  errorComponent: ({ error }) => <div role="alert" className="pf-block">Ошибка: {error.message}</div>,
  notFoundComponent: () => <div className="pf-block">Отчёт не найден.</div>,
  component: ReportPage,
});

function ReportPage() {
  const results = useQueries({ queries: Object.values(qos) });
  if (results.some((r) => r.isLoading)) {
    return <div className="pf-block text-[14px] text-[color:var(--pf-muted)]">Загружаем отчёт…</div>;
  }
  const [overviewQ, subjectsQ, weakQ, mistakesQ, forecastQ, recsQ] = results;
  const overview = overviewQ.data as any;
  const subjects = (subjectsQ.data ?? []) as any[];
  const weak = (weakQ.data ?? []) as any[];
  const mistakes = (mistakesQ.data ?? { by_type: [], by_topic: [], total: 0 }) as any;
  const forecast = forecastQ.data as any;
  const recs = (recsQ.data ?? []) as any[];

  if (!overview?.profile) {
    return (
      <div className="pf-block">
        <PageHeader title="Отчёт" lead="Сначала заполни профиль ученика." />
        <Link to="/onboarding" className="pf-btn mt-4">К онбордингу</Link>
      </div>
    );
  }

  const strong = subjects
    .flatMap((s) => (s.in_progress_topics ?? []).map((t: string) => ({ subject: s.subject_title, title: t })))
    .slice(0, 5);

  return (
    <>
      <PageHeader title="Отчёт о прогрессе" lead="Текущая картина обучения и ключевые рекомендации." />

      <section className="pf-block mb-8">
        <p className="pf-eyebrow mb-3">Цель</p>
        <div className="text-[18px] font-medium">{overview.profile.learning_goal ?? "Цель не задана"}</div>
        <div className="text-[13px] text-[color:var(--pf-muted)] mt-1">
          Целевой балл: {overview.profile.target_score ?? "—"} · Класс: {overview.profile.grade ?? "—"}
        </div>
        {forecast && (
          <div className="mt-4 text-[14px]">
            Текущий средний уровень: <b>{forecast.current_score}%</b> · до цели: <b>{Math.max(0, forecast.gap)}%</b> ·
            Вероятность: <b>{forecast.likelihood === "high" ? "высокая" : forecast.likelihood === "medium" ? "средняя" : "низкая"}</b>
          </div>
        )}
      </section>

      <section className="grid sm:grid-cols-3 gap-px bg-[color:var(--pf-line-strong)] border border-[color:var(--pf-line-strong)] rounded mb-8">
        <div className="bg-[color:var(--pf-paper)] p-5">
          <div className="pf-eyebrow mb-2">Освоено</div>
          <div className="pf-h2" style={{ fontFamily: "var(--font-mono)" }}>{overview.mastered_topics}</div>
        </div>
        <div className="bg-[color:var(--pf-paper)] p-5">
          <div className="pf-eyebrow mb-2">В работе</div>
          <div className="pf-h2" style={{ fontFamily: "var(--font-mono)" }}>{overview.learning_topics}</div>
        </div>
        <div className="bg-[color:var(--pf-paper)] p-5">
          <div className="pf-eyebrow mb-2">Слабые</div>
          <div className="pf-h2" style={{ fontFamily: "var(--font-mono)" }}>{overview.weak_topics}</div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-8 mb-8">
        <div>
          <p className="pf-eyebrow mb-3">Сильные стороны</p>
          <div className="pf-block">
            {strong.length === 0 && <div className="text-[13px] text-[color:var(--pf-muted)]">Пока недостаточно данных.</div>}
            {strong.map((t, i) => (
              <div key={i} className="py-2 border-t first:border-t-0 border-[color:var(--pf-line)]">
                <div className="text-[14px]">{t.title}</div>
                <div className="text-[12px] text-[color:var(--pf-muted)]">{t.subject}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="pf-eyebrow mb-3">Слабые темы</p>
          <div className="pf-block">
            {weak.length === 0 && <div className="text-[13px] text-[color:var(--pf-muted)]">Нет слабых тем.</div>}
            {weak.map((t) => (
              <div key={t.topic_id} className="py-2 border-t first:border-t-0 border-[color:var(--pf-line)]">
                <div className="text-[14px]">{t.topic_title} — <b>{t.mastery_score}%</b></div>
                <div className="text-[12px] text-[color:var(--pf-muted)]">{t.subject_title}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-8">
        <p className="pf-eyebrow mb-3">Типичные ошибки</p>
        <div className="pf-block">
          {mistakes.by_type.length === 0 && <div className="text-[13px] text-[color:var(--pf-muted)]">Ошибок не зафиксировано.</div>}
          {mistakes.by_type.slice(0, 6).map((m: any) => (
            <div key={m.type} className="flex justify-between py-2 border-t first:border-t-0 border-[color:var(--pf-line)]">
              <span>{m.type}</span>
              <span className="font-mono">{m.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="pf-eyebrow mb-3">Что делать дальше</p>
        <div className="pf-block">
          {recs.length === 0 && <div className="text-[13px] text-[color:var(--pf-muted)]">Продолжай в том же темпе.</div>}
          {recs.slice(0, 6).map((r, i) => (
            <div key={i} className="py-3 border-t first:border-t-0 border-[color:var(--pf-line)]">
              <div className="text-[14px] font-medium">{r.topic_title}</div>
              <div className="text-[12px] text-[color:var(--pf-muted)] mt-1">{r.subject_title}</div>
              <div className="text-[13px] mt-1">{r.reason}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 flex gap-3">
        <Link to="/student/analytics" className="pf-btn">Полная аналитика</Link>
        <Link to="/student/path" className="pf-btn pf-btn--ghost">Учебный маршрут</Link>
      </div>
    </>
  );
}
