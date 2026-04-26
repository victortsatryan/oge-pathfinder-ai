// Browser-only helpers for lesson overrides.
// Kept OUTSIDE of *.functions.ts so the TanStack server-fn Vite plugin doesn't
// strip them from the client bundle. These read/write localStorage and must be
// callable from React components.

export type LocalLessonOverride = {
  lessonKey: string;
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

export function getLocalLessonOverride(lessonKey: string): LocalLessonOverride | null {
  return loadLocalLessonOverrides().find((o) => o.lessonKey === lessonKey) ?? null;
}
