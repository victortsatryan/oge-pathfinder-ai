import { eachDayOfInterval, format, getISOWeek, isSunday, parseISO } from "date-fns";

export type PlanItemStatus = "pending" | "done";

export type LessonResource = {
  id: string;
  title: string;
  sourceUrl: string | null;
  difficulty: string;
  topicTitle: string | null;
  tasks: string[];
  contentMarkdown?: string | null;
  videoUrl?: string | null;
  solutionText?: string | null;
};

export type LessonResult = {
  attemptsTotal: number;
  solvedTotal: number;
  accuracyPercent: number | null;
  summary: string;
  lastActivityLabel: string | null;
};

export type ExternalSourceLink = {
  id: string;
  provider: string;
  title: string;
  url: string;
  blockKind: "theory" | "practice";
  blockTitle: string;
  note?: string | null;
};

export type PlanCustomTask = {
  id: string;
  prompt: string;
  expectedAnswer: string;
  explanation: string;
  sourceLabel: string;
  bankTaskId?: string | null;
};

export type PlanItem = {
  id: string;
  subject: string;
  section: string;
  topic: string;
  taskRange: string;
  week: number;
  dateISO: string;
  time: string;
  duration: string;
  status: PlanItemStatus;
  note: string;
  resources: LessonResource[];
  externalSources: ExternalSourceLink[];
  tasks: string[];
  result: LessonResult | null;
  customTasks?: PlanCustomTask[];
  teacherNote?: string | null;
  theoryMarkdown?: string | null;
  difficulty?: string | null;
  isEdited?: boolean;
};

export type SubjectProgram = {
  subject: string;
  examLabel: string;
  topicsTotal: number;
  tasksCoverage: string;
  focus: string;
};

export type CalendarDay = {
  id: string;
  dateISO: string;
  dayName: string;
  dayShort: string;
  dateLabel: string;
  isRestDay: boolean;
  isToday: boolean;
  isCurrentFocus: boolean;
  weekIndex: number;
};

export type CalendarWeek = {
  id: string;
  label: string;
  weekIndex: number;
  days: CalendarDay[];
};

export type ResultsSummary = {
  completedLessons: number;
  pendingLessons: number;
  restDays: number;
  materialsCount: number;
  attemptsTotal: number;
  averageAccuracy: number | null;
  insight: string;
};

export type LessonPracticeTask = {
  id: string;
  prompt: string;
  sourceLabel: string;
  expectedAnswer: string;
  explanation: string;
};

