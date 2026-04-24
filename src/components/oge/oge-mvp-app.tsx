import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Brain,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CircleHelp,
  Clock3,
  PencilLine,
  TimerReset,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateDiagnosticAiPlan } from "@/lib/oge-ai.functions";
import type { CalendarDay, OgeMvpState, PlanItem, PlanItemStatus } from "@/lib/oge-mvp-data";

type ViewMode = "list" | "calendar" | "analytics" | "diagnostic";
type CalendarMode = "period" | "week";
type DiagnosticTaskType = "single" | "multiple" | "text";

type DiagnosticTask = {
  id: string;
  subject: string;
  topic: string;
  type: DiagnosticTaskType;
  prompt: string;
  sourceLabel: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
};

type EditablePlanField = keyof Pick<PlanItem, "topic" | "dateISO" | "time" | "note">;

const viewTabs: Array<{
  id: ViewMode;
  label: string;
  Icon: typeof Brain;
}> = [
  { id: "list", label: "Список программы", Icon: ClipboardList },
  { id: "calendar", label: "Календарь", Icon: CalendarDays },
  { id: "analytics", label: "Аналитика", Icon: Brain },
  { id: "diagnostic", label: "Диагностика", Icon: CircleHelp },
];

const WEEKLY_DIAGNOSTIC_DURATION_SECONDS = 60 * 60;

