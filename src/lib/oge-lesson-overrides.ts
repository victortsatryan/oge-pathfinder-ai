// Browser-only helpers for lesson overrides.
// Kept OUTSIDE of *.functions.ts so the TanStack server-fn Vite plugin doesn't
// strip them from the client bundle. These read/write localStorage and must be
// callable from React components.

export type LocalLessonOverride = {
  lessonKey: string;
  // "modified" — patches an auto-generated lesson by id.
  // "added"    — synthesizes a new lesson (provide subject, section, dateISO).
  // "removed"  — hides a lesson (auto-generated or previously added).
  kind?: "modified" | "added" | "removed";
  subject?: string | null;
  section?: string | null;
  taskRange?: string | null;
  title: string | null;
  topic: string | null;
  lessonDate: string | null;
  slotNumber: number | null;
  difficulty: "easy" | "adaptive" | "medium" | "hard" | null;
  status: "locked" | "in_progress" | "done" | "pending" | null;
  teacherNote: string | null;
  theoryMarkdown: string | null;
  tasks: Array<{
    id: string;
    prompt: string;
    expectedAnswer: string;
    explanation: string;
    sourceLabel: string;
    bankTaskId: string | null;
  }>;
  customLinks?: Array<{
    id: string;
    title: string;
    url: string;
    kind: "video" | "article" | "practice" | "other";
    note?: string | null;
  }>;
  updatedAt: string;
};

const OVERRIDES_KEY = "oge.lesson_overrides.v1";

export function loadLocalLessonOverrides(): LocalLessonOverride[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalLessonOverride(override: LocalLessonOverride) {
  if (typeof window === "undefined") return;
  const all = loadLocalLessonOverrides();
  const next = [override, ...all.filter((o) => o.lessonKey !== override.lessonKey)];
  try {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
  } catch (e) {
    console.error("saveLocalLessonOverride failed", e);
    throw e;
  }
}

export function deleteLocalLessonOverride(lessonKey: string) {
  if (typeof window === "undefined") return;
  const all = loadLocalLessonOverrides();
  const next = all.filter((o) => o.lessonKey !== lessonKey);
  try {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
  } catch (e) {
    console.error("deleteLocalLessonOverride failed", e);
  }
}

export function markLessonRemoved(lessonKey: string) {
  saveLocalLessonOverride({
    lessonKey,
    kind: "removed",
    subject: null,
    section: null,
    title: null,
    topic: null,
    lessonDate: null,
    slotNumber: null,
    difficulty: null,
    status: null,
    teacherNote: null,
    theoryMarkdown: null,
    tasks: [],
    updatedAt: new Date().toISOString(),
  });
}

export function getLocalLessonOverride(lessonKey: string): LocalLessonOverride | null {
  return loadLocalLessonOverrides().find((o) => o.lessonKey === lessonKey) ?? null;
}

export function makeAddedLessonKey() {
  return `added-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
