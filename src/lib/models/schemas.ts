import { z } from "zod";

/**
 * Domain models — canonical shapes the UI works with.
 * Server functions return raw DTOs; repositories parse them through these.
 * Fields are tolerant (nullable, defaults) to survive minor backend drift.
 */

// -------- Student overview / analytics --------

export const studentOverviewSchema = z.object({
  profile: z
    .object({
      id: z.string(),
      learning_goal: z.string().nullable().optional(),
      target_score: z.union([z.string(), z.number()]).nullable().optional(),
      grade: z.number().nullable().optional(),
    })
    .nullable(),
  active_subjects: z.number().default(0),
  avg_mastery: z.number().default(0),
  total_topics: z.number().default(0),
  mastered_topics: z.number().default(0),
  learning_topics: z.number().default(0),
  weak_topics: z.number().default(0),
  lessons_count: z.number().default(0),
  diagnostics_count: z.number().default(0),
  streak_days: z.number().default(0),
});
export type StudentOverview = z.infer<typeof studentOverviewSchema>;

export const EMPTY_STUDENT_OVERVIEW: StudentOverview = {
  profile: null,
  active_subjects: 0,
  avg_mastery: 0,
  total_topics: 0,
  mastered_topics: 0,
  learning_topics: 0,
  weak_topics: 0,
  lessons_count: 0,
  diagnostics_count: 0,
  streak_days: 0,
};

export const weakTopicSchema = z.object({
  topic_id: z.string(),
  subject_id: z.string().nullable(),
  topic_title: z.string().default("—"),
  subject_title: z.string().default("—"),
  mastery_score: z.number().default(0),
  status: z.string().default("weak"),
  mistakes_count: z.number().default(0),
  last_activity_at: z.string().nullable().optional(),
});
export type WeakTopic = z.infer<typeof weakTopicSchema>;

export const recommendationSchema = z.object({
  kind: z.string(),
  topic_id: z.string(),
  topic_title: z.string().default("—"),
  subject_title: z.string().default("—"),
  reason: z.string().default(""),
  priority: z.number().default(0),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

// -------- Calendar --------

export const calendarEventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  event_date: z.string(),
  start_time: z.string().nullable().optional(),
  duration_minutes: z.number().nullable().optional(),
  status: z.string().default("planned"),
  lesson_id: z.string().nullable().optional(),
  diagnostic_session_id: z.string().nullable().optional(),
  subject_id: z.string().nullable().optional(),
  topic_id: z.string().nullable().optional(),
  subjects: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  topics: z.object({ title: z.string().nullable().optional() }).nullable().optional(),
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

// -------- Catalog --------

export const subjectSchema = z.object({
  id: z.string(),
  slug: z.string().nullable().optional(),
  name: z.string().default("—"),
  category: z.string().nullable().optional(),
  exam_type: z.string().nullable().optional(),
});
export type Subject = z.infer<typeof subjectSchema>;

export const subjectProgramSchema = z.object({
  id: z.string(),
  slug: z.string().nullable().optional(),
  title: z.string().default("—"),
  exam_type: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
});
export type SubjectProgram = z.infer<typeof subjectProgramSchema>;

// -------- Student profile --------

export const studentProfileSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  age: z.number().nullable().optional(),
  country: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  learning_goal: z.string().nullable().optional(),
  target_exam: z.string().nullable().optional(),
  target_program: z.string().nullable().optional(),
  target_date: z.string().nullable().optional(),
  target_score: z.string().nullable().optional(),
  preferred_intensity: z.string().nullable().optional(),
  education_system: z.string().nullable().optional(),
  learning_goals: z.array(z.string()).nullable().optional(),
  learning_barriers: z.array(z.string()).nullable().optional(),
  self_assessment: z.string().nullable().optional(),
  available_time: z.string().nullable().optional(),
  onboarding_summary: z.string().nullable().optional(),
  onboarding_completed: z.boolean().nullable().optional(),
});
export type StudentProfile = z.infer<typeof studentProfileSchema>;

export const studentSubjectSchema = z.object({
  id: z.string(),
  goal: z.string().nullable().optional(),
  target_level: z.string().nullable().optional(),
  target_score: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  subject: subjectSchema.nullable().default(null),
  program: subjectProgramSchema.nullable().default(null),
});
export type StudentSubject = z.infer<typeof studentSubjectSchema>;

export const topicProgressRowSchema = z.object({
  id: z.string(),
  mastery_score: z.number().default(0),
  status: z.string().default("not_started"),
  attempts_count: z.number().nullable().optional(),
  mistakes_count: z.number().nullable().optional(),
  last_activity_at: z.string().nullable().optional(),
  topic: z
    .object({
      id: z.string().optional(),
      title: z.string().default("—"),
      sort_order: z.number().nullable().optional(),
    })
    .nullable()
    .default(null),
  subject: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
});
export type TopicProgressRow = z.infer<typeof topicProgressRowSchema>;