export type LessonDetail = {
  lesson: PlanItem;
  theoryText: string;
  videoUrl: string | null;
  coachIntro: string;
  practiceTasks: LessonPracticeTask[];
  recommendations: {
    review: string[];
    extraTasks: string[];
  };
  resourceLinks: Array<{
    id: string;
    title: string;
    url: string | null;
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
  calendarDays: CalendarDay[];
  calendarWeeks: CalendarWeek[];
  currentWeekIndex: number;
  subjectPrograms: SubjectProgram[];
  weeklyChecks: string[];
  editingHints: string[];
  results: ResultsSummary;
};

type ResourceInput = {
  id: string;
  title: string;
  sourceUrl: string | null;
  difficulty: string;
  subjectName: string;
  topicTitle: string | null;
  tasks: string[];
  contentMarkdown?: string | null;
  videoUrl?: string | null;
  solutionText?: string | null;
};

type AttemptInput = {
  lessonId: string | null;
  subjectName: string;
  topicTitle: string | null;
  isCorrect: boolean | null;
  score: number | null;
  submittedAt: string | null;
};

type LearningSourceInput = {
  id: string;
  subjectName: string; // BD subject name (e.g. "Английский", "Русский")
  provider: string;
  title: string;
  url: string;
  sourceKind: "theory" | "practice" | "mixed";
};

type LessonOverrideInput = {
  lessonKey: string;
  title: string | null;
  topic: string | null;
  lessonDate: string | null;
  slotNumber: number | null;
  difficulty: string | null;
  status: string | null;
  teacherNote: string | null;
  theoryMarkdown: string | null;
  tasks: PlanCustomTask[];
};

type LoadStateInput = {
  resources?: ResourceInput[];
  attempts?: AttemptInput[];
  learningSources?: LearningSourceInput[];
  lessonOverrides?: LessonOverrideInput[];
};

type SubjectBlueprint = {
  subject: string;
  section: string;
  focus: string;
  taskRange: string;
  notes: string[];
};

const PLAN_START = "2026-04-27";
const PLAN_END = "2026-05-30";
const SESSION_TIMES = ["09:00–10:00", "10:20–11:20", "11:40–12:40", "13:30–14:30"];
const SUBJECT_ORDER = ["Математика", "Русский язык", "Английский язык", "Биология"] as const;

const SUBJECT_BLUEPRINTS: Record<(typeof SUBJECT_ORDER)[number], SubjectBlueprint[]> = {
  "Математика": [
    {
      subject: "Математика",
      section: "Алгебра",
      focus: "Числа, вычисления, выражения",
      taskRange: "№1–5",
      notes: [
        "Разобрать базовые вычисления и типовые ловушки первой части.",
        "Сделать 10 коротких заданий на скорость и точность.",
      ],
    },
    {
      subject: "Математика",
      section: "Алгебра",
      focus: "Уравнения, неравенства, функции",
      taskRange: "№6–11",
      notes: [
        "Проверить ход решения и оформление промежуточных шагов.",
        "Закрепить шаблоны решений через короткий сет задач.",
      ],
    },
    {
      subject: "Математика",
      section: "Геометрия",
      focus: "Треугольники, окружность, площади",
      taskRange: "№15–19",
      notes: [
        "Собирать рисунок перед решением и подписывать данные.",
        "Держать в фокусе формулы площадей и углы.",
      ],
    },
    {
      subject: "Математика",
      section: "Практика второй части",
      focus: "Развёрнутые задачи и оформление",
      taskRange: "№20–26",
      notes: [
        "Отрабатывать структуру полного ответа и аргументацию.",
        "Сравнивать решение с образцом после каждого задания.",
      ],
    },
  ],
  "Русский язык": [
    {
      subject: "Русский язык",
      section: "Орфография",
      focus: "Орфограммы и пунктуация",
      taskRange: "№2–8",
      notes: [
        "После правила сразу решать мини-блок на закрепление.",
        "Собирать собственный список повторяющихся ошибок.",
      ],
    },
    {
      subject: "Русский язык",
      section: "Текст",
      focus: "Изложение и смысловой анализ",
      taskRange: "№1",
      notes: [
        "Тренировать сжатие текста по абзацам и микротемам.",
        "Фиксировать опорные слова перед пересказом.",
      ],
    },
    {
      subject: "Русский язык",
      section: "Синтаксис",
      focus: "Словосочетания, предложения, грамматика",
      taskRange: "№9–12",
      notes: [
        "Держать рядом таблицу конструкций и типов ошибок.",
        "Разбирать каждый неверный ответ через правило.",
      ],
    },
    {
      subject: "Русский язык",
      section: "Сочинение",
      focus: "Аргументация и композиция",
      taskRange: "№13.1–13.3",
      notes: [
        "Собирать заготовки тезисов и аргументов по темам.",
        "Проверять связность и вывод в конце ответа.",
      ],
    },
  ],
  "Английский язык": [
    {
      subject: "Английский язык",
      section: "Listening",
      focus: "Аудирование и выделение ключевой информации",
      taskRange: "№1–11",
      notes: [
        "Сначала слушать на общий смысл, затем на детали.",
        "Отдельно выписывать слова-маркеры времени и места.",
      ],
    },
    {
      subject: "Английский язык",
      section: "Reading",
      focus: "Чтение и понимание текста",
      taskRange: "№12–18",
      notes: [
        "Тренировать сканирование текста до детального чтения.",
        "Сопоставлять ответ с конкретной строкой текста.",
      ],
    },
    {
      subject: "Английский язык",
      section: "Grammar",
      focus: "Грамматика и словообразование",
      taskRange: "№19–32",
      notes: [
        "Разложить ошибки по временам, пассиву и word formation.",
        "Повторять через короткие циклы по 5–7 заданий.",
      ],
    },
    {
      subject: "Английский язык",
      section: "Writing & Speaking",
      focus: "Письмо, устный ответ, шаблоны высказывания",
      taskRange: "№33–38",
      notes: [
        "Держать под рукой шаблоны начала, связок и завершения.",
        "Проверять ответ по чек-листу критериев ОГЭ.",
      ],
    },
  ],
  "Биология": [
    {
      subject: "Биология",
      section: "Общая биология",
      focus: "Клетка, ткани, процессы жизнедеятельности",
      taskRange: "№1–6",
      notes: [
        "Повторять через схемы, рисунки и короткие карточки.",
        "Собирать базовые термины в отдельный словарь.",
      ],
    },
    {
      subject: "Биология",
      section: "Человек",
      focus: "Системы органов и физиология",
      taskRange: "№7–16",
      notes: [
        "Сравнивать системы органов в таблицах и схемах.",
        "После теории решать 6–8 типовых заданий подряд.",
      ],
    },
    {
      subject: "Биология",
      section: "Генетика",
      focus: "Наследственность и изменчивость",
      taskRange: "№17–21",
      notes: [
        "Разбирать каждую задачу через пошаговую схему решения.",
        "Отмечать типы наследования в заметках к блоку.",
      ],
    },
    {
      subject: "Биология",
      section: "Экология и эволюция",
      focus: "Экосистемы, отбор, развитие органического мира",
      taskRange: "№22–26",
      notes: [
        "Держать в памяти причинно-следственные связи и термины.",
        "В конце блока собирать мини-конспект по темам.",
      ],
    },
  ],
};

export function loadDefaultMvpState(input: LoadStateInput = {}): OgeMvpState {
  const resourceMap = groupResources(input.resources ?? []);
  const attemptMap = groupAttempts(input.attempts ?? []);
  const sourcesBySubject = groupLearningSources(input.learningSources ?? []);
  const { calendarDays, calendarWeeks, currentWeekIndex } = buildCalendar();

  // Track lesson index per subject so we can attach external sources to the
  // first two lessons of each subject as a test binding.
  const subjectLessonCounters = new Map<string, number>();

  let globalLessonIndex = 0;
  const planList: PlanItem[] = calendarDays.flatMap((day) => {
    if (day.isRestDay) return [];

    return SUBJECT_ORDER.map((subject, sessionIndex) => {
      const blueprintList = SUBJECT_BLUEPRINTS[subject];
      const blueprint = blueprintList[(day.weekIndex + sessionIndex) % blueprintList.length];
      const subjectResources = resourceMap.get(subject) ?? [];
      const matchedResources = subjectResources
        .filter((resource) => matchTopic(resource.topicTitle, blueprint.focus))
        .slice(0, 3);

      const id = `${subject.toLowerCase().replace(/\s+/g, "-")}-${day.dateISO}-${sessionIndex + 1}`;
      const status = globalLessonIndex < 6 ? "done" : "pending";
      globalLessonIndex += 1;

      const subjectLessonIndex = subjectLessonCounters.get(subject) ?? 0;
      subjectLessonCounters.set(subject, subjectLessonIndex + 1);
      const externalSources = buildExternalSourcesForLesson({
        subject,
        subjectLessonIndex,
        topic: blueprint.focus,
        sourcesBySubject,
      });

      return {
        id,
        subject,
        section: blueprint.section,
        topic: blueprint.focus,
        taskRange: blueprint.taskRange,
        week: day.weekIndex + 1,
        dateISO: day.dateISO,
        time: SESSION_TIMES[sessionIndex],
        duration: "60 мин",
        status,
        note: blueprint.notes[(day.weekIndex + sessionIndex) % blueprint.notes.length],
        resources: matchedResources,
        externalSources,
        tasks: matchedResources.flatMap((resource) => resource.tasks).slice(0, 5),
        result: resolveLessonResult({
          attempts: attemptMap.get(id) ?? [],
          subjectAttempts: attemptMap.get(subject) ?? [],
          topic: blueprint.focus,
          status,
        }),
      } satisfies PlanItem;
    });
  });

  // Apply per-user lesson overrides (server-provided)
  applyOverridesInPlace(planList, input.lessonOverrides ?? []);

  const materialsCount = planList.reduce((acc, item) => acc + item.resources.length, 0);
  const allAttempts = planList.flatMap((item) => (item.result ? [item.result] : []));
  const accuracyValues = allAttempts.map((item) => item.accuracyPercent).filter((value): value is number => value !== null);

  return {
    plan: {
      title: "Учебный план ОГЭ по умолчанию",
      periodLabel: "27 апреля — 30 мая",
      sessionsPerDay: 4,
      planSummary:
        "Календарь охватывает весь период подготовки по математике, русскому, английскому и биологии: 4 занятия в день, воскресенье как выходной, а редактирование занятий синхронизируется со страницей программы.",
    },
    stats: {
      period: "27 апреля — 30 мая",
      totalBlocks: `${planList.length} занятий`,
      coverage: "Все задания ОГЭ по 4 предметам",
    },
    planList,
    calendarDays,
    calendarWeeks,
    currentWeekIndex,
    subjectPrograms: [
      {
        subject: "Математика",
        examLabel: "Полная программа ОГЭ",
        topicsTotal: 6,
        tasksCoverage: "№1–26",
        focus: "Алгебра, геометрия, вторая часть",
      },
      {
        subject: "Русский язык",
        examLabel: "Полная программа ОГЭ",
        topicsTotal: 5,
        tasksCoverage: "№1–13.3",
        focus: "Изложение, тест, сочинение",
      },
      {
        subject: "Английский язык",
        examLabel: "Полная программа ОГЭ",
        topicsTotal: 5,
        tasksCoverage: "№1–38",
        focus: "Listening, reading, grammar, writing",
      },
      {
        subject: "Биология",
        examLabel: "Полная программа ОГЭ",
        topicsTotal: 5,
        tasksCoverage: "№1–26",
        focus: "Клетка, человек, генетика, экология",
      },
    ],
    weeklyChecks: [
      "Календарь переключается между режимами «весь период» и «неделя» без потери связки с программой.",
      "Каждый учебный день включает 4 занятия по 60 минут, воскресенье автоматически отмечено как выходной.",
      "Статусы done и pending сразу отражаются в дне, карточке занятия и общем результате.",
    ],
    editingHints: [
      "Откройте день в календаре, чтобы увидеть все 4 занятия и быстро перейти в карточку любого из них.",
      "В карточке можно менять тему, дату, время, заметку и статус выполнения — изменения сразу попадут и в программу, и в календарь.",
      "Материалы и задания подтягиваются из backend, как только вы загрузите ссылки в библиотеку материалов.",
    ],
    results: {
      completedLessons: planList.filter((item) => item.status === "done").length,
      pendingLessons: planList.filter((item) => item.status === "pending").length,
      restDays: calendarDays.filter((day) => day.isRestDay).length,
      materialsCount,
      attemptsTotal: allAttempts.reduce((acc, item) => acc + item.attemptsTotal, 0),
      averageAccuracy: accuracyValues.length ? Math.round(accuracyValues.reduce((acc, value) => acc + value, 0) / accuracyValues.length) : null,
      insight:
        materialsCount > 0
          ? "Карточки занятий уже готовы принимать материалы и отображать результаты попыток по мере работы ученика."
          : "Сетка занятий готова, но для автоподгрузки тем и заданий нужно загрузить ссылки и материалы в backend.",
    },
  };
}

export function getLessonDetail(state: OgeMvpState, lessonId: string): LessonDetail | null {
  const lesson = state.planList.find((item) => item.id === lessonId);

  if (!lesson) return null;

  const primaryResource = lesson.resources[0] ?? null;
  const fallbackTasks = buildFallbackPracticeTasks(lesson);
  const customTasks = lesson.customTasks ?? [];

  const practiceTasks: LessonPracticeTask[] = customTasks.length
    ? customTasks.map((t) => ({
        id: t.id,
        prompt: t.prompt,
        sourceLabel: t.sourceLabel || (t.bankTaskId ? "Из банка заданий" : "Добавлено вручную"),
        expectedAnswer: t.expectedAnswer || "—",
        explanation: t.explanation || `Сверьте решение с ключевой идеей темы «${lesson.topic}».`,
      }))
    : (lesson.tasks.length ? lesson.tasks : fallbackTasks.map((item) => item.prompt)).map((task, index) => ({
        id: `${lesson.id}-task-${index + 1}`,
        prompt: task,
        sourceLabel: primaryResource?.title ?? `Источник по теме ${lesson.topic}`,
        expectedAnswer: fallbackTasks[index]?.expectedAnswer ?? `Ответ ${index + 1}`,
        explanation:
          fallbackTasks[index]?.explanation ??
          `Сверьте решение с ключевой идеей темы «${lesson.topic}» и повторите правило перед следующей попыткой.`,
      }));

  return {
    lesson,
    theoryText:
      lesson.theoryMarkdown?.trim() ||
      primaryResource?.contentMarkdown?.trim() ||
      `На этом занятии разбираем тему «${lesson.topic}» по предмету ${lesson.subject}. Сначала коротко фиксируем базовое правило, затем смотрим на типовые шаги решения, и только после этого переходим к практике в формате ОГЭ.`,
    videoUrl: primaryResource?.videoUrl ?? primaryResource?.sourceUrl ?? null,
    coachIntro: `Сейчас идём как на уроке с репетитором: сначала теория по теме «${lesson.topic}», затем практика, проверка и персональные рекомендации.`,
    practiceTasks,
    recommendations: {
      review: buildReviewRecommendations(lesson),
      extraTasks: buildExtraTasks(lesson),
    },
    resourceLinks: lesson.resources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      url: resource.sourceUrl,
    })),
  };
}

