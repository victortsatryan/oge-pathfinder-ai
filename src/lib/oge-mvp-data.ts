import type { Database } from "@/integrations/supabase/types";

export const MVP_USER_ID = "00000000-0000-4000-8000-000000000001";

type SubjectRow = Database["public"]["Tables"]["subjects"]["Row"];
type StudyPlanRow = Database["public"]["Tables"]["study_plans"]["Row"];
type LessonRow = Database["public"]["Tables"]["lessons"]["Row"];
type DiagnosticRow = Database["public"]["Tables"]["diagnostic_sessions"]["Row"];
type RecommendationRow = Database["public"]["Tables"]["ai_recommendations"]["Row"];

export type OgeMvpState = {
  plan: {
    title: string;
    periodLabel: string;
    sessionsPerDay: number;
    planSummary: string;
  };
  stats: {
    period: string;
    dailySlots: string;
    aiFocus: string;
  };
  upcomingLessons: Array<{
    id: string;
    subject: string;
    time: string;
    topic: string;
    status: string;
  }>;
  calendarDays: Array<{
    day: string;
    summary: string;
  }>;
  diagnostics: Array<{
    id: string;
    title: string;
    meta: string;
    state: string;
  }>;
  subjectStats: Array<{
    subject: string;
    progress: string;
    focus: string;
  }>;
  weeklyChecks: string[];
  weakThemes: string[];
};

type FocusTopic = { subject: string; topic: string };

function isFocusTopic(value: unknown): value is FocusTopic {
  return (
    typeof value === "object" &&
    value !== null &&
    "subject" in value &&
    "topic" in value &&
    typeof value.subject === "string" &&
    typeof value.topic === "string"
  );
}

const SUBJECT_SEED = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "mathematics",
    name: "Математика",
    exam_code: "OGE-MATH",
    color_token: "subject-math",
    sort_order: 1,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "russian",
    name: "Русский",
    exam_code: "OGE-RUS",
    color_token: "subject-russian",
    sort_order: 2,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    slug: "english",
    name: "Английский",
    exam_code: "OGE-ENG",
    color_token: "subject-english",
    sort_order: 3,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "biology",
    name: "Биология",
    exam_code: "OGE-BIO",
    color_token: "subject-biology",
    sort_order: 4,
  },
] as const;

const TOPIC_SEED = [
  ["51111111-1111-4111-8111-111111111111", SUBJECT_SEED[0].id, "Квадратные уравнения", "algebra-1"],
  ["52222222-2222-4222-8222-222222222222", SUBJECT_SEED[0].id, "Геометрия", "geometry-1"],
  ["53333333-3333-4333-8333-333333333333", SUBJECT_SEED[1].id, "Сжатое изложение", "ru-writing-1"],
  ["54444444-4444-4444-8444-444444444444", SUBJECT_SEED[1].id, "Аргументация", "ru-writing-2"],
  ["55555555-5555-4555-8555-555555555555", SUBJECT_SEED[2].id, "Word formation", "eng-lexis-1"],
  ["56666666-6666-4666-8666-666666666666", SUBJECT_SEED[2].id, "Grammar", "eng-grammar-1"],
  ["57777777-7777-4777-8777-777777777777", SUBJECT_SEED[3].id, "Клетка и ткани", "bio-1"],
  ["58888888-8888-4888-8888-888888888888", SUBJECT_SEED[3].id, "Генетика", "bio-2"],
] as const;

const PLAN_ID = "99999999-9999-4999-8999-999999999999";

