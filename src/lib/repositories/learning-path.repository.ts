import { calendarEventSchema, type CalendarEvent } from "@/lib/models/schemas";
import { parseList } from "@/lib/query/parse";
import { listCalendarEvents } from "@/lib/learning-path.functions";

export const learningPathRepo = {
  async calendarEvents(range: { from?: string; to?: string } = {}): Promise<CalendarEvent[]> {
    const raw = await listCalendarEvents({ data: range });
    return parseList("learningPath.calendarEvents", calendarEventSchema, raw);
  },
};
