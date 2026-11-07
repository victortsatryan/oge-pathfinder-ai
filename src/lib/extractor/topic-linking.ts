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