const LESSON_SEED: Array<Database["public"]["Tables"]["lessons"]["Insert"]> = [
  {
    id: "aaaaaaa1-1111-4111-8111-111111111111",
    user_id: MVP_USER_ID,
    plan_id: PLAN_ID,
    subject_id: SUBJECT_SEED[0].id,
    topic_id: TOPIC_SEED[0][0],
    lesson_date: "2026-04-27",
    slot_number: 1,
    title: "Квадратные уравнения",
    theory_markdown: "Разбор базовых формул и два тренировочных примера.",
    tasks: [
      { key: "math-1", prompt: "Реши квадратное уравнение x² - 5x + 6 = 0" },
      { key: "math-2", prompt: "Определи количество корней по дискриминанту" },
    ],
    difficulty: "adaptive",
    status: "available",
  },
  {
    id: "aaaaaaa2-2222-4222-8222-222222222222",
    user_id: MVP_USER_ID,
    plan_id: PLAN_ID,
    subject_id: SUBJECT_SEED[1].id,
    topic_id: TOPIC_SEED[2][0],
    lesson_date: "2026-04-27",
    slot_number: 2,
    title: "Сжатое изложение",
    theory_markdown: "Алгоритм сокращения текста и типовые ошибки пересказа.",
    tasks: [{ key: "rus-1", prompt: "Сократи текст, сохранив микротемы" }],
    difficulty: "adaptive",
    status: "available",
  },
  {
    id: "aaaaaaa3-3333-4333-8333-333333333333",
    user_id: MVP_USER_ID,
    plan_id: PLAN_ID,
    subject_id: SUBJECT_SEED[2].id,
    topic_id: TOPIC_SEED[4][0],
    lesson_date: "2026-04-27",
    slot_number: 3,
    title: "Word formation",
    theory_markdown: "Префиксы и суффиксы для задания на словообразование.",
    tasks: [{ key: "eng-1", prompt: "Преобразуй слово SUCCESS в нужную форму" }],
    difficulty: "adaptive",
    status: "available",
  },
  {
    id: "aaaaaaa4-4444-4444-8444-444444444444",
    user_id: MVP_USER_ID,
    plan_id: PLAN_ID,
    subject_id: SUBJECT_SEED[3].id,
    topic_id: TOPIC_SEED[6][0],
    lesson_date: "2026-04-27",
    slot_number: 4,
    title: "Клетка и ткани",
    theory_markdown: "Строение клетки, органоиды и их функции.",
    tasks: [{ key: "bio-1", prompt: "Соотнеси органоиды и их функции" }],
    difficulty: "adaptive",
    status: "available",
  },
  {
    id: "bbbbbbb1-1111-4111-8111-111111111111",
    user_id: MVP_USER_ID,
    plan_id: PLAN_ID,
    subject_id: SUBJECT_SEED[0].id,
    topic_id: TOPIC_SEED[1][0],
    lesson_date: "2026-04-29",
    slot_number: 1,
    title: "Геометрия: треугольники",
    theory_markdown: "Повторение теорем и типовых задач ОГЭ.",
    tasks: [{ key: "math-3", prompt: "Найди угол треугольника по условиям" }],
    difficulty: "adaptive",
    status: "completed",
  },
  {
    id: "bbbbbbb2-2222-4222-8222-222222222222",
    user_id: MVP_USER_ID,
    plan_id: PLAN_ID,
    subject_id: SUBJECT_SEED[1].id,
    topic_id: TOPIC_SEED[3][0],
    lesson_date: "2026-04-29",
    slot_number: 2,
    title: "Аргументация в сочинении",
    theory_markdown: "Схема тезис — аргумент — вывод.",
    tasks: [{ key: "rus-2", prompt: "Подбери аргумент к тезису" }],
    difficulty: "adaptive",
    status: "completed",
  },
  {
    id: "bbbbbbb3-3333-4333-8333-333333333333",
    user_id: MVP_USER_ID,
    plan_id: PLAN_ID,
    subject_id: SUBJECT_SEED[2].id,
    topic_id: TOPIC_SEED[5][0],
    lesson_date: "2026-04-30",
    slot_number: 3,
    title: "Grammar drill",
    theory_markdown: "Времена группы Present и Past в формате ОГЭ.",
    tasks: [{ key: "eng-2", prompt: "Выбери корректную форму глагола" }],
    difficulty: "adaptive",
    status: "completed",
  },
  {
    id: "bbbbbbb4-4444-4444-8444-444444444444",
    user_id: MVP_USER_ID,
    plan_id: PLAN_ID,
    subject_id: SUBJECT_SEED[3].id,
    topic_id: TOPIC_SEED[7][0],
    lesson_date: "2026-04-30",
    slot_number: 4,
    title: "Генетика",
    theory_markdown: "Моногибридное скрещивание и базовые законы Менделя.",
    tasks: [{ key: "bio-2", prompt: "Реши простую задачу на наследование" }],
    difficulty: "adaptive",
    status: "locked",
  },
];