function buildFallbackPracticeTasks(lesson: PlanItem): LessonPracticeTask[] {
  return [1, 2, 3].map((step) => ({
    id: `${lesson.id}-fallback-${step}`,
    prompt: `${lesson.subject}: задание ${step} по теме «${lesson.topic}». Кратко решите типовой номер формата ОГЭ.` ,
    sourceLabel: `Базовый шаблон занятия · ${lesson.taskRange}`,
    expectedAnswer: `Ключ ${step}`,
    explanation: `Проверьте, используете ли вы основное правило темы «${lesson.topic}», и сравните ход решения с эталонным алгоритмом.` ,
  }));
}

function buildReviewRecommendations(lesson: PlanItem): string[] {
  return [
    `Повторить опорное правило темы «${lesson.topic}».`,
    `Вернуться к блоку ${lesson.taskRange} и ещё раз проговорить ход решения вслух.`,
    `Сравнить собственные ответы с образцом и отметить 1–2 типовые ошибки в заметке занятия.`,
  ];
}

function buildExtraTasks(lesson: PlanItem): string[] {
  return [
    `Дополнительный мини-набор по теме «${lesson.topic}» на 3 задания.`,
    `Повторный короткий сет по диапазону ${lesson.taskRange} с таймером 12 минут.`,
    `Одно задание повышенной сложности по разделу «${lesson.section}».`,
  ];
}

