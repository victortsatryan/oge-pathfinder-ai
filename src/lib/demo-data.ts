export type DemoStudent = {
  id: string;
  first_name: string;
  last_name: string | null;
  grade: number | null;
  subjects: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const demoStudents: DemoStudent[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    first_name: "Анна",
    last_name: "Петрова",
    grade: 9,
    subjects: ["Математика", "Русский язык"],
    notes: "Цель — уверенная четвёрка по математике и рост по пунктуации.",
    created_at: "2026-06-01T09:00:00.000Z",
    updated_at: "2026-06-01T09:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    first_name: "Илья",
    last_name: "Смирнов",
    grade: 9,
    subjects: ["Информатика", "Физика"],
    notes: "Сильная логика, нужно добрать скорость и оформление решений.",
    created_at: "2026-06-03T12:00:00.000Z",
    updated_at: "2026-06-03T12:00:00.000Z",
  },
];

export const demoProgress = {
  totalAttempts: 42,
  totalCorrect: 31,
  bySubject: [
    {
      subjectId: "math",
      name: "Математика",
      completedLessons: 6,
      totalLessons: 10,
      attempts: 18,
      correct: 12,
      accuracyPercent: 67,
      progressPercent: 60,
    },
    {
      subjectId: "russian",
      name: "Русский язык",
      completedLessons: 4,
      totalLessons: 8,
      attempts: 14,
      correct: 11,
      accuracyPercent: 79,
      progressPercent: 50,
    },
    {
      subjectId: "biology",
      name: "Биология",
      completedLessons: 3,
      totalLessons: 7,
      attempts: 10,
      correct: 8,
      accuracyPercent: 80,
      progressPercent: 43,
    },
  ],
};

export const demoProfile = {
  user_id: "demo-user",
  display_name: "Демо пользователь",
  first_name: "Анна",
  last_name: "Петрова",
  grade: 9,
  program: "ОГЭ 2026: математика, русский язык, биология",
  subjects: ["Математика", "Русский язык", "Биология"],
  avatar_url: null,
  target_grade: null,
  target_score: null,
  exam_year: 2026,
};