const DIAGNOSTIC_SEED: Array<Database["public"]["Tables"]["diagnostic_sessions"]["Insert"]> = SUBJECT_SEED.map(
  (subject, index) => ({
    id: `d000000${index + 1}-0000-4000-8000-000000000000`,
    user_id: MVP_USER_ID,
    subject_id: subject.id,
    diagnostic_type: "entry",
    score: 12 + index * 2,
    max_score: 20,
    scheduled_for: "2026-04-26",
    completed_at: index < 2 ? "2026-04-26T10:00:00Z" : null,
    weaknesses:
      subject.name === "Математика"
        ? ["Геометрия"]
        : subject.name === "Русский"
          ? ["Изложение"]
          : subject.name === "Английский"
            ? ["Grammar"]
            : ["Генетика"],
    strengths: [],
    recommendations: [],
    answers: [],
  }),
);

const RECOMMENDATION_SEED: Database["public"]["Tables"]["ai_recommendations"]["Insert"] = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  user_id: MVP_USER_ID,
  source_kind: "weekly_overview",
  summary: "AI усиливает геометрию, изложение, grammar и генетику в ближайших занятиях.",
  focus_topics: [
    { subject: "Математика", topic: "Геометрия" },
    { subject: "Русский", topic: "Изложение" },
    { subject: "Английский", topic: "Grammar" },
    { subject: "Биология", topic: "Генетика" },
  ],
  next_steps: [
    "Суббота: короткая диагностика по пройденным темам",
    "AI пересчитывает сложность после каждой проверки",
    "Ошибки автоматически попадают в блок повторения",
  ],
};

export async function ensureMvpSeed(supabaseAdmin: {
  from: (table: string) => {
    select: (columns: string, options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) => Promise<{
      count: number | null;
      error: { message: string } | null;
    }>;
    insert: (values: unknown) => Promise<{ error: { message: string } | null }>;
  };
}) {
  const { count: subjectCount, error: subjectCountError } = await supabaseAdmin
    .from("subjects")
    .select("id", { count: "exact", head: true });

  if (subjectCountError) {
    throw new Error(`Не удалось проверить предметы: ${subjectCountError.message}`);
  }

  if (!subjectCount) {
    const { error } = await supabaseAdmin.from("subjects").insert(SUBJECT_SEED);
    if (error) throw new Error(`Не удалось создать предметы: ${error.message}`);

    const { error: topicsError } = await supabaseAdmin.from("topics").insert(
      TOPIC_SEED.map(([id, subjectId, title, themeCode], index) => ({
        id,
        subject_id: subjectId,
        title,
        theme_code: themeCode,
        sort_order: index + 1,
      })),
    );
    if (topicsError) throw new Error(`Не удалось создать темы: ${topicsError.message}`);
  }

  const { count: planCount, error: planCountError } = await supabaseAdmin
    .from("study_plans")
    .select("id", { count: "exact", head: true });

  if (planCountError) {
    throw new Error(`Не удалось проверить планы: ${planCountError.message}`);
  }

  if (!planCount) {
    const { error: planError } = await supabaseAdmin.from("study_plans").insert({
      id: PLAN_ID,
      user_id: MVP_USER_ID,
      title: "План подготовки к ОГЭ",
      period_start: "2026-04-27",
      period_end: "2026-05-30",
      sessions_per_day: 4,
      weekly_rest_day: 7,
      generated_by_ai: true,
      plan_summary: "Базовый MVP-план: 4 слота в день, входная диагностика и еженедельная коррекция.",
      metadata: { mode: "single-user-mvp" },
    });
    if (planError) throw new Error(`Не удалось создать план: ${planError.message}`);

    const { error: lessonError } = await supabaseAdmin.from("lessons").insert(LESSON_SEED);
    if (lessonError) throw new Error(`Не удалось создать уроки: ${lessonError.message}`);

    const { error: diagnosticError } = await supabaseAdmin.from("diagnostic_sessions").insert(DIAGNOSTIC_SEED);
    if (diagnosticError) throw new Error(`Не удалось создать диагностики: ${diagnosticError.message}`);

    const { error: recommendationError } = await supabaseAdmin
      .from("ai_recommendations")
      .insert(RECOMMENDATION_SEED);
    if (recommendationError) {
      throw new Error(`Не удалось создать AI-рекомендации: ${recommendationError.message}`);
    }
  }
}