function buildCalendar() {
  const allDates = eachDayOfInterval({ start: parseISO(PLAN_START), end: parseISO(PLAN_END) });
  const activeDates = allDates.filter((date) => !isSunday(date));
  const now = new Date();
  const fallbackCurrent = activeDates[0];
  const inPlan = allDates.find((date) => format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd"));
  const focusDate = inPlan ?? fallbackCurrent;
  const focusDateISO = format(focusDate, "yyyy-MM-dd");

  const calendarDays: CalendarDay[] = allDates.map((date) => {
    const dayIndex = dayIndexInRussian(date.getDay());
    const dateISO = format(date, "yyyy-MM-dd");
    const weekIndex = Math.floor((getDayOffset(dateISO) ?? 0) / 7);

    return {
      id: dateISO,
      dateISO,
      dayName: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"][date.getDay()],
      dayShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][date.getDay()],
      dateLabel: format(date, "d MMM"),
      isRestDay: isSunday(date),
      isToday: dateISO === format(now, "yyyy-MM-dd"),
      isCurrentFocus: dateISO === focusDateISO,
      weekIndex,
    };
  });

  const calendarWeeks: CalendarWeek[] = Array.from(new Set(calendarDays.map((day) => day.weekIndex))).map((weekIndex) => {
    const days = calendarDays.filter((day) => day.weekIndex === weekIndex);
    return {
      id: `week-${weekIndex + 1}`,
      label: `Неделя ${weekIndex + 1}`,
      weekIndex,
      days,
    };
  });

  return {
    calendarDays,
    calendarWeeks,
    currentWeekIndex: calendarDays.find((day) => day.isCurrentFocus)?.weekIndex ?? 0,
  };

  function getDayOffset(dateISO: string) {
    const index = allDates.findIndex((date) => format(date, "yyyy-MM-dd") === dateISO);
    return index >= 0 ? index : null;
  }

  function dayIndexInRussian(day: number) {
    return day === 0 ? 6 : day - 1;
  }
}