const weeklyDiagnosticTasks: DiagnosticTask[] = [
  {
    id: "diag-math-1",
    subject: "Математика",
    topic: "Уравнения и вычисления",
    type: "single",
    prompt: "Решите уравнение: 3x - 9 = 12",
    sourceLabel: "ОГЭ · математика · задание базового уровня",
    options: ["5", "6", "7", "8"],
    correctAnswer: "7",
    explanation: "Сначала переносим -9 вправо: 3x = 21, затем делим обе части на 3 и получаем x = 7.",
  },
  {
    id: "diag-rus-1",
    subject: "Русский язык",
    topic: "Пунктуация в сложном предложении",
    type: "single",
    prompt: "Укажите вариант, где нужна одна запятая: «Когда начался дождь ___ мы вернулись домой».",
    sourceLabel: "ОГЭ · русский язык · пунктуационный анализ",
    options: ["запятая не нужна", "перед словом «мы»", "после слова «мы»", "нужны две запятые"],
    correctAnswer: "перед словом «мы»",
    explanation: "Придаточная часть заканчивается перед главной, поэтому ставим одну запятую перед словом «мы».",
  },
  {
    id: "diag-eng-1",
    subject: "Английский язык",
    topic: "Grammar · Present Perfect",
    type: "text",
    prompt: "Complete the sentence with the correct verb form: ‘She ___ already ___ her homework.’ (do)",
    sourceLabel: "ОГЭ · English · grammar",
    correctAnswer: "has done",
    explanation: "Для Present Perfect with she используем has + V3, поэтому правильный ответ: has done.",
  },
  {
    id: "diag-bio-1",
    subject: "Биология",
    topic: "Клетка и органоиды",
    type: "multiple",
    prompt: "Выберите органоиды, которые участвуют в синтезе и транспорте веществ в клетке.",
    sourceLabel: "ОГЭ · биология · клетка",
    options: ["рибосомы", "эндоплазматическая сеть", "лейкоциты", "аппарат Гольджи"],
    correctAnswer: ["рибосомы", "эндоплазматическая сеть", "аппарат Гольджи"],
    explanation: "Рибосомы синтезируют белок, ЭПС и аппарат Гольджи обеспечивают транспорт и модификацию веществ.",
  },
  {
    id: "diag-math-2",
    subject: "Математика",
    topic: "Геометрия · площадь",
    type: "text",
    prompt: "Найдите площадь прямоугольника со сторонами 6 и 4. Запишите только число.",
    sourceLabel: "ОГЭ · математика · геометрия",
    correctAnswer: "24",
    explanation: "Площадь прямоугольника равна произведению сторон: 6 × 4 = 24.",
  },
  {
    id: "diag-rus-2",
    subject: "Русский язык",
    topic: "Орфография",
    type: "single",
    prompt: "Выберите слово с проверяемой безударной гласной в корне.",
    sourceLabel: "ОГЭ · русский язык · орфография",
    options: ["заг..реть", "т..варищ", "лесн..к", "к..саться"],
    correctAnswer: "лесн..к",
    explanation: "В слове «лесник» безударную гласную можно проверить словом «лес». Остальные случаи относятся к другим орфограммам.",
  },
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
  const calendarDays = Array.isArray(data?.calendarDays) ? data.calendarDays : [];
  const calendarWeeks = Array.isArray(data?.calendarWeeks) ? data.calendarWeeks : [];
  const initialPlanItems = Array.isArray(data?.planList) ? data.planList : [];
  const weeklyChecks = Array.isArray(data?.weeklyChecks) ? data.weeklyChecks : [];
  const subjectPrograms = Array.isArray(data?.subjectPrograms) ? data.subjectPrograms : [];
  const editingHints = Array.isArray(data?.editingHints) ? data.editingHints : [];

  const [activeView, setActiveView] = useState<ViewMode>("calendar");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("period");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(data?.currentWeekIndex ?? 0);
  const [expandedDayId, setExpandedDayId] = useState(
    calendarDays.find((day) => day.isCurrentFocus)?.id ?? calendarDays[0]?.id ?? "",
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [planItems, setPlanItems] = useState(initialPlanItems);
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<Record<string, string | string[]>>({});
  const [diagnosticStarted, setDiagnosticStarted] = useState(false);
  const [diagnosticSubmitted, setDiagnosticSubmitted] = useState(false);
  const [diagnosticRemainingSeconds, setDiagnosticRemainingSeconds] = useState(WEEKLY_DIAGNOSTIC_DURATION_SECONDS);

  const saturdayDays = useMemo(
    () => calendarDays.filter((day) => !day.isRestDay && day.dayShort === "Сб"),
    [calendarDays],
  );
  const nextDiagnosticDay = saturdayDays.find((day) => day.isCurrentFocus) ?? saturdayDays[0] ?? null;

  const diagnosticTasks = useMemo(() => weeklyDiagnosticTasks, []);

  const diagnosticResult = useMemo(() => {
    if (!diagnosticSubmitted) return null;

    const evaluatedTasks = diagnosticTasks.map((task) => {
      const answer = diagnosticAnswers[task.id];
      const normalizedUser = Array.isArray(answer)
        ? [...answer].map((item) => item.trim().toLowerCase()).sort()
        : typeof answer === "string"
          ? answer.trim().toLowerCase()
          : "";
      const normalizedCorrect = Array.isArray(task.correctAnswer)
        ? [...task.correctAnswer].map((item) => item.trim().toLowerCase()).sort()
        : task.correctAnswer.trim().toLowerCase();
      const isCorrect = Array.isArray(normalizedCorrect)
        ? Array.isArray(normalizedUser) && normalizedUser.join("|") === normalizedCorrect.join("|")
        : normalizedUser === normalizedCorrect;

      return {
        ...task,
        answer,
        isCorrect,
      };
    });

    const correctCount = evaluatedTasks.filter((task) => task.isCorrect).length;
    const scorePercent = Math.round((correctCount / Math.max(evaluatedTasks.length, 1)) * 100);
    const topicStats = Array.from(
      evaluatedTasks.reduce((map, task) => {
        const current = map.get(task.topic) ?? { topic: task.topic, subject: task.subject, total: 0, correct: 0 };
        current.total += 1;
        current.correct += task.isCorrect ? 1 : 0;
        map.set(task.topic, current);
        return map;
      }, new Map<string, { topic: string; subject: string; total: number; correct: number }>()).values(),
    ).map((item) => ({
      ...item,
      percent: Math.round((item.correct / Math.max(item.total, 1)) * 100),
    }));

    const weakTopics = topicStats.filter((item) => item.percent < 70).sort((a, b) => a.percent - b.percent);

    return {
      evaluatedTasks,
      scorePercent,
      correctCount,
      topicStats,
      weakTopics,
    };
  }, [diagnosticAnswers, diagnosticSubmitted, diagnosticTasks]);

  const diagnosticProgress = useMemo(() => {
    const answered = diagnosticTasks.filter((task) => {
      const value = diagnosticAnswers[task.id];
      return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim().length > 0;
    }).length;

    return {
      answered,
      total: diagnosticTasks.length,
      percent: Math.round((answered / Math.max(diagnosticTasks.length, 1)) * 100),
    };
  }, [diagnosticAnswers, diagnosticTasks]);

  useEffect(() => {
    if (!diagnosticStarted || diagnosticSubmitted) return;

    const timer = window.setInterval(() => {
      setDiagnosticRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setDiagnosticSubmitted(true);
          setDiagnosticStarted(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [diagnosticStarted, diagnosticSubmitted]);

  const dayMetaById = useMemo(
    () => new Map(calendarDays.map((day) => [day.id, day])),
    [calendarDays],
  );

  const subjectRows = useMemo(() => {
    return planItems.reduce(
      (map, item) => {
        const list = map.get(item.subject) ?? [];
        list.push(item);
        map.set(
          item.subject,
          list.sort((left, right) => {
            const dateCompare = left.dateISO.localeCompare(right.dateISO, "ru");
            return dateCompare === 0 ? left.time.localeCompare(right.time, "ru") : dateCompare;
          }),
        );
        return map;
      },
      new Map<string, PlanItem[]>(),
    );
  }, [planItems]);

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

  const analytics = useMemo(() => {
    const weeklyProgress = calendarWeeks.map((week) => {
      const lessons = week.days.flatMap((day) => lessonsByDay.get(day.id) ?? []);
      const completed = lessons.filter((item) => item.status === "done").length;
      const accuracyValues = lessons
        .map((item) => item.result?.accuracyPercent)
        .filter((value): value is number => typeof value === "number");

      return {
        week: `Н${week.weekIndex + 1}`,
        completed,
        accuracy: accuracyValues.length
          ? Math.round(accuracyValues.reduce((acc, value) => acc + value, 0) / accuracyValues.length)
          : 0,
      };
    });

    const subjectStats = subjectPrograms.map((subjectProgram) => {
      const lessons = subjectRows.get(subjectProgram.subject) ?? [];
      const completed = lessons.filter((item) => item.status === "done").length;
      const accuracyValues = lessons
        .map((item) => item.result?.accuracyPercent)
        .filter((value): value is number => typeof value === "number");
      const level = accuracyValues.length
        ? Math.round(accuracyValues.reduce((acc, value) => acc + value, 0) / accuracyValues.length)
        : Math.round((completed / Math.max(lessons.length, 1)) * 100);
      const recentAccuracy = lessons
        .slice(-4)
        .map((item) => item.result?.accuracyPercent)
        .filter((value): value is number => typeof value === "number");
      const previousAccuracy = lessons
        .slice(-8, -4)
        .map((item) => item.result?.accuracyPercent)
        .filter((value): value is number => typeof value === "number");
      const currentAverage = recentAccuracy.length
        ? Math.round(recentAccuracy.reduce((acc, value) => acc + value, 0) / recentAccuracy.length)
        : level;
      const previousAverage = previousAccuracy.length
        ? Math.round(previousAccuracy.reduce((acc, value) => acc + value, 0) / previousAccuracy.length)
        : currentAverage;

      return {
        subject: subjectProgram.subject,
        level,
        completed,
        total: lessons.length,
        dynamic: currentAverage - previousAverage,
      };
    });

    const weakTopics = planItems
      .map((item) => ({
        id: item.id,
        subject: item.subject,
        topic: item.topic,
        score: item.result?.accuracyPercent ?? (item.status === "done" ? 45 : null),
        summary: item.result?.summary ?? item.note,
      }))
      .filter((item): item is { id: string; subject: string; topic: string; score: number; summary: string } => typeof item.score === "number")
      .sort((left, right) => left.score - right.score)
      .slice(0, 6);

    const commonErrors = weakTopics.slice(0, 4).map((item) => ({
      id: item.id,
      subject: item.subject,
      title: `Ошибки в теме «${item.topic}»`,
      description:
        item.score < 60
          ? "Есть просадка в базовом алгоритме решения: стоит ещё раз пройти теорию и повторить 3–5 типовых номеров."
          : "Ошибки появляются на внимательности и проверке ответа: нужен короткий повтор с самопроверкой по шагам.",
    }));

    const recommendationBase = weakTopics.slice(0, 3);

    return {
      weeklyProgress,
      subjectStats,
      weakTopics,
      commonErrors,
      recommendations: [
        recommendationBase[0]
          ? `Сфокусироваться на теме «${recommendationBase[0].topic}» по предмету ${recommendationBase[0].subject}: сначала повторить теорию, затем решить короткий набор заданий.`
          : "Сохранять текущий темп и закреплять темы через короткие повторения каждые 2–3 дня.",
        recommendationBase[1]
          ? `Добавить ещё один мини-цикл практики по теме «${recommendationBase[1].topic}» и проверить, выросла ли точность после повторения.`
          : "После каждого выполненного урока сверять ход решения с образцом, а не только итоговый ответ.",
        subjectStats.length
          ? `Самый сильный предмет сейчас — ${[...subjectStats].sort((a, b) => b.level - a.level)[0]?.subject ?? "—"}; его можно использовать для поддержания уверенности и темпа.`
          : "Пока недостаточно данных для персональных советов — они появятся после первых решённых заданий.",
      ],
      completionShare: [
        { name: "Пройдено", value: planItems.filter((item) => item.status === "done").length, fill: "oklch(0.8 0.16 150)" },
        { name: "Не пройдено", value: planItems.filter((item) => item.status === "pending").length, fill: "oklch(0.93 0.01 250)" },
      ],
    };
  }, [calendarWeeks, lessonsByDay, planItems, subjectPrograms, subjectRows]);

  const visibleWeeks = calendarWeeks;
  const activeWeek = visibleWeeks[selectedWeekIndex] ?? visibleWeeks[0];
  const visibleDays = calendarMode === "period" ? calendarDays : activeWeek?.days ?? [];

  const expandedDay = useMemo(() => {
    return visibleDays.find((day) => day.id === expandedDayId) ?? visibleDays[0] ?? calendarDays[0] ?? null;
  }, [calendarDays, expandedDayId, visibleDays]);

  const expandedDayLessons = expandedDay ? lessonsByDay.get(expandedDay.id) ?? [] : [];
  const selectedLesson = selectedLessonId ? planItems.find((item) => item.id === selectedLessonId) ?? null : null;

  const completedCount = useMemo(() => planItems.filter((item) => item.status === "done").length, [planItems]);
  const statusLine = `${completedCount} из ${planItems.length} занятий отмечены как done`;

  const [diagnosticAi, setDiagnosticAi] = useState<null | Awaited<ReturnType<typeof generateDiagnosticAiPlan>>>(null);

  const handleFieldChange = (id: string, field: EditablePlanField, value: string) => {
    setPlanItems((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleStatusChange = (id: string, status: PlanItemStatus) => {
    setPlanItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const handleOpenDay = (day: CalendarDay) => {
    setExpandedDayId(day.id);
  };

  const handleOpenDayById = (dayId: string) => {
    setExpandedDayId(dayId);
    setActiveView("calendar");
  };

  const handleStartDiagnostic = () => {
    setDiagnosticStarted(true);
    setDiagnosticSubmitted(false);
    setDiagnosticRemainingSeconds(WEEKLY_DIAGNOSTIC_DURATION_SECONDS);
    setDiagnosticAnswers({});
  };

  const handleSubmitDiagnostic = () => {
    setDiagnosticSubmitted(true);
    setDiagnosticStarted(false);
  };

  const handleDiagnosticAnswerChange = (taskId: string, value: string) => {
    setDiagnosticAnswers((current) => ({ ...current, [taskId]: value }));
  };

  const handleDiagnosticMultiToggle = (taskId: string, option: string) => {
    setDiagnosticAnswers((current) => {
      const existing = Array.isArray(current[taskId]) ? [...current[taskId]] : [];
      const next = existing.includes(option) ? existing.filter((item) => item !== option) : [...existing, option];
      return { ...current, [taskId]: next };
    });
  };

  const handleGenerateAiPlan = async () => {
    const subjectStats = subjectPrograms.map((subjectProgram) => {
      const lessons = subjectRows.get(subjectProgram.subject) ?? [];
      const completed = lessons.filter((item) => item.status === "done").length;
      const accuracyValues = lessons
        .map((item) => item.result?.accuracyPercent)
        .filter((value): value is number => typeof value === "number");

      return {
        subject: subjectProgram.subject,
        completed,
        total: lessons.length,
        accuracy: accuracyValues.length
          ? Math.round(accuracyValues.reduce((acc, value) => acc + value, 0) / accuracyValues.length)
          : null,
      };
    });

    const response = await generateDiagnosticAiPlan({
      data: {
        completedLessons: data.results.completedLessons,
        pendingLessons: data.results.pendingLessons,
        averageAccuracy: data.results.averageAccuracy,
        subjectStats,
      },
    });

    setDiagnosticAi(response);
  };

  const contentTitle =
    activeView === "calendar"
      ? "Календарь учебного плана"
      : activeView === "list"
        ? "Связанная программа"
        : activeView === "analytics"
          ? "Аналитика ученика"
          : "Еженедельная диагностика";

  const contentDescription =
    activeView === "calendar"
      ? "Дневная сетка синхронизирована с программой: выберите день, раскройте 4 занятия и откройте карточку любого урока."
      : activeView === "list"
        ? "Любое изменение в программе сразу отражается в календаре и карточке занятия."
        : activeView === "analytics"
          ? "Графики и рекомендации собираются из выполненных уроков, результатов и связанной программы."
          : "По субботам ученик проходит 60-минутную диагностику в формате ОГЭ с быстрым разбором результата по темам.";

  const diagnosticTimerLabel = `${String(Math.floor(diagnosticRemainingSeconds / 60)).padStart(2, "0")}:${String(
    diagnosticRemainingSeconds % 60,
  ).padStart(2, "0")}`;

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
              <CardTitle>{contentTitle}</CardTitle>
              <CardDescription>{contentDescription}</CardDescription>
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
                                <div className="lesson-row__actions">
                                  <button type="button" className="action-link" onClick={() => setSelectedLessonId(lesson.id)}>
                                    Карточка
                                  </button>
                                  <Link to="/lesson/$lessonId" params={{ lessonId: lesson.id }} className="action-link">
                                    Открыть занятие
                                  </Link>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </>
              ) : activeView === "list" ? (
                <div className="program-subject-stack">
                  {subjectPrograms.map((subjectProgram) => {
                    const rows = subjectRows.get(subjectProgram.subject) ?? [];

                    return (
                      <section key={subjectProgram.subject} className="program-subject-panel">
                        <div className="program-subject-panel__head">
                          <div>
                            <div className="program-subject-title">
                              <span className={subjectToneClass[subjectProgram.subject] ?? "subject-tone"} />
                              <span>{subjectProgram.subject}</span>
                            </div>
                            <div className="list-row__meta">
                              {subjectProgram.tasksCoverage} · {subjectProgram.focus}
                            </div>
                          </div>
                          <span className="list-badge">{rows.length} занятий</span>
                        </div>

                        <Table className="program-table">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Дата</TableHead>
                              <TableHead>Тема</TableHead>
                              <TableHead>Статус</TableHead>
                              <TableHead>Результат</TableHead>
                              <TableHead>Рекомендации</TableHead>
                              <TableHead className="program-table__actions-head">Урок</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((item) => {
                              const dayMeta = dayMetaById.get(item.dateISO);
                              const resultLabel =
                                item.status === "done" && item.result
                                  ? item.result.accuracyPercent !== null
                                    ? `${item.result.accuracyPercent}% · ${item.result.solvedTotal}/${item.result.attemptsTotal}`
                                    : item.result.summary
                                  : "—";

                              const recommendationLabel = item.result?.summary || item.note || "—";

                              return (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <button type="button" className="program-date-button" onClick={() => handleOpenDayById(item.dateISO)}>
                                      <span className="list-row__title">{dayMeta?.dateLabel ?? item.dateISO}</span>
                                      <span className="list-row__meta">{dayMeta?.dayName ?? "День"}</span>
                                    </button>
                                  </TableCell>
                                  <TableCell>
                                    <button type="button" className="program-topic-button" onClick={() => setSelectedLessonId(item.id)}>
                                      <span className="list-row__title">{item.topic}</span>
                                      <span className="list-row__meta">
                                        {item.section} · {item.taskRange} · {item.time}
                                      </span>
                                    </button>
                                  </TableCell>
                                  <TableCell>
                                    <div className="program-status-cell">
                                      <span className={item.status === "done" ? "status-pill status-pill--done" : "status-pill status-pill--pending"}>
                                        {item.status === "done" ? "Пройдено" : "Не пройдено"}
                                      </span>
                                      <div className="status-toggle-row">
                                        <button
                                          type="button"
                                          className={item.status === "pending" ? "status-toggle is-active" : "status-toggle"}
                                          onClick={() => handleStatusChange(item.id, "pending")}
                                        >
                                          Нет
                                        </button>
                                        <button
                                          type="button"
                                          className={item.status === "done" ? "status-toggle is-active" : "status-toggle"}
                                          onClick={() => handleStatusChange(item.id, "done")}
                                        >
                                          Да
                                        </button>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="program-cell-copy">{resultLabel}</div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="program-cell-copy">{recommendationLabel}</div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="program-table__actions">
                                      <button type="button" className="action-link" onClick={() => setSelectedLessonId(item.id)}>
                                        Карточка
                                      </button>
                                      <Link to="/lesson/$lessonId" params={{ lessonId: item.id }} className="action-link">
                                        Открыть
                                      </Link>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="analytics-stack">
                  <div className="analytics-overview-grid">
                    <article className="analytics-surface">
                      <div className="analytics-surface__head">
                        <div>
                          <div className="list-row__title">Общий прогресс</div>
                          <div className="list-row__meta">Динамика выполнения и средней точности по неделям.</div>
                        </div>
                      </div>
                      <ChartContainer
                        className="analytics-chart"
                        config={{
                          completed: { label: "Пройдено", color: "oklch(0.45 0.03 248)" },
                          accuracy: { label: "Точность", color: "oklch(0.8 0.16 150)" },
                        }}
                      >
                        <LineChart data={analytics.weeklyProgress} margin={{ left: 8, right: 8, top: 12 }}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis dataKey="week" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} width={28} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line type="monotone" dataKey="completed" stroke="var(--color-completed)" strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="accuracy" stroke="var(--color-accuracy)" strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ChartContainer>
                    </article>

                    <article className="analytics-surface analytics-surface--compact">
                      <div className="analytics-surface__head">
                        <div>
                          <div className="list-row__title">Статус подготовки</div>
                          <div className="list-row__meta">Доля пройденных и оставшихся занятий.</div>
                        </div>
                      </div>
                      <ChartContainer
                        className="analytics-chart analytics-chart--compact"
                        config={{
                          done: { label: "Пройдено", color: "oklch(0.8 0.16 150)" },
                          pending: { label: "Не пройдено", color: "oklch(0.9 0.004 250)" },
                        }}
                      >
                        <PieChart>
                          <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                          <Pie data={analytics.completionShare} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>
                            {analytics.completionShare.map((entry) => (
                              <Pie key={entry.name} data={[entry]} dataKey="value" nameKey="name" fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="analytics-legend-stack">
                        {analytics.completionShare.map((entry) => (
                          <div key={entry.name} className="analytics-legend-row">
                            <span className="analytics-legend-dot" style={{ background: entry.fill }} />
                            <span>{entry.name}</span>
                            <strong>{entry.value}</strong>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>

                  <article className="analytics-surface">
                    <div className="analytics-surface__head">
                      <div>
                        <div className="list-row__title">По предметам</div>
                        <div className="list-row__meta">Уровень подготовки и динамика по каждому предмету.</div>
                      </div>
                    </div>
                    <div className="analytics-subject-grid">
                      <ChartContainer
                        className="analytics-chart"
                        config={{ level: { label: "Уровень", color: "oklch(0.74 0.15 250)" } }}
                      >
                        <BarChart data={analytics.subjectStats} margin={{ left: 8, right: 8, top: 12 }}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis dataKey="subject" tickLine={false} axisLine={false} interval={0} angle={-8} textAnchor="end" height={56} />
                          <YAxis tickLine={false} axisLine={false} width={28} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="level" fill="var(--color-level)" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ChartContainer>

                      <div className="analytics-subject-cards">
                        {analytics.subjectStats.map((item) => (
                          <article key={item.subject} className="subject-analytics-card">
                            <div className="subject-analytics-card__head">
                              <div className="program-subject-title">
                                <span className={subjectToneClass[item.subject] ?? "subject-tone"} />
                                <span>{item.subject}</span>
                              </div>
                              <span className="list-badge">{item.level}%</span>
                            </div>
                            <div className="subject-analytics-card__meta">
                              <span>Пройдено: {item.completed}/{item.total}</span>
                              <span>Динамика: {item.dynamic > 0 ? `+${item.dynamic}` : item.dynamic}%</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </article>

                  <div className="analytics-detail-grid">
                    <article className="analytics-surface">
                      <div className="analytics-surface__head">
                        <div>
                          <div className="list-row__title">Слабые темы</div>
                          <div className="list-row__meta">Темы с самой низкой точностью и требующие повторения.</div>
                        </div>
                      </div>
                      <div className="analytics-list-stack">
                        {analytics.weakTopics.length ? (
                          analytics.weakTopics.map((item) => (
                            <article key={item.id} className="analytics-list-card">
                              <div className="analytics-list-card__head">
                                <span className={subjectToneClass[item.subject] ?? "subject-chip"}>{item.subject}</span>
                                <strong>{item.score}%</strong>
                              </div>
                              <div className="list-row__title">{item.topic}</div>
                              <p className="status-line">{item.summary}</p>
                            </article>
                          ))
                        ) : (
                          <div className="calendar-empty">Слабые темы появятся после первых оценённых занятий.</div>
                        )}
                      </div>
                    </article>

                    <article className="analytics-surface">
                      <div className="analytics-surface__head">
                        <div>
                          <div className="list-row__title">Ошибки и AI-рекомендации</div>
                          <div className="list-row__meta">Типичные провалы и персональные советы для следующего шага.</div>
                        </div>
                      </div>
                      <div className="analytics-list-stack">
                        {analytics.commonErrors.map((item) => (
                          <article key={item.id} className="analytics-note-card">
                            <div className="list-row__title">{item.title}</div>
                            <p className="status-line">{item.description}</p>
                          </article>
                        ))}
                        {analytics.recommendations.map((item) => (
                          <article key={item} className="analytics-note-card analytics-note-card--accent">
                            <div className="list-row__title">AI-рекомендация</div>
                            <p className="status-line">{item}</p>
                          </article>
                        ))}
                      </div>
                    </article>
                  </div>
                </div>
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
                <CardTitle>Предметы и цветовые коды</CardTitle>
                <CardDescription>Цвет предмета в календаре, программе и карточке занятия совпадает.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                {subjectPrograms.map((item) => (
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
                <button type="button" className="action-link" onClick={handleGenerateAiPlan}>
                  AI-анализ после диагностики
                </button>
                {diagnosticAi ? (
                  <div className="analytics-list-stack">
                    <article className="analytics-note-card analytics-note-card--accent">
                      <div className="list-row__title">Краткий вывод</div>
                      <p className="status-line">{diagnosticAi.summary}</p>
                    </article>
                    {diagnosticAi.weakTopics.length ? (
                      <article className="analytics-note-card">
                        <div className="list-row__title">Слабые темы</div>
                        <div className="content-stack">
                          {diagnosticAi.weakTopics.map((item) => (
                            <div key={item} className="check-row">
                              <span>•</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </article>
                    ) : null}
                    {diagnosticAi.recommendations.length ? (
                      <article className="analytics-note-card">
                        <div className="list-row__title">Что улучшить</div>
                        <div className="content-stack">
                          {diagnosticAi.recommendations.map((item) => (
                            <div key={item} className="check-row">
                              <span>•</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </article>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Подсказки для правок</CardTitle>
                <CardDescription>Что можно редактировать уже сейчас.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                {editingHints.map((item) => (
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
                <Link to="/lesson/$lessonId" params={{ lessonId: selectedLesson.id }} className="action-link">
                  Перейти на страницу урока
                </Link>
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
