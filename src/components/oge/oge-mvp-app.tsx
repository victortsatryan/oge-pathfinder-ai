import { useMemo, useState } from "react";
import {
  Brain,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  PencilLine,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OgeMvpState, PlanItem } from "@/lib/oge-mvp-data";

type ViewMode = "list" | "calendar";

const viewTabs: Array<{
  id: ViewMode;
  label: string;
  Icon: typeof Brain;
}> = [
  { id: "list", label: "Список программы", Icon: ClipboardList },
  { id: "calendar", label: "Календарь", Icon: CalendarDays },
];

type OgeMvpAppProps = {
  data: OgeMvpState;
};

export function OgeMvpApp({ data }: OgeMvpAppProps) {
  const [activeView, setActiveView] = useState<ViewMode>("list");
  const [planItems, setPlanItems] = useState(data.planList);

  const calendarColumns = useMemo(() => {
    return data.calendarColumns.map((column) => ({
      ...column,
      entries: planItems
        .filter((item) => item.dateLabel === column.dateLabel)
        .map((item) => ({ id: item.id, subject: item.subject, topic: item.topic, time: item.time })),
    }));
  }, [data.calendarColumns, planItems]);

  const statusLabel = useMemo(
    () => `${planItems.filter((item) => item.status !== "completed").length} блоков можно редактировать сейчас`,
    [planItems],
  );

  const handleFieldChange = (id: string, field: keyof Pick<PlanItem, "topic" | "day" | "time" | "note">, value: string) => {
    setPlanItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  return (
    <main className="app-shell">
      <div className="page-grid app-layout">
        <section className="panel panel-hero">
          <div className="hero-stack">
            <p className="eyebrow">ОГЭ AI Coach</p>
            <h1 className="display-title">Учебный план ОГЭ по всем заданиям.</h1>
            <p className="lead-copy">{data.plan.planSummary}</p>
          </div>

          <div className="info-strip">
            <Brain className="h-4 w-4" />
            <span>Сейчас в MVP нет диагностики: стартуем с полной программы по умолчанию и редактируем её вручную.</span>
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
            <span className="stat-meta">Пн–Сб, {data.plan.sessionsPerDay} занятия в день</span>
          </article>
          <article className="panel stat-block">
            <span className="stat-label">Сегодня</span>
            <strong className="stat-value">{data.stats.totalBlocks}</strong>
            <span className="stat-meta">Редактируемые блоки программы</span>
          </article>
          <article className="panel stat-block">
            <span className="stat-label">Покрытие</span>
            <strong className="stat-value">{data.stats.coverage}</strong>
            <span className="stat-meta">Все задания по каждому предмету включены</span>
          </article>
        </section>

        <section className="content-grid">
          <Card className="panel content-panel">
            <CardHeader>
              <CardTitle>{activeView === "list" ? "Список учебной программы" : "Календарь учебной программы"}</CardTitle>
              <CardDescription>
                {activeView === "list"
                  ? "Каждый блок можно сразу отредактировать: тему, день, время и рабочую заметку."
                  : "Календарь собирается из того же списка блоков и обновляется прямо по вашим изменениям."}
              </CardDescription>
            </CardHeader>
            <CardContent className="content-stack">
              {activeView === "list" &&
                planItems.map((item) => (
                  <article key={item.id} className="plan-editor-card">
                    <div className="plan-editor-head">
                      <div>
                        <div className="list-row__title">{item.subject}</div>
                        <div className="list-row__meta">
                          {item.section} · {item.taskRange} · неделя {item.week}
                        </div>
                      </div>
                      <span className="list-badge">{item.status === "completed" ? "Готово" : "В работе"}</span>
                    </div>

                    <div className="editor-grid">
                      <label className="editor-field">
                        <span>Тема</span>
                        <input value={item.topic} onChange={(event) => handleFieldChange(item.id, "topic", event.target.value)} />
                      </label>
                      <label className="editor-field">
                        <span>День</span>
                        <input value={item.day} onChange={(event) => handleFieldChange(item.id, "day", event.target.value)} />
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
                  </article>
                ))}

              {activeView === "calendar" && (
                <div className="calendar-board">
                  {calendarColumns.map((column) => (
                    <article key={column.dateLabel} className="calendar-column">
                      <div className="calendar-column__head">
                        <strong>{column.day}</strong>
                        <span>{column.dateLabel}</span>
                      </div>
                      <div className="calendar-column__stack">
                        {column.entries.length ? (
                          column.entries.map((entry) => (
                            <div key={entry.id} className="calendar-entry">
                              <div className="calendar-entry__time">{entry.time}</div>
                              <div className="calendar-entry__subject">{entry.subject}</div>
                              <div className="calendar-entry__topic">{entry.topic}</div>
                            </div>
                          ))
                        ) : (
                          <div className="calendar-empty">Свободно</div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <aside className="rail-stack">
            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Как редактировать план</CardTitle>
                <CardDescription>{statusLabel}</CardDescription>
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
                <CardTitle>Предметные блоки программы</CardTitle>
                <CardDescription>Стартовая раскладка по полному покрытию заданий ОГЭ.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                {data.subjectPrograms.map((item) => (
                  <article key={item.subject} className="subject-tile">
                    <span className="subject-tile__name">{item.subject}</span>
                    <strong className="subject-tile__value">{item.tasksCoverage}</strong>
                    <span className="subject-tile__meta">{item.focus}</span>
                  </article>
                ))}
              </CardContent>
            </Card>

            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Подсказки для правок</CardTitle>
                <CardDescription>То, что уже можно менять прямо сейчас, без отдельного мастера.</CardDescription>
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
    </main>
  );
}