function groupResources(resources: ResourceInput[]) {
  return resources.reduce((map, resource) => {
    const list = map.get(resource.subjectName) ?? [];
    list.push(resource);
    map.set(resource.subjectName, list);
    return map;
  }, new Map<string, ResourceInput[]>());
}

function groupAttempts(attempts: AttemptInput[]) {
  const map = new Map<string, AttemptInput[]>();

  attempts.forEach((attempt) => {
    if (attempt.lessonId) {
      const lessonAttempts = map.get(attempt.lessonId) ?? [];
      lessonAttempts.push(attempt);
      map.set(attempt.lessonId, lessonAttempts);
    }

    const subjectAttempts = map.get(attempt.subjectName) ?? [];
    subjectAttempts.push(attempt);
    map.set(attempt.subjectName, subjectAttempts);
  });

  return map;
}

function resolveLessonResult({
  attempts,
  subjectAttempts,
  topic,
  status,
}: {
  attempts: AttemptInput[];
  subjectAttempts: AttemptInput[];
  topic: string;
  status: PlanItemStatus;
}): LessonResult | null {
  const topicAttempts = attempts.length
    ? attempts
    : subjectAttempts.filter((attempt) => matchTopic(attempt.topicTitle, topic)).slice(0, 5);

  if (!topicAttempts.length) {
    if (status === "done") {
      return {
        attemptsTotal: 0,
        solvedTotal: 0,
        accuracyPercent: null,
        summary: "Занятие отмечено выполненным; аналитика появится после первых ответов по заданиям.",
        lastActivityLabel: null,
      };
    }

    return null;
  }

  const solvedTotal = topicAttempts.filter((attempt) => attempt.isCorrect === true).length;
  const scoredAttempts = topicAttempts.filter((attempt) => typeof attempt.score === "number");
  const accuracyPercent = scoredAttempts.length
    ? Math.round(
        (scoredAttempts.reduce((acc, attempt) => acc + Number(attempt.score ?? 0), 0) / scoredAttempts.length) * 100,
      )
    : Math.round((solvedTotal / topicAttempts.length) * 100);
  const lastSubmitted = topicAttempts
    .map((attempt) => attempt.submittedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return {
    attemptsTotal: topicAttempts.length,
    solvedTotal,
    accuracyPercent,
    summary:
      accuracyPercent >= 75
        ? "Тема закрепляется уверенно: можно поднимать сложность и добавлять задания второй волны."
        : "Нужен ещё один цикл практики: сначала короткий разбор ошибок, затем новый мини-набор заданий.",
    lastActivityLabel: lastSubmitted ? format(parseISO(lastSubmitted), "d MMM") : null,
  };
}

function matchTopic(source: string | null, target: string) {
  if (!source) return true;
  const sourceWords = normalizeText(source).split(" ").filter(Boolean);
  const targetText = normalizeText(target);
  return sourceWords.some((word) => targetText.includes(word));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-zа-я0-9]+/gi, " ").trim();
}

