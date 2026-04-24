import { useState } from "react";
import {
  BookOpen,
  Brain,
  CalendarDays,
  ChartColumnBig,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ViewMode = "dashboard" | "calendar" | "diagnostics" | "analytics";

const upcomingLessons = [
  { subject: "Математика", time: "09:00–10:00", topic: "Квадратные уравнения", status: "Фокус дня" },
  { subject: "Русский", time: "10:20–11:20", topic: "Сжатое изложение", status: "Практика" },
  { subject: "Английский", time: "11:40–12:40", topic: "Word formation", status: "Повторение" },
  { subject: "Биология", time: "13:30–14:30", topic: "Клетка и ткани", status: "Теория + тест" },
];

const weeklyChecks = [
  "Суббота: короткая диагностика по пройденным темам",
  "AI пересчитывает сложность после каждой проверки",
  "Ошибки автоматически попадают в блок повторения",
];

const subjectStats = [
  { subject: "Математика", progress: "62%", focus: "Текстовые задачи и геометрия" },
  { subject: "Русский", progress: "71%", focus: "Аргументация и изложение" },
  { subject: "Английский", progress: "68%", focus: "Грамматика и аудирование" },
  { subject: "Биология", progress: "74%", focus: "Системы органов и генетика" },
];

const diagnostics = [
  { title: "Входная диагностика", meta: "4 предмета · формат ОГЭ", state: "Готово к запуску" },
  { title: "Недельная диагностика", meta: "Каждую субботу", state: "Автопроверка" },
];

const viewTabs: Array<{
  id: ViewMode;
  label: string;
  Icon: typeof Brain;
}> = [
  { id: "dashboard", label: "Dashboard", Icon: Brain },
  { id: "calendar", label: "Календарь", Icon: CalendarDays },
  { id: "diagnostics", label: "Диагностика", Icon: BookOpen },
  { id: "analytics", label: "Аналитика", Icon: ChartColumnBig },
];

export function OgeMvpApp() {
  const [activeView, setActiveView] = useState<ViewMode>("dashboard");

  return (
    <main className="app-shell">
      <div className="page-grid app-layout">
        <section className="panel panel-hero">
          <div className="hero-stack">
            <p className="eyebrow">ОГЭ AI Coach</p>
            <h1 className="display-title">Персональная подготовка к ОГЭ по 4 предметам.</h1>
            <p className="lead-copy">
              Один базовый интерфейс для диагностики, календаря, ежедневных занятий и аналитики
              прогресса ученика.
            </p>
          </div>

          <div className="info-strip">
            <Brain className="h-4 w-4" />
            <span>Базовый MVP-режим: без авторизации, без выбора тем, с фокусом на учебном плане.</span>
          </div>

          <div className="tab-row" role="tablist" aria-label="Разделы приложения">
            {viewTabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={activeView === id ? "tab-chip is-active" : "tab-chip"}
                onClick={() => setActiveView(id)}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="stats-grid">
          <article className="panel stat-block">
            <span className="stat-label">Период</span>
            <strong className="stat-value">27 апр — 30 мая</strong>
            <span className="stat-meta">Пн–Сб, 4 занятия в день</span>
          </article>
          <article className="panel stat-block">
            <span className="stat-label">Сегодня</span>
            <strong className="stat-value">4 слота</strong>
            <span className="stat-meta">1 предмет = 1 час</span>
          </article>
          <article className="panel stat-block">
            <span className="stat-label">AI-фокус</span>
            <strong className="stat-value">Геометрия + изложение</strong>
            <span className="stat-meta">Приоритет следующей недели</span>
          </article>
        </section>

        <section className="content-grid">
          <Card className="panel content-panel">
            <CardHeader>
              <CardTitle>
                {activeView === "dashboard"
                  ? "Ближайшие занятия"
                  : activeView === "calendar"
                    ? "Календарь подготовки"
                    : activeView === "diagnostics"
                      ? "Диагностика"
                      : "Аналитика ошибок"}
              </CardTitle>
              <CardDescription>
                {activeView === "dashboard"
                  ? "AI учитывает ошибки, слабые темы и перестраивает ежедневный план."
                  : activeView === "calendar"
                    ? "Каждый учебный день содержит по одному занятию на предмет."
                    : activeView === "diagnostics"
                      ? "Входная и еженедельная диагностика в формате ОГЭ с автопроверкой."
                      : "Собираем проблемные темы, динамику и рекомендации после каждого занятия."}
              </CardDescription>
            </CardHeader>
            <CardContent className="content-stack">
              {activeView === "dashboard" &&
                upcomingLessons.map((lesson) => (
                  <article key={lesson.subject} className="list-row">
                    <div>
                      <div className="list-row__title">{lesson.subject}</div>
                      <div className="list-row__meta">
                        {lesson.time} · {lesson.topic}
                      </div>
                    </div>
                    <span className="list-badge">{lesson.status}</span>
                  </article>
                ))}

              {activeView === "calendar" &&
                ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"].map((day) => (
                  <article key={day} className="list-row list-row--calendar">
                    <div>
                      <div className="list-row__title">{day}</div>
                      <div className="list-row__meta">4 занятия · математика, русский, английский, биология</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </article>
                ))}

              {activeView === "diagnostics" &&
                diagnostics.map((item) => (
                  <article key={item.title} className="list-row">
                    <div>
                      <div className="list-row__title">{item.title}</div>
                      <div className="list-row__meta">{item.meta}</div>
                    </div>
                    <span className="list-badge">{item.state}</span>
                  </article>
                ))}

              {activeView === "analytics" &&
                subjectStats.map((item) => (
                  <article key={item.subject} className="list-row">
                    <div>
                      <div className="list-row__title">{item.subject}</div>
                      <div className="list-row__meta">Слабое место: {item.focus}</div>
                    </div>
                    <span className="list-badge">{item.progress}</span>
                  </article>
                ))}
            </CardContent>
          </Card>

          <aside className="rail-stack">
            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Рекомендации AI</CardTitle>
                <CardDescription>После каждой практики система уточняет план.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                {weeklyChecks.map((item) => (
                  <div key={item} className="check-row">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Слабые темы недели</CardTitle>
                <CardDescription>То, что будет усиливаться в следующих слотах.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                <div className="focus-pill">Математика · Геометрия</div>
                <div className="focus-pill">Русский · Изложение</div>
                <div className="focus-pill">Английский · Grammar</div>
                <div className="focus-pill">Биология · Генетика</div>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