export const mistakeRowSchema = z.object({
  id: z.string(),
  mistake_type: z.string().default("other"),
  mistake_description: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  created_at: z.string(),
  topic: z.object({ title: z.string().nullable().optional() }).nullable().optional(),
  subject: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
});
export type MistakeRow = z.infer<typeof mistakeRowSchema>;

export const profileAnalyticsSchema = z.object({
  bySubject: z
    .array(
      z.object({
        subject_id: z.string(),
        name: z.string().default("—"),
        avg: z.number().default(0),
        weakCount: z.number().default(0),
        reviewCount: z.number().default(0),
        totalTopics: z.number().default(0),
      }),
    )
    .default([]),
  weakCount: z.number().default(0),
  reviewCount: z.number().default(0),
  mistakesCount: z.number().default(0),
  lastActivityAt: z.string().nullable().default(null),
});
export type ProfileAnalytics = z.infer<typeof profileAnalyticsSchema>;

export const EMPTY_PROFILE_ANALYTICS: ProfileAnalytics = {
  bySubject: [],
  weakCount: 0,
  reviewCount: 0,
  mistakesCount: 0,
  lastActivityAt: null,
};

// -------- Learning path --------

export const learningPathSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  generated_by: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type LearningPath = z.infer<typeof learningPathSchema>;

const lessonRefSchema = z.object({
  id: z.string(),
  status: z.string().nullable().optional(),
});

export const learningPathItemSchema = z.object({
  id: z.string(),
  title: z.string().default("—"),
  description: z.string().nullable().optional(),
  priority: z.number().default(0),
  order_index: z.number().default(0),
  planned_date: z.string().nullable().optional(),
  duration_minutes: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  topic_id: z.string().nullable().optional(),
  subject_id: z.string().nullable().optional(),
  subjects: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  topics: z.object({ title: z.string().nullable().optional() }).nullable().optional(),
  // Supabase may return either an array or a single embedded row.
  lessons: z
    .union([z.array(lessonRefSchema), lessonRefSchema, z.null()])
    .transform((v) => (Array.isArray(v) ? (v[0] ?? null) : v))
    .nullable()
    .default(null),
});
export type LearningPathItem = z.infer<typeof learningPathItemSchema>;

// -------- Diagnostics --------

export const diagnosticTestSchema = z.object({
  id: z.string(),
  title: z.string().default("—"),
  description: z.string().nullable().optional(),
  diagnostic_type: z.string().nullable().optional(),
  duration_minutes: z.number().nullable().optional(),
  subject: subjectSchema.nullable().default(null),
  program: z
    .object({
      id: z.string(),
      title: z.string().default("—"),
      exam_type: z.string().nullable().optional(),
      grade: z.string().nullable().optional(),
    })
    .nullable()
    .default(null),
});
export type DiagnosticTest = z.infer<typeof diagnosticTestSchema>;

export const diagnosticHistoryRowSchema = z.object({
  id: z.string(),
  status: z.string().default("in_progress"),
  score: z.number().nullable().optional(),
  max_score: z.number().nullable().optional(),
  score_percent: z.number().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  diagnostic_type: z.string().nullable().optional(),
  subject: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  diagnostic_test: z.object({ title: z.string().nullable().optional() }).nullable().optional(),
});
export type DiagnosticHistoryRow = z.infer<typeof diagnosticHistoryRowSchema>;

// -------- Community library --------

export const candidateSchema = z.object({
  id: z.string(),
  title: z.string().default("—"),
  description: z.string().nullable().optional(),
  content_kind: z.string().nullable().optional(),
  material_type: z.string().nullable().optional(),
  status: z.string().default("draft"),
  level: z.string().nullable().optional(),
  usefulness: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  subject_id: z.string().nullable().optional(),
  topic_id: z.string().nullable().optional(),
  link_url: z.string().nullable().optional(),
  file_url: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  submitted_at: z.string().nullable().optional(),
  subjects: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  topics: z.object({ title: z.string().nullable().optional() }).nullable().optional(),
});
export type Candidate = z.infer<typeof candidateSchema>;

// -------- Teacher --------

export const teacherStudentSchema = z.object({
  link_id: z.string(),
  status: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  student: z
    .object({
      id: z.string(),
      display_name: z.string().nullable().optional(),
      grade: z.string().nullable().optional(),
      learning_goal: z.string().nullable().optional(),
      target_exam: z.string().nullable().optional(),
    })
    .nullable()
    .default(null),
  avg_mastery: z.number().default(0),
  weak_count: z.number().default(0),
  last_active: z.string().nullable().default(null),
  needs_attention: z.boolean().nullable().default(false),
});
export type TeacherStudent = z.infer<typeof teacherStudentSchema>;

export const adminCandidateSchema = candidateSchema.extend({
  author_id: z.string().nullable().optional(),
  author: z.object({ display_name: z.string().nullable().optional() }).nullable().default(null),
  subjects: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  topics: z.object({ title: z.string().nullable().optional() }).nullable().optional(),
});
export type AdminCandidate = z.infer<typeof adminCandidateSchema>;
