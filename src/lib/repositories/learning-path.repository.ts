import {
  learningPathItemSchema,
  learningPathSchema,
  calendarEventSchema,
  type CalendarEvent,
  type LearningPath,
  type LearningPathItem,
} from "@/lib/models/schemas";
import { safeAwait, parseList, parseOne } from "@/lib/query/parse";
import {
  getLearningPath,
  listCalendarEvents,
  listMyLearningPaths,
} from "@/lib/learning-path.functions";

export const learningPathRepo = {
  async calendarEvents(range: { from?: string; to?: string } = {}): Promise<CalendarEvent[]> {
    const raw = await safeAwait("learningPath.calendarEvents", () => listCalendarEvents({ data: range }));
    return parseList("learningPath.calendarEvents", calendarEventSchema, raw);
  },

  async paths(): Promise<LearningPath[]> {
    const raw = await safeAwait("learningPath.paths", () => listMyLearningPaths());
    return parseList("learningPath.paths", learningPathSchema, raw);
  },

  async detail(
    pathId: string,
  ): Promise<{ path: LearningPath | null; items: LearningPathItem[] }> {
    const raw: unknown = await safeAwait("learningPath.detail", () => getLearningPath({ data: { path_id: pathId } }));
    const obj = (raw ?? {}) as Record<string, unknown>;
    return {
      path: parseOne("learningPath.detail", learningPathSchema, obj.path ?? null),
      items: parseList("learningPath.items", learningPathItemSchema, obj.items ?? []),
    };
  },
};
