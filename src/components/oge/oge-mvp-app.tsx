import { useMemo, useState } from "react";
import {
  BookOpen,
  Brain,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  PencilLine,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CalendarDay, OgeMvpState, PlanItem, PlanItemStatus } from "@/lib/oge-mvp-data";

type ViewMode = "list" | "calendar";
type CalendarMode = "period" | "week";

type EditablePlanField = keyof Pick<PlanItem, "topic" | "dateISO" | "time" | "note">;

const viewTabs: Array<{
  id: ViewMode;
  label: string;
  Icon: typeof Brain;
}> = [
  { id: "list", label: "Список программы", Icon: ClipboardList },
  { id: "calendar", label: "Календарь", Icon: CalendarDays },
];

const calendarModeTabs: Array<{ id: CalendarMode; label: string }> = [
  { id: "period", label: "Весь период" },
  { id: "week", label: "Неделя" },
];

const subjectToneClass: Record<string, string> = {
  "Математика": "subject-tone subject-tone--math",
  "Русский язык": "subject-tone subject-tone--russian",
  "Английский язык": "subject-tone subject-tone--english",
  "Биология": "subject-tone subject-tone--biology",
};

const statusLabel: Record<PlanItemStatus, string> = {
  pending: "Pending",
  done: "Done",
};

type OgeMvpAppProps = {
  data: OgeMvpState;
};

