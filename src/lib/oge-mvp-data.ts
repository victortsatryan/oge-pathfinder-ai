export type PlanItemStatus = "planned" | "in-progress" | "completed";

export type PlanItem = {
  id: string;
  subject: string;
  section: string;
  topic: string;
  taskRange: string;
  week: number;
  day: string;
  dateLabel: string;
  time: string;
  duration: string;
  status: PlanItemStatus;
  note: string;
};

export type SubjectProgram = {
  subject: string;
  examLabel: string;
  topicsTotal: number;
  tasksCoverage: string;
  focus: string;
};

export type CalendarColumn = {
  day: string;
  dateLabel: string;
  entries: Array<{
    id: string;
    subject: string;
    topic: string;
    time: string;
  }>;
};

export type OgeMvpState = {
  plan: {
    title: string;
    periodLabel: string;
    sessionsPerDay: number;
    planSummary: string;
  };
  stats: {
    period: string;
    totalBlocks: string;
    coverage: string;
  };
  planList: PlanItem[];
  calendarColumns: CalendarColumn[];
  subjectPrograms: SubjectProgram[];
  weeklyChecks: string[];
  editingHints: string[];
};

export function loadDefaultMvpState(): OgeMvpState {
  const planList: PlanItem[] = [
    {
      id: "math-1",
      subject: "Математика",
      section: "Алгебра",
      topic: "Числа, выражения, уравнения",
      taskRange: "№1–5, №9",
      week: 1,
      day: "Понедельник",
      dateLabel: "27 апр",
      time: "09:00–10:00",
      duration: "60 мин",
      status: "in-progress",
      note: "Базовый старт по обязательной части, затем перейти к уравнениям и преобразованиям.",
    },
    {
      id: "rus-1",
      subject: "Русский язык",
      section: "Орфография и текст",
      topic: "Изложение, орфография, синтаксис",
      taskRange: "№1, №2–8",
      week: 1,
      day: "Понедельник",
      dateLabel: "27 апр",
      time: "10:20–11:20",
      duration: "60 мин",
      status: "planned",
      note: "Сразу держим связку: теория правила → короткие задания → мини-разбор ошибок.",
    },
    {
      id: "eng-1",
      subject: "Английский язык",
      section: "Грамматика и лексика",
      topic: "Grammar, word formation, vocabulary",
      taskRange: "№19–32",
      week: 1,
      day: "Понедельник",
      dateLabel: "27 апр",
      time: "11:40–12:40",
      duration: "60 мин",
      status: "planned",
      note: "Начать с типовых форматов ОГЭ и собрать базовую матрицу ошибок по grammar.",
    },
    {
      id: "bio-1",
      subject: "Биология",
      section: "Общая биология",
      topic: "Клетка, ткани, организм",
      taskRange: "№1–6",
      week: 1,
      day: "Понедельник",
      dateLabel: "27 апр",
      time: "13:30–14:30",
      duration: "60 мин",
      status: "planned",
      note: "Собрать фундамент по базовым понятиям перед блоками по человеку и генетике.",
    },
    {
      id: "math-2",
      subject: "Математика",
      section: "Геометрия",
      topic: "Треугольники, окружность, площадь",
      taskRange: "№15–19, №23–25",
      week: 1,
      day: "Вторник",
      dateLabel: "28 апр",
      time: "09:00–10:00",
      duration: "60 мин",
      status: "planned",
      note: "Отдельный большой блок под геометрию как обязательную зону покрытия плана.",
    },
    {
      id: "rus-2",
      subject: "Русский язык",
      section: "Текст и речь",
      topic: "Сочинение, аргументация, анализ текста",
      taskRange: "№13.1–13.3",
      week: 1,
      day: "Вторник",
      dateLabel: "28 апр",
      time: "10:20–11:20",
      duration: "60 мин",
      status: "planned",
      note: "План писать по шаблону: тезис, комментарий, аргумент, вывод.",
    },
    {
      id: "eng-2",
      subject: "Английский язык",
      section: "Аудирование и чтение",
      topic: "Listening, reading comprehension",
      taskRange: "№1–18",
      week: 1,
      day: "Среда",
      dateLabel: "29 апр",
      time: "11:40–12:40",
      duration: "60 мин",
      status: "planned",
      note: "Чередовать короткие тренировки аудирования и чтения, не смешивая форматы в одном слоте.",
    },
    {
      id: "bio-2",
      subject: "Биология",
      section: "Человек и здоровье",
      topic: "Системы органов, физиология",
      taskRange: "№7–16",
      week: 1,
      day: "Среда",
      dateLabel: "29 апр",
      time: "13:30–14:30",
      duration: "60 мин",
      status: "planned",
      note: "Сделать акцент на схемах и сравнительных таблицах по системам органов.",
    },
    {
      id: "math-3",
      subject: "Математика",
      section: "Практика второй части",
      topic: "Развёрнутые задачи и стратегия оформления",
      taskRange: "№20–26",
      week: 2,
      day: "Четверг",
      dateLabel: "30 апр",
      time: "09:00–10:00",
      duration: "60 мин",
      status: "planned",
      note: "Вынести вторую часть в отдельные недели, но держать в основной программе по умолчанию.",
    },
    {
      id: "bio-3",
      subject: "Биология",
      section: "Эволюция и экология",
      topic: "Генетика, экология, эволюция",
      taskRange: "№17–26",
      week: 2,
      day: "Пятница",
      dateLabel: "1 мая",
      time: "13:30–14:30",
      duration: "60 мин",
      status: "planned",
      note: "Финальный блок предмета покрывает всю вторую половину экзаменационной программы.",
    },
  ];

  const subjectPrograms: SubjectProgram[] = [
    {
      subject: "Математика",
      examLabel: "Полная программа ОГЭ",
      topicsTotal: 6,
      tasksCoverage: "№1–26",
      focus: "Алгебра, геометрия, практика второй части",
    },
    {
      subject: "Русский язык",
      examLabel: "Полная программа ОГЭ",
      topicsTotal: 5,
      tasksCoverage: "№1–13.3",
      focus: "Изложение, тестовая часть, сочинение",
    },
    {
      subject: "Английский язык",
      examLabel: "Полная программа ОГЭ",
      topicsTotal: 5,
      tasksCoverage: "№1–38",
      focus: "Аудирование, чтение, grammar, письмо",
    },
    {
      subject: "Биология",
      examLabel: "Полная программа ОГЭ",
      topicsTotal: 5,
      tasksCoverage: "№1–26",
      focus: "Общая биология, человек, генетика, экология",
    },
  ];

  const calendarColumns: CalendarColumn[] = [
    {
      day: "Пн",
      dateLabel: "27 апр",
      entries: planList.filter((item) => item.dateLabel === "27 апр").map(toCalendarEntry),
    },
    {
      day: "Вт",
      dateLabel: "28 апр",
      entries: planList.filter((item) => item.dateLabel === "28 апр").map(toCalendarEntry),
    },
    {
      day: "Ср",
      dateLabel: "29 апр",
      entries: planList.filter((item) => item.dateLabel === "29 апр").map(toCalendarEntry),
    },
    {
      day: "Чт",
      dateLabel: "30 апр",
      entries: planList.filter((item) => item.dateLabel === "30 апр").map(toCalendarEntry),
    },
    {
      day: "Пт",
      dateLabel: "1 мая",
      entries: planList.filter((item) => item.dateLabel === "1 мая").map(toCalendarEntry),
    },
  ];

  return {
    plan: {
      title: "Учебный план ОГЭ по умолчанию",
      periodLabel: "27 апр — 30 мая",
      sessionsPerDay: 4,
      planSummary:
        "Стартовая программа покрывает все задания ОГЭ по математике, русскому, английскому и биологии; порядок, темы и заметки можно редактировать прямо в интерфейсе.",
    },
    stats: {
      period: "27 апр — 30 мая",
      totalBlocks: `${planList.length} блоков`,
      coverage: "Все предметы · полное покрытие ОГЭ",
    },
    planList,
    calendarColumns,
    subjectPrograms,
    weeklyChecks: [
      "Список и календарь показывают одну и ту же программу в двух форматах.",
      "Любой блок можно редактировать: тему, день, время и заметку учителя.",
      "Это базовая программа по умолчанию — дальше её можно адаптировать под ученика вручную.",
    ],
    editingHints: [
      "Меняйте тему внутри блока, если хотите переназначить акцент недели.",
      "Переставляйте дни и время, чтобы собрать свой ритм подготовки.",
      "Добавляйте заметки, чтобы фиксировать приоритеты, материалы и формат работы.",
    ],
  };
}

function toCalendarEntry(item: PlanItem) {
  return {
    id: item.id,
    subject: item.subject,
    topic: item.topic,
    time: item.time,
  };
}