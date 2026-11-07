/** Explicit admin topic mapping is the only authoritative link for extracted materials. */
export const LESSON_THEORY_MATERIAL_TYPES = [
  "theory", "video", "article", "reference", "scheme", "textbook_paragraph",
] as const;

export function topicBelongsToSubject(subjectId: string | null, topicSubjectId: string | null) {
  return Boolean(subjectId && topicSubjectId && subjectId === topicSubjectId);
}

/** Short OCR fragments are flagged to an admin, not silently promoted as ready lessons. */
export function needsContentReview(title: string, contentText: string | null) {
  const text = (contentText ?? "").trim();
  return text.length < 100 || !title.trim() || /^[^\p{L}\p{N}]+$/u.test(title.trim());
}


/** Merge legacy primary topic with secondary many-to-many links (UUIDs only). */
export function materialTopicOrFilter(topicId: string, linkedIds: string[]) {
  const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!validUuid.test(topicId) || linkedIds.some((id) => !validUuid.test(id))) {
    throw new Error("Invalid topic/material UUID");
  }
  return linkedIds.length
    ? "topic_id.eq." + topicId + ",id.in.(" + linkedIds.join(",") + ")"
    : "topic_id.eq." + topicId;
}

export async function getLinkedMaterialIds(sb: any, topicId: string): Promise<string[]> {
  const res = await sb.from("material_topic_links")
    .select("material_id").eq("topic_id", topicId).limit(2000);
  if (res.error) throw new Error(res.error.message);
  return Array.from(new Set((res.data ?? []).map((row: { material_id: string }) => row.material_id))) as string[];
}
