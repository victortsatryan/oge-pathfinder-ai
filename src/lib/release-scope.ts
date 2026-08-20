/**
 * Release scope (pre-release MVP).
 *
 * At this stage Pathy ships exactly one program:
 *   Русский язык → 11 класс → ЕГЭ
 *
 * Everything else stays in the database but is hidden from the UI and
 * excluded from active scenarios (onboarding, subject picker, diagnostics,
 * dashboard, library). Remove the guards here to open more programs.
 */
export const RELEASE_SUBJECT_ID = "8ee8190d-fd18-4a08-916a-7f8258c3cd7e";
export const RELEASE_PROGRAM_ID = "24e65170-ad2c-47d7-9a79-45b15726cc55";
export const RELEASE_GRADE = "11";
export const RELEASE_EXAM = "EGE";

export const RELEASE_SUBJECT_IDS = [RELEASE_SUBJECT_ID];
export const RELEASE_PROGRAM_IDS = [RELEASE_PROGRAM_ID];

export function isReleaseSubject(subjectId: string | null | undefined): boolean {
  return !!subjectId && RELEASE_SUBJECT_IDS.includes(subjectId);
}

export function isReleaseProgram(programId: string | null | undefined): boolean {
  return !!programId && RELEASE_PROGRAM_IDS.includes(programId);
}

/** Grades offered in onboarding. */
export const RELEASE_GRADES = [RELEASE_GRADE];
