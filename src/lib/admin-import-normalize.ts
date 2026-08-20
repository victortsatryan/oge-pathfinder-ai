export const MATERIAL_TYPES = [
  "theory",
  "textbook_paragraph",
  "video",
  "article",
  "scheme",
  "infographic",
  "exercise_set",
  "task",
  "test",
  "task_solution",
  "reference",
  "scientific_material",
] as const;

export const STATUSES = ["draft", "reviewed", "published", "archived"] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];
export type MaterialStatus = (typeof STATUSES)[number];

export type NormalizedRow = {
  subject_title: string;
  grade: string;
  program_title: string;
  topic_title: string;
  subtopic_title: string;
  learning_objective_title: string;
  material_type: MaterialType;
  title: string;
  description: string;
  source_name: string;
  source_url: string;
  content_text: string;
  video_url: string;
  file_url: string;
  image_url: string;
  difficulty: number;
  estimated_time_minutes: number | null;
  license_note: string;
  status: MaterialStatus;
};

/** Any value -> safe trimmed string. Never throws, never touches methods on undefined. */
export function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return value.toISOString();
  try {
    return String(value ?? "").trim();
  } catch {
    return "";
  }
}

/** Case/space-insensitive lookup so slightly different CSV headers still resolve. */
function pick(raw: unknown, key: string): string {
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  if (key in obj) return str(obj[key]);
  const wanted = key.toLowerCase().replace(/[\s_-]+/g, "");
  for (const [k, v] of Object.entries(obj)) {
    if (String(k ?? "").toLowerCase().replace(/[\s_-]+/g, "") === wanted) return str(v);
  }
  return "";
}

function intOrNull(value: string): number | null {
  if (value === "") return null;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export type RowIssue = { field: string; message: string };

export function normalizeRow(raw: unknown): { ok: true; row: NormalizedRow } | { ok: false; issues: RowIssue[] } {
  const issues: RowIssue[] = [];

  const subject_title = pick(raw, "subject_title");
  if (subject_title === "") issues.push({ field: "subject_title", message: "обязательное поле не заполнено" });

  const title = pick(raw, "title");
  if (title === "") issues.push({ field: "title", message: "обязательное поле не заполнено" });
  const safeTitle = title.slice(0, 500);

  const rawType = pick(raw, "material_type").toLowerCase();
  const material_type = (MATERIAL_TYPES as readonly string[]).includes(rawType)
    ? (rawType as MaterialType)
    : undefined;
  if (!material_type) {
    issues.push({
      field: "material_type",
      message: rawType === ""
        ? "обязательное поле не заполнено"
        : `недопустимое значение «${rawType}» (допустимо: ${MATERIAL_TYPES.join(", ")})`,
    });
  }

  const rawStatus = pick(raw, "status").toLowerCase();
  const status: MaterialStatus = (STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as MaterialStatus)
    : "draft";
  if (rawStatus !== "" && !(STATUSES as readonly string[]).includes(rawStatus)) {
    issues.push({ field: "status", message: `недопустимый статус «${rawStatus}» (допустимо: ${STATUSES.join(", ")})` });
  }

  const difficultyRaw = pick(raw, "difficulty");
  let difficulty = intOrNull(difficultyRaw) ?? 1;
  if (difficultyRaw !== "" && intOrNull(difficultyRaw) === null) {
    issues.push({ field: "difficulty", message: `не число: «${difficultyRaw}»` });
  }
  if (difficulty < 1) difficulty = 1;
  if (difficulty > 5) difficulty = 5;

  const minutesRaw = pick(raw, "estimated_time_minutes");
  let estimated_time_minutes = intOrNull(minutesRaw);
  if (minutesRaw !== "" && estimated_time_minutes === null) {
    issues.push({ field: "estimated_time_minutes", message: `не число: «${minutesRaw}»` });
  }
  if (estimated_time_minutes !== null) {
    estimated_time_minutes = Math.min(Math.max(estimated_time_minutes, 0), 600);
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    row: {
      subject_title,
      grade: pick(raw, "grade"),
      program_title: pick(raw, "program_title"),
      topic_title: pick(raw, "topic_title"),
      subtopic_title: pick(raw, "subtopic_title"),
      learning_objective_title: pick(raw, "learning_objective_title"),
      material_type: material_type as MaterialType,
      title: safeTitle,
      description: pick(raw, "description"),
      source_name: pick(raw, "source_name"),
      source_url: pick(raw, "source_url"),
      content_text: pick(raw, "content_text"),
      video_url: pick(raw, "video_url"),
      file_url: pick(raw, "file_url"),
      image_url: pick(raw, "image_url"),
      difficulty,
      estimated_time_minutes,
      license_note: pick(raw, "license_note"),
      status,
    },
  };
}

export function formatRowIssues(issues: RowIssue[]): string {
  return issues.map((i) => `${i.field}: ${i.message}`).join("; ");
}