const SUBJECT_NAME_MAP: Record<string, string> = {
  "Математика": "Математика",
  "Русский": "Русский язык",
  "Русский язык": "Русский язык",
  "Английский": "Английский язык",
  "Английский язык": "Английский язык",
  "Биология": "Биология",
};

function groupLearningSources(sources: LearningSourceInput[]) {
  const map = new Map<string, LearningSourceInput[]>();
  sources.forEach((source) => {
    const planSubject = SUBJECT_NAME_MAP[source.subjectName] ?? source.subjectName;
    const list = map.get(planSubject) ?? [];
    list.push(source);
    map.set(planSubject, list);
  });
  return map;
}

function buildExternalSourcesForLesson(args: {
  subject: string;
  subjectLessonIndex: number;
  topic: string;
  sourcesBySubject: Map<string, LearningSourceInput[]>;
}): ExternalSourceLink[] {
  if (args.subjectLessonIndex >= 2) return [];
  const sources = args.sourcesBySubject.get(args.subject) ?? [];
  if (sources.length === 0) return [];

  const theory =
    sources.find((s) => s.sourceKind === "theory") ?? sources.find((s) => s.sourceKind === "mixed");
  const practice =
    sources.find((s) => s.sourceKind === "practice") ?? sources.find((s) => s.sourceKind === "mixed");

  const blocks: ExternalSourceLink[] = [];
  if (theory) {
    blocks.push({
      id: `${theory.id}-theory-${args.subjectLessonIndex}`,
      provider: theory.provider,
      title: theory.title,
      url: theory.url,
      blockKind: "theory",
      blockTitle: `Теория: ${args.topic}`,
      note: `Разберите блок «${args.topic}» из источника ${theory.provider}.`,
    });
  }
  if (practice && practice.id !== theory?.id) {
    blocks.push({
      id: `${practice.id}-practice-${args.subjectLessonIndex}`,
      provider: practice.provider,
      title: practice.title,
      url: practice.url,
      blockKind: "practice",
      blockTitle: `Практика: ${args.topic}`,
      note: `Решите 5–7 заданий формата ОГЭ по теме «${args.topic}» в ${practice.provider}.`,
    });
  }
  return blocks;
}

