import {
  EMPTY_PROFILE_ANALYTICS,
  mistakeRowSchema,
  profileAnalyticsSchema,
  studentProfileSchema,
  studentSubjectSchema,
  subjectSchema,
  subjectProgramSchema,
  topicProgressRowSchema,
  type MistakeRow,
  type ProfileAnalytics,
  type StudentProfile,
  type StudentSubject,
  type Subject,
  type SubjectProgram,
  type TopicProgressRow,
} from "@/lib/models/schemas";
import { safeAwait, parseList, parseOne } from "@/lib/query/parse";
import {
  getMyStudentProfile,
  getStudentProfileAnalytics,
  listMyRecentMistakes,
  listMyStudentSubjects,
  listMyWeakTopics,
  listSubjectPrograms,
  listSubjects,
  listTopicProgressBySubject,
} from "@/lib/student-profile.functions";

/**
 * Student domain repository.
 * Contract: collections -> T[], single entities -> T | null. Never throws on shape drift.
 */
export const studentRepo = {
  async profile(): Promise<StudentProfile | null> {
    const raw = await safeAwait("student.profile", () => getMyStudentProfile());
    return parseOne("student.profile", studentProfileSchema, raw);
  },

  async subjects(): Promise<StudentSubject[]> {
    const raw = await safeAwait("student.subjects", () => listMyStudentSubjects());
    return parseList("student.subjects", studentSubjectSchema, raw);
  },

  async subjectCatalog(): Promise<Subject[]> {
    const raw = await safeAwait("student.subjectCatalog", () => listSubjects());
    return parseList("student.subjectCatalog", subjectSchema, raw);
  },

  async programs(subjectId: string): Promise<SubjectProgram[]> {
    const raw = await safeAwait("student.programs", () => listSubjectPrograms({ data: { subject_id: subjectId } }));
    return parseList("student.programs", subjectProgramSchema, raw);
  },

  async topicProgress(subjectId: string): Promise<TopicProgressRow[]> {
    const raw = await safeAwait("student.topicProgress", () => listTopicProgressBySubject({ data: { subject_id: subjectId } }));
    return parseList("student.topicProgress", topicProgressRowSchema, raw);
  },

  async weakTopics(): Promise<TopicProgressRow[]> {
    const raw = await safeAwait("student.weakTopics", () => listMyWeakTopics());
    return parseList("student.weakTopics", topicProgressRowSchema, raw);
  },

  async recentMistakes(): Promise<MistakeRow[]> {
    const raw = await safeAwait("student.recentMistakes", () => listMyRecentMistakes());
    return parseList("student.recentMistakes", mistakeRowSchema, raw);
  },

  async profileAnalytics(): Promise<ProfileAnalytics> {
    const raw = await safeAwait("student.profileAnalytics", () => getStudentProfileAnalytics());
    return parseOne("student.profileAnalytics", profileAnalyticsSchema, raw) ?? EMPTY_PROFILE_ANALYTICS;
  },
};
