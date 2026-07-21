import {
  EMPTY_STUDENT_OVERVIEW,
  recommendationSchema,
  studentOverviewSchema,
  weakTopicSchema,
  type Recommendation,
  type StudentOverview,
  type WeakTopic,
} from "@/lib/models/schemas";
import { parseList, parseOne } from "@/lib/query/parse";
import {
  getRecommendations,
  getStudentOverview,
  getWeakTopics,
} from "@/lib/analytics.functions";

export const analyticsRepo = {
  async overview(): Promise<StudentOverview> {
    const raw = await getStudentOverview();
    return parseOne("analytics.overview", studentOverviewSchema, raw) ?? EMPTY_STUDENT_OVERVIEW;
  },
  async weakTopics(limit = 10): Promise<WeakTopic[]> {
    const raw = await getWeakTopics({ data: { limit } });
    return parseList("analytics.weakTopics", weakTopicSchema, raw);
  },
  async recommendations(): Promise<Recommendation[]> {
    const raw = await getRecommendations();
    return parseList("analytics.recommendations", recommendationSchema, raw);
  },
};
