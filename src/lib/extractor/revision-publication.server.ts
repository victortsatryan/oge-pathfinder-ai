/** Server-only evidence gate for replacing an already published Pathy source unit.
 *
 * Raw source remains immutable. The machine's patch ledger is replayed and
 * hashed before any human-approved text may replace a linked material.
 */
import { createHash } from "node:crypto";

export const REVISION_CORRECTION_VERSION = "pathy-ocr-postcorrection-v2";

export type ApprovedRevisionUnit = {
  raw: Record<string, any>;
  review_choice: string | null;
  reviewed_text: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** A malformed or untraceable OCR correction fails closed. */
export function replayOCRCorrection(raw: Record<string, any>): void {
  const m = raw.machine_correction;
  if (!m) return;
  if (m.schema_version !== REVISION_CORRECTION_VERSION
      || m.status !== "automatic_source_bound_not_optically_verified"
      || raw.content_stage !== "machine_corrected_presentation_unverified"
      || typeof raw.original_presentation_text !== "string"
      || !Array.isArray(m.patches) || !m.patches.length
      || m.input_presentation_sha256 !== sha256Text(raw.original_presentation_text)) {
    throw new Error("Проверка журнала машинной коррекции не пройдена");
  }
  const input: string = raw.original_presentation_text;
  let cursor = 0;
  let output = "";
  for (const p of m.patches) {
    if (!Number.isSafeInteger(p.start) || !Number.isSafeInteger(p.end)
        || p.start < cursor || p.end <= p.start || p.end > input.length
        || typeof p.before !== "string" || input.slice(p.start, p.end) !== p.before
        || typeof p.after !== "string" || !p.after
        || p.printed_glyph_verified !== false || p.grader_authorized !== false) {
      throw new Error("Машинная правка не соответствует исходному тексту");
    }
    output += input.slice(cursor, p.start) + p.after;
    cursor = p.end;
  }
  output += input.slice(cursor);
  if (output !== raw.content_text || sha256Text(output) !== m.output_sha256) {
    throw new Error("Исправленный текст расходится с проверяемым журналом изменений");
  }
}

/** No automatic publication, even for a 'confident' machine-corrected unit. */
export function approvedRevisionText(unit: ApprovedRevisionUnit): string {
  const raw = unit.raw;
  if (raw.role !== "student_material" || raw.usable_for_learning !== true
      || raw.usable_for_grading !== false
      || typeof raw.content_text !== "string" || !raw.content_text.trim()
      || typeof raw.source?.sha256 !== "string") {
    throw new Error("Блок нельзя использовать для обучения или публикации");
  }
  if (!["accept_corrected", "keep_original"].includes(unit.review_choice ?? "")
      || !unit.reviewed_by || !unit.reviewed_at) {
    throw new Error("Нужна явная сохранённая проверка администратором");
  }
  replayOCRCorrection(raw);
  if (unit.review_choice === "accept_corrected") {
    const text = unit.reviewed_text?.trim();
    if (!text) throw new Error("Пустой утверждённый текст");
    return text;
  }
  // 'Keep original' means preserve original Presentation, NOT the machine output.
  return typeof raw.original_presentation_text === "string"
    ? raw.original_presentation_text
    : raw.content_text;
}

/** A revision can be applied only once to each material; preserve all prior text. */
export function correctionAlreadyApplied(metadata: Record<string, any>,
  jobId: string, unitId: string): boolean {
  const history = Array.isArray(metadata.correction_history) ? metadata.correction_history : [];
  return history.some((x: any) => x.job_id === jobId && x.unit_id === unitId);
}

export function appendCorrectionHistory(metadata: Record<string, any>, entry: Record<string, any>): Record<string, any> {
  const history = Array.isArray(metadata.correction_history) ? metadata.correction_history : [];
  if (history.length >= 40) throw new Error("Превышен лимит истории коррекций материала");
  if (correctionAlreadyApplied(metadata, entry.job_id, entry.unit_id)) {
    throw new Error("Эта версия уже применена к материалу");
  }
  return { ...metadata, correction_history: [...history, entry],
    latest_correction_job_id: entry.job_id,
    review_status: "human_approved_revision" };
}