export function OgeMvpApp({ data }: OgeMvpAppProps) {
  const [activeView, setActiveView] = useState<ViewMode>("calendar");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("period");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(data.currentWeekIndex);
  const [expandedDayId, setExpandedDayId] = useState(
    data.calendarDays.find((day) => day.isCurrentFocus)?.id ?? data.calendarDays[0]?.id ?? "",
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [planItems, setPlanItems] = useState(data.planList);

  const dayMetaById = useMemo(
    () => new Map(data.calendarDays.map((day) => [day.id, day])),
    [data.calendarDays],
  );

  const lessonsByDay = useMemo(() => {
    return planItems.reduce(
      (map, item) => {
        const list = map.get(item.dateISO) ?? [];
        list.push(item);
        map.set(
          item.dateISO,
          list.sort((left, right) => left.time.localeCompare(right.time, "ru")),
        );
        return map;
      },
      new Map<string, PlanItem[]>(),
    );
  }, [planItems]);

  const visibleWeeks = data.calendarWeeks;
  const activeWeek = visibleWeeks[selectedWeekIndex] ?? visibleWeeks[0];
  const visibleDays = calendarMode === "period" ? data.calendarDays : activeWeek?.days ?? [];

  const expandedDay = useMemo(() => {
    return visibleDays.find((day) => day.id === expandedDayId) ?? visibleDays[0] ?? data.calendarDays[0] ?? null;
  }, [data.calendarDays, expandedDayId, visibleDays]);

  const expandedDayLessons = expandedDay ? lessonsByDay.get(expandedDay.id) ?? [] : [];
  const selectedLesson = selectedLessonId ? planItems.find((item) => item.id === selectedLessonId) ?? null : null;

  const completedCount = useMemo(() => planItems.filter((item) => item.status === "done").length, [planItems]);
  const statusLine = `${completedCount} из ${planItems.length} занятий отмечены как done`;

  const handleFieldChange = (id: string, field: EditablePlanField, value: string) => {
    setPlanItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleStatusChange = (id: string, status: PlanItemStatus) => {
    setPlanItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const handleOpenDay = (day: CalendarDay) => {
    setExpandedDayId(day.id);
  };

  return (
    <main className="app-shell">
      <div className="page-grid app-layout">
        <section className="panel panel-hero">
          <div className="hero-stack">
            <p className="eyebrow">ОГЭ AI Coach</p>
            <h1 className="display-title">Календарь обучения на весь период подготовки.</h1>
            <p className="lead-copy">{data.plan.planSummary}</p>
          </div>

          <div className="info-strip">
            <CalendarCheck2 className="h-4 w-4" />
            <span>Период: 27 апреля — 30 мая · 4 занятия в день · воскресенье как выходной.</span>
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
            <strong className="stat-value">{data.stats.period}</strong>
            <span className="stat-meta">Режимы: весь период и неделя</span>
          </article>
          <article className="panel stat-block">
            <span className="stat-label">Учебный день</span>
            <strong className="stat-value">4 слота</strong>
            <span className="stat-meta">Математика, русский, английский, биология</span>
          </article>
          <article className="panel stat-block">
            <span className="stat-label">Статус</span>
            <strong className="stat-value">{completedCount}</strong>
            <span className="stat-meta">Выполненные занятия уже отмечены</span>
          </article>
        </section>

        <section className="content-grid">
          <Card className="panel content-panel">
            <CardHeader>
              <CardTitle>{activeView === "calendar" ? "Календарь учебного плана" : "Связанная программа"}</CardTitle>
              <CardDescription>
                {activeView === "calendar"
                  ? "Дневная сетка синхронизирована с программой: выберите день, раскройте 4 занятия и откройте карточку любого урока."
                  : "Любое изменение в программе сразу отражается в календаре и карточке занятия."}
              </CardDescription>
            </CardHeader>
            <CardContent className="content-stack">
              {activeView === "calendar" ? (
                <>
                  <div className="calendar-toolbar">
                    <div className="segmented-control" role="tablist" aria-label="Режим календаря">
                      {calendarModeTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          className={calendarMode === tab.id ? "segment-button is-active" : "segment-button"}
                          onClick={() => setCalendarMode(tab.id)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {calendarMode === "week" && activeWeek && (
                      <div className="week-switcher" aria-label="Переключение недели">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => setSelectedWeekIndex((current) => Math.max(0, current - 1))}
                          disabled={selectedWeekIndex === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <strong>{activeWeek.label}</strong>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => setSelectedWeekIndex((current) => Math.min(visibleWeeks.length - 1, current + 1))}
                          disabled={selectedWeekIndex === visibleWeeks.length - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className={calendarMode === "period" ? "calendar-days-grid" : "calendar-days-grid calendar-days-grid--week"}>
                    {visibleDays.map((day) => {
                      const dayLessons = lessonsByDay.get(day.id) ?? [];
                      const doneLessons = dayLessons.filter((item) => item.status === "done").length;
                      const isExpanded = expandedDay?.id === day.id;
                      const dayClassName = [
                        "calendar-day-card",
                        day.isRestDay ? "is-rest" : "",
                        day.isToday ? "is-today" : "",
                        isExpanded ? "is-expanded" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <button key={day.id} type="button" className={dayClassName} onClick={() => handleOpenDay(day)}>
                          <div className="calendar-day-card__head">
                            <div>
                              <strong>{day.dayShort}</strong>
                              <span>{day.dateLabel}</span>
                            </div>
                            {day.isToday && <span className="calendar-flag">Сегодня</span>}
                          </div>

                          {day.isRestDay ? (
                            <div className="calendar-rest-state">Выходной</div>
                          ) : (
                            <>
                              <div className="calendar-day-card__stats">
                                <span>{dayLessons.length} занятия</span>
                                <span>{doneLessons}/4 done</span>
                              </div>
                              <div className="calendar-subject-strip">
                                {dayLessons.map((lesson) => (
                                  <span key={lesson.id} className={subjectToneClass[lesson.subject] ?? "subject-tone"} />
                                ))}
                              </div>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {expandedDay && (
                    <section className="day-detail-panel">
                      <div className="day-detail-panel__head">
                        <div>
                          <div className="list-row__title">
                            {expandedDay.dayName}, {expandedDay.dateLabel}
                          </div>
                          <div className="list-row__meta">
                            {expandedDay.isRestDay
                              ? "Воскресенье выделено как выходной день."
                              : "Раскрытый список занятий на день: можно открыть поп-ап каждой карточки."}
                          </div>
                        </div>
                        {expandedDay.isToday && <span className="list-badge">Текущий день</span>}
                      </div>

                      {expandedDay.isRestDay ? (
                        <div className="calendar-empty">В этот день занятий нет.</div>
                      ) : (
                        <div className="day-lesson-stack">
                          {expandedDayLessons.map((lesson) => (
                            <article key={lesson.id} className="lesson-row">
                              <div className="lesson-row__left">
                                <span className={subjectToneClass[lesson.subject] ?? "subject-chip"}>{lesson.subject}</span>
                                <div>
                                  <div className="list-row__title">{lesson.topic}</div>
                                  <div className="list-row__meta">
                                    {lesson.section} · {lesson.taskRange} · {lesson.time} · {lesson.duration}
                                  </div>
                                </div>
                              </div>
                              <div className="lesson-row__right">
                                <span className={lesson.status === "done" ? "status-pill status-pill--done" : "status-pill status-pill--pending"}>
                                  {statusLabel[lesson.status]}
                                </span>
                                <button type="button" className="action-link" onClick={() => setSelectedLessonId(lesson.id)}>
                                  Открыть занятие
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </>
              ) : (
                planItems.map((item) => {
                  const dayMeta = dayMetaById.get(item.dateISO);
                  return (
                    <article key={item.id} className="plan-editor-card">
                      <div className="plan-editor-head">
                        <div>
                          <div className="list-row__title">{item.subject}</div>
                          <div className="list-row__meta">
                            {item.section} · {item.taskRange} · неделя {item.week} · {dayMeta?.dayName ?? item.dateISO}, {dayMeta?.dateLabel ?? item.dateISO}
                          </div>
                        </div>
                        <span className={item.status === "done" ? "status-pill status-pill--done" : "status-pill status-pill--pending"}>
                          {statusLabel[item.status]}
                        </span>
                      </div>

                      <div className="editor-grid editor-grid--program">
                        <label className="editor-field">
                          <span>Тема</span>
                          <input value={item.topic} onChange={(event) => handleFieldChange(item.id, "topic", event.target.value)} />
                        </label>
                        <label className="editor-field">
                          <span>Дата</span>
                          <input type="date" min="2026-04-27" max="2026-05-30" value={item.dateISO} onChange={(event) => handleFieldChange(item.id, "dateISO", event.target.value)} />
                        </label>
                        <label className="editor-field">
                          <span>Время</span>
                          <input value={item.time} onChange={(event) => handleFieldChange(item.id, "time", event.target.value)} />
                        </label>
                      </div>

                      <label className="editor-field editor-field--full">
                        <span>Заметка к блоку</span>
                        <textarea value={item.note} onChange={(event) => handleFieldChange(item.id, "note", event.target.value)} rows={3} />
                      </label>

                      <div className="program-card__footer">
                        <div className="program-card__meta">Материалы: {item.resources.length} · Задания: {item.tasks.length}</div>
                        <div className="status-toggle-row">
                          <button
                            type="button"
                            className={item.status === "pending" ? "status-toggle is-active" : "status-toggle"}
                            onClick={() => handleStatusChange(item.id, "pending")}
                          >
                            Pending
                          </button>
                          <button
                            type="button"
                            className={item.status === "done" ? "status-toggle is-active" : "status-toggle"}
                            onClick={() => handleStatusChange(item.id, "done")}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </CardContent>
          </Card>

          <aside className="rail-stack">
            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Состояние календаря</CardTitle>
                <CardDescription>{statusLine}</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                {data.weeklyChecks.map((item) => (
                  <div key={item} className="check-row">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Предметы и цветовые коды</CardTitle>
                <CardDescription>Цвет предмета в календаре, программе и карточке занятия совпадает.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                {data.subjectPrograms.map((item) => (
                  <article key={item.subject} className="subject-tile">
                    <div className="subject-tile__top">
                      <span className={subjectToneClass[item.subject] ?? "subject-tone"} />
                      <span className="subject-tile__name">{item.subject}</span>
                    </div>
                    <strong className="subject-tile__value">{item.tasksCoverage}</strong>
                    <span className="subject-tile__meta">{item.focus}</span>
                  </article>
                ))}
              </CardContent>
            </Card>

            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Результаты</CardTitle>
                <CardDescription>Сюда попадает анализ попыток и выполнения программы.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                <article className="result-card">
                  <span className="result-card__label">Выполнено</span>
                  <strong className="result-card__value">{data.results.completedLessons}</strong>
                  <span className="result-card__meta">{data.results.pendingLessons} занятий ещё pending</span>
                </article>
                <article className="result-card">
                  <span className="result-card__label">Материалы</span>
                  <strong className="result-card__value">{data.results.materialsCount}</strong>
                  <span className="result-card__meta">привязано к карточкам занятий</span>
                </article>
                <article className="result-card">
                  <span className="result-card__label">Точность</span>
                  <strong className="result-card__value">
                    {data.results.averageAccuracy !== null ? `${data.results.averageAccuracy}%` : "—"}
                  </strong>
                  <span className="result-card__meta">{data.results.attemptsTotal} попыток в анализе</span>
                </article>
                <p className="status-line">{data.results.insight}</p>
              </CardContent>
            </Card>

            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Подсказки для правок</CardTitle>
                <CardDescription>Что можно редактировать уже сейчас.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                {data.editingHints.map((item) => (
                  <div key={item} className="check-row">
                    <PencilLine className="h-4 w-4" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>

      <Dialog open={Boolean(selectedLesson)} onOpenChange={(open) => !open && setSelectedLessonId(null)}>
        {selectedLesson && (
          <DialogContent className="lesson-dialog">
            <DialogHeader>
              <DialogTitle>{selectedLesson.subject}</DialogTitle>
              <DialogDescription>
                {selectedLesson.section} · {selectedLesson.taskRange} · {selectedLesson.duration}
              </DialogDescription>
            </DialogHeader>

            <div className="lesson-dialog__stack">
              <div className="lesson-dialog__hero">
                <span className={subjectToneClass[selectedLesson.subject] ?? "subject-chip"}>{selectedLesson.subject}</span>
                <span className={selectedLesson.status === "done" ? "status-pill status-pill--done" : "status-pill status-pill--pending"}>
                  {statusLabel[selectedLesson.status]}
                </span>
              </div>

              <div className="editor-grid editor-grid--modal">
                <label className="editor-field">
                  <span>Тема</span>
                  <input
                    value={selectedLesson.topic}
                    onChange={(event) => handleFieldChange(selectedLesson.id, "topic", event.target.value)}
                  />
                </label>
                <label className="editor-field">
                  <span>Дата</span>
                  <input
                    type="date"
                    min="2026-04-27"
                    max="2026-05-30"
                    value={selectedLesson.dateISO}
                    onChange={(event) => handleFieldChange(selectedLesson.id, "dateISO", event.target.value)}
                  />
                </label>
                <label className="editor-field">
                  <span>Время</span>
                  <input
                    value={selectedLesson.time}
                    onChange={(event) => handleFieldChange(selectedLesson.id, "time", event.target.value)}
                  />
                </label>
              </div>

              <label className="editor-field editor-field--full">
                <span>Заметка к занятию</span>
                <textarea
                  rows={4}
                  value={selectedLesson.note}
                  onChange={(event) => handleFieldChange(selectedLesson.id, "note", event.target.value)}
                />
              </label>

              <div className="status-toggle-row">
                <button
                  type="button"
                  className={selectedLesson.status === "pending" ? "status-toggle is-active" : "status-toggle"}
                  onClick={() => handleStatusChange(selectedLesson.id, "pending")}
                >
                  Pending
                </button>
                <button
                  type="button"
                  className={selectedLesson.status === "done" ? "status-toggle is-active" : "status-toggle"}
                  onClick={() => handleStatusChange(selectedLesson.id, "done")}
                >
                  Done
                </button>
              </div>

              <section className="lesson-dialog__section">
                <div className="lesson-dialog__section-head">
                  <BookOpen className="h-4 w-4" />
                  <strong>Материалы и задания</strong>
                </div>
                {selectedLesson.resources.length ? (
                  <div className="resource-stack">
                    {selectedLesson.resources.map((resource) => (
                      <article key={resource.id} className="resource-card">
                        <div>
                          <div className="list-row__title">{resource.title}</div>
                          <div className="list-row__meta">
                            {resource.topicTitle ?? "Тема будет определена из загруженной ссылки"} · {resource.difficulty}
                          </div>
                        </div>
                        <div className="resource-card__footer">
                          <span>{resource.tasks.length} заданий</span>
                          {resource.sourceUrl ? (
                            <a className="action-link" href={resource.sourceUrl} target="_blank" rel="noreferrer">
                              Открыть ссылку
                            </a>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="calendar-empty">Материалы пока не загружены в backend — как только добавите ссылки, они появятся здесь.</div>
                )}

                {selectedLesson.tasks.length ? (
                  <div className="task-chip-row">
                    {selectedLesson.tasks.map((task, index) => (
                      <span key={`${selectedLesson.id}-${index}`} className="task-chip">
                        {task}
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="lesson-dialog__section">
                <div className="lesson-dialog__section-head">
                  <CalendarCheck2 className="h-4 w-4" />
                  <strong>Результаты по занятию</strong>
                </div>
                {selectedLesson.result ? (
                  <article className="result-card result-card--lesson">
                    <strong className="result-card__value">
                      {selectedLesson.result.accuracyPercent !== null ? `${selectedLesson.result.accuracyPercent}%` : "—"}
                    </strong>
                    <span className="result-card__meta">
                      Попыток: {selectedLesson.result.attemptsTotal} · Решено: {selectedLesson.result.solvedTotal}
                      {selectedLesson.result.lastActivityLabel ? ` · Последняя активность ${selectedLesson.result.lastActivityLabel}` : ""}
                    </span>
                    <p className="status-line">{selectedLesson.result.summary}</p>
                  </article>
                ) : (
                  <div className="calendar-empty">По этому занятию пока нет результатов: они появятся после сохранения решений.</div>
                )}
              </section>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </main>
  );
}
