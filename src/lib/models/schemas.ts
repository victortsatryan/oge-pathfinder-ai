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
