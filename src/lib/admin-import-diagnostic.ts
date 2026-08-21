/**
 * Diagnostic rows inside a content-import CSV.
 *
 * A row is treated as a diagnostic task (not a library material) when it
 * carries a `diagnostic_title` together with an answer key or an exam task
 * number. Such rows are written to `tasks` + `diagnostic_tests` +
 * `diagnostic_test_tasks` so the diagnostic engine can auto-check answers.
 */
import { pick, str } from "@/lib/admin-import-normalize";

export { normalizeAnswer } from "@/lib/answer-check";

export type DiagnosticRow = {
  diagnostic_title: string;
  diagnostic_type: string;
  subject_title: string;
  program_title: string;
  grade: string;
  topic_title: string;
  subtopic_title: string;
  exam_task_number: number | null;
  order_index: number | null;
  prompt: string;
  correct_answer: string;
  answer_type: string;
  explanation: string;
  difficulty: number;
  points: number;
  source_name: string;
  source_url: string;
};

function toInt(value: string): number | null {
  if (value === "") return null;
  const digits = value.replace(/[^\d-]/g, "");
  if (digits === "") return null;
  const n = Number(digits);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Exam task number written into the row title, e.g. «Диагностика ЕГЭ · Задание 12 · № 14932». */
function examNumberFromTitle(raw: unknown): number | null {
  const m = /задание\s*№?\s*(\d{1,2})/i.exec(pick(raw, "title"));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 99 ? n : null;
}

/** Cheap detector used by the importer to route a row. */
export function isDiagnosticRow(raw: unknown): boolean {
  const hasNumber =
    pick(raw, "exam_task_number") !== "" ||
    pick(raw, "task_number") !== "" ||
    examNumberFromTitle(raw) !== null;
  // A row with an answer key belongs to the diagnostic engine even when the CSV
  // carries no explicit `diagnostic_title` column.
  if (pick(raw, "correct_answer") !== "" && hasNumber) return true;
  const title = pick(raw, "diagnostic_title");
  if (title === "") return false;
  return pick(raw, "correct_answer") !== "" || hasNumber;
}


export type DiagnosticIssue = { field: string; message: string };

export function normalizeDiagnosticRow(
  raw: unknown,
): { ok: true; row: DiagnosticRow } | { ok: false; issues: DiagnosticIssue[] } {
  const issues: DiagnosticIssue[] = [];

  const diagnostic_title = pick(raw, "diagnostic_title");
  const subject_title = pick(raw, "subject_title");
  if (subject_title === "")
    issues.push({ field: "subject_title", message: "обязательное поле не заполнено" });

  const prompt =
    pick(raw, "prompt") ||
    pick(raw, "task_text") ||
    pick(raw, "content_text") ||
    pick(raw, "description");
  if (prompt === "")
    issues.push({ field: "prompt", message: "текст задания не заполнен (prompt / content_text)" });

  const correct_answer = pick(raw, "correct_answer");
  if (correct_answer === "")
    issues.push({ field: "correct_answer", message: "правильный ответ не заполнен" });

  const numberRaw = pick(raw, "exam_task_number") || pick(raw, "task_number");
  const exam_task_number = toInt(numberRaw);
  if (numberRaw !== "" && exam_task_number === null)
    issues.push({ field: "exam_task_number", message: `не число: «${numberRaw}»` });

  if (issues.length > 0) return { ok: false, issues };

  const orderRaw = pick(raw, "order_index") || pick(raw, "order");
  const difficulty = Math.min(Math.max(toInt(pick(raw, "difficulty")) ?? 1, 1), 5);
  const points = Math.min(Math.max(toInt(pick(raw, "points")) ?? 1, 1), 10);
  const answerTypeRaw = pick(raw, "answer_type").toLowerCase();

  return {
    ok: true,
    row: {
      diagnostic_title,
      diagnostic_type: pick(raw, "diagnostic_type").toLowerCase() || "entry",
      subject_title,
      program_title: pick(raw, "program_title"),
      grade: pick(raw, "grade"),
      topic_title: pick(raw, "topic_title"),
      subtopic_title: pick(raw, "subtopic_title"),
      exam_task_number,
      order_index: toInt(orderRaw),
      prompt,
      correct_answer,
      answer_type: answerTypeRaw === "" ? "text" : answerTypeRaw,
      explanation: pick(raw, "explanation") || pick(raw, "solution"),
      difficulty,
      points,
      source_name: pick(raw, "source_name") || str(diagnostic_title),
      source_url: pick(raw, "source_url"),
    },
  };
}
