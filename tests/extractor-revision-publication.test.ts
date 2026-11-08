import { describe, expect, it } from "vitest";
import {
  REVISION_CORRECTION_VERSION, approvedRevisionText, appendCorrectionHistory,
  correctionAlreadyApplied, replayOCRCorrection, sha256Text,
} from "../src/lib/extractor/revision-publication.server";

const SOURCE_SHA = "5eebab6c023971fc733c59b258c5cedaf76b2764c4e1353b1bb7a75927acf589";
function machineRaw() {
  const original = "Здесь сушествительные и правило.";
  const corrected = "Здесь существительные и правило.";
  const start = original.indexOf("сушествительные");
  return {
    role: "student_material", usable_for_learning: true, usable_for_grading: false,
    content_text: corrected, original_presentation_text: original,
    content_stage: "machine_corrected_presentation_unverified",
    source: { sha256: SOURCE_SHA },
    machine_correction: {
      schema_version: REVISION_CORRECTION_VERSION,
      status: "automatic_source_bound_not_optically_verified",
      input_presentation_sha256: sha256Text(original),
      output_sha256: sha256Text(corrected),
      patches: [{
        start, end: start + "сушествительные".length,
        before: "сушествительные", after: "существительные",
        printed_glyph_verified: false, grader_authorized: false,
      }],
    },
  };
}
const approved = (raw: Record<string, any> = machineRaw()) => ({
  raw, review_choice: "accept_corrected", reviewed_text: raw.content_text,
  reviewed_by: "user-admin-1", reviewed_at: "2026-11-08T10:03:00Z",
});

describe("source-bound reprocessed correction publication gate", () => {
  it("replays and hashes the complete source-backed OCR machine edit", () => {
    const unit = approved();
    expect(replayOCRCorrection(unit.raw)).toBeUndefined();
    expect(approvedRevisionText(unit)).toBe("Здесь существительные и правило.");
  });

  it("never promotes unreviewed corrections", () => {
    const unit = approved();
    for (const changes of [
      { review_choice: null },
      { review_choice: "reject" },
      { reviewed_by: null },
      { reviewed_at: null },
    ]) {
      expect(() => approvedRevisionText({ ...unit, ...changes })).toThrow("сохранённая проверка");
    }
  });

  it("the 'keep_original' choice restores original Presentation, not a machine proposal", () => {
    const unit = approved();
    expect(approvedRevisionText({ ...unit, review_choice: "keep_original",
      reviewed_text: null })).toBe("Здесь сушествительные и правило.");
  });

  it("blocks teacher keys, implicit grading and non-student content", () => {
    for (const changes of [
      { role: "teacher_private" }, { usable_for_learning: false },
      { usable_for_grading: true }, { source: null },
    ]) {
      expect(() => approvedRevisionText(approved({ ...machineRaw(), ...changes }))).toThrow("нельзя использовать");
    }
  });

  it("rejects tampering in source, offsets, output and version", () => {
    const mutators: Array<(u: ReturnType<typeof machineRaw>) => void> = [
      u => { u.machine_correction.patches[0].before = "что-то"; },
      u => { u.machine_correction.patches[0].start++; },
      u => { u.machine_correction.output_sha256 = "a".repeat(64); },
      u => { u.machine_correction.schema_version = "pathy-ocr-postcorrection-v1"; },
      u => { u.original_presentation_text = "unrelated"; },
      u => { u.machine_correction.patches[0].printed_glyph_verified = true; },
    ];
    for (const mutate of mutators) {
      const u = machineRaw();
      mutate(u);
      expect(() => replayOCRCorrection(u)).toThrow();
    }
  });

  it("keeps old material text and provenance in an append-only reversible correction history", () => {
    const oldMeta = { unit_key: SOURCE_SHA + ":unit:1", source_sha256: SOURCE_SHA,
      job_id: "job-root-uuid", original_ocr_text: "Здесь сушествительные и правило." };
    const entry = {
      job_id: "job-revision-uuid", unit_id: "unit:1",
      previous_text: "Здесь сушествительные и правило.",
      previous_text_sha256: sha256Text("Здесь сушествительные и правило."),
      approved_text_sha256: sha256Text("Здесь существительные и правило."),
      human_reviewer: "user-admin-1", machine_patch_count: 1,
    };
    const next = appendCorrectionHistory(oldMeta, entry);
    expect(next.original_ocr_text).toBe(oldMeta.original_ocr_text);
    expect(next.correction_history).toEqual([entry]);
    expect(correctionAlreadyApplied(next, entry.job_id, entry.unit_id)).toBe(true);
    expect(correctionAlreadyApplied(oldMeta, entry.job_id, entry.unit_id)).toBe(false);
    expect(() => appendCorrectionHistory(next, entry)).toThrow("уже применена");
  });
});
