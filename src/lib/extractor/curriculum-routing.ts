/**
 * A verified source paragraph can provide a curriculum topic even when the
 * learner has never taken a diagnostic for it. This prepares candidates for
 * future explicit route generation without touching stored progress or routes.
 */
export type RouteTopicCandidate = {
  topic_id: string; subject_id: string; title: string;
};
export type RouteProgress = {
  topic_id: string; subject_id: string; status?: string | null;
  mastery_score?: number | null; mistakes_count?: number | null;
  program_id?: string | null; topics?: { title: string } | null;
};
export function withUnstartedSourceTopics(
  progress: RouteProgress[], 
  verified: RouteTopicCandidate[],
): RouteProgress[] {
  const seen = new Set(progress.map((p) => p.topic_id));
  const extra: RouteProgress[] = [];
  for (const t of verified) {
    if (!t.topic_id || !t.subject_id || !t.title.trim() || seen.has(t.topic_id)) continue;
    seen.add(t.topic_id);
    extra.push({
      topic_id: t.topic_id, subject_id: t.subject_id,
      status: "not_started", mastery_score: 0,
      mistakes_count: 0, program_id: null,
      topics: { title: t.title },
    });
  }
  return [...progress, ...extra];
}