export function buildMvpState(params: {
  subjects: SubjectRow[];
  plan: StudyPlanRow;
  lessons: LessonRow[];
  diagnostics: DiagnosticRow[];
  recommendations: RecommendationRow[];
}): OgeMvpState {
  const { subjects, plan, lessons, diagnostics, recommendations } = params;
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const recommendation = recommendations[0];
  const focusTopics = Array.isArray(recommendation?.focus_topics)
    ? recommendation.focus_topics.filter(isFocusTopic)
    : [];
  const nextSteps = Array.isArray(recommendation?.next_steps) ? recommendation.next_steps : [];

  const upcomingLessons = lessons
    .slice()
    .sort((a, b) => a.lesson_date.localeCompare(b.lesson_date) || a.slot_number - b.slot_number)
    .slice(0, 4)
    .map((lesson) => ({
      id: lesson.id,
      subject: subjectMap.get(lesson.subject_id) ?? "Предмет",
      time: slotLabel(lesson.slot_number),
      topic: lesson.title,
      status: lessonStatusLabel(lesson.status),
    }));

  const subjectStats = subjects.map((subject) => {
    const subjectLessons = lessons.filter((lesson) => lesson.subject_id === subject.id);
    const completed = subjectLessons.filter((lesson) => lesson.status === "completed").length;
    const progress = subjectLessons.length ? Math.round((completed / subjectLessons.length) * 100) : 0;
    const focusTopic = focusTopics.find((item) => item.subject === subject.name);

    return {
      subject: subject.name,
      progress: `${progress}%`,
      focus:
        focusTopics.find((item) => item.subject === subject.name)?.topic ??
        focusTopic?.topic ??
        "Следующая слабая тема будет определена после диагностики",
    };
  });

  return {
    plan: {
      title: plan.title,
      periodLabel: "27 апр — 30 мая",
      sessionsPerDay: plan.sessions_per_day,
      planSummary:
        plan.plan_summary ?? "План создаётся после диагностики и далее адаптируется после каждой проверки.",
    },
    stats: {
      period: "27 апр — 30 мая",
      dailySlots: `${plan.sessions_per_day} слота`,
      aiFocus:
        focusTopics
          .slice(0, 2)
          .map((item) => `${item.subject} · ${item.topic}`)
          .filter(Boolean)
          .join(" + ") || "Фокус появится после первой диагностики",
    },
    upcomingLessons,
    calendarDays: [
      { day: "Понедельник", summary: "4 занятия · математика, русский, английский, биология" },
      { day: "Вторник", summary: "4 занятия · практика и разбор ошибок" },
      { day: "Среда", summary: "4 занятия · теория + мини-тесты" },
      { day: "Четверг", summary: "4 занятия · углубление слабых тем" },
      { day: "Пятница", summary: "4 занятия · закрепление и повторение" },
      { day: "Суббота", summary: "Короткая диагностика · автопроверка · пересборка плана" },
    ],
    diagnostics: diagnostics.slice(0, 4).map((item) => ({
      id: item.id,
      title: item.diagnostic_type === "entry" ? "Входная диагностика" : "Недельная диагностика",
      meta: `${subjectMap.get(item.subject_id) ?? "Предмет"} · формат ОГЭ`,
      state: item.completed_at ? "Завершено" : "Готово к запуску",
    })),
    subjectStats,
    weeklyChecks:
      nextSteps.filter((item): item is string => typeof item === "string") ||
      [
        "Суббота: короткая диагностика по пройденным темам",
        "AI пересчитывает сложность после каждой проверки",
        "Ошибки автоматически попадают в блок повторения",
      ],
    weakThemes: focusTopics
      .map((item) => `${item.subject} · ${item.topic}`)
      .filter((item): item is string => Boolean(item)),
  };
}

function slotLabel(slotNumber: number) {
  const labels = ["09:00–10:00", "10:20–11:20", "11:40–12:40", "13:30–14:30"];
  return labels[slotNumber - 1] ?? `Слот ${slotNumber}`;
}

function lessonStatusLabel(status: LessonRow["status"]) {
  switch (status) {
    case "completed":
      return "Завершено";
    case "available":
      return "Фокус дня";
    case "missed":
      return "Нужно повторить";
    default:
      return "Запланировано";
  }
}