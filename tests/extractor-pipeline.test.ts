import { describe, expect, it } from "vitest";
import {
  MAX_SOURCE_BYTES, canCreateTask, canPublishWithRights, classifyUnit, magicMatches, parseResultPage, parseWorkerStatus,
  resolveAuthor, shouldPublish, sourceExtension, stableUnitKey,
} from "../src/lib/extractor/pipeline";

const good = {
  unit_id: "u1", kind: "exercise", material_type: "exercise_set", title: "Упр. 1", content_text: "Текст", pages: [3],
  source: { sha256: "a".repeat(64), filename: "d.pdf" }, review_status: "auto_extracted_unverified", review_reasons: [],
  requires_manual_review: false, usable_for_learning: true, usable_for_grading: false, role: "student_material", related_unit_ids: ["s1"], answer: null,
};

describe("extractor pipeline", () => {
  it("accepts a 97 MB source and supported types only", () => {
    expect(97_095_579 <= MAX_SOURCE_BYTES).toBe(true);
    expect(sourceExtension("book.PDF")).toBe("pdf");
    expect(sourceExtension("data.json")).toBeNull();
    expect(magicMatches("pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(true);
    expect(magicMatches("pdf", new Uint8Array([0x50, 0x4b, 3, 4]))).toBe(false);
  });
  it("does not default the author", () => {
    expect(resolveAuthor({}, null)).toBeNull();
    expect(classifyUnit(good).author).toBeNull();
  });
  it("unflagged student units publish without manual review and keep related ids", () => {
    const u = classifyUnit(good);
    expect(u.decision).toBe("confident");
    expect(u.related_unit_ids).toEqual(["s1"]);
    expect(shouldPublish(u, undefined)).toBe(true);
    expect(shouldPublish(u, "reject")).toBe(false);
  });
  it("flagged units need explicit acceptance", () => {
    const u = classifyUnit({ ...good, requires_manual_review: true, review_status: "needs_review", review_reasons: ["ocr"] });
    expect(u.decision).toBe("review");
    expect(u.reasons).toContain("ocr");
    expect(shouldPublish(u, undefined)).toBe(false);
    expect(shouldPublish(u, "accept")).toBe(true);
  });
  it("never publishes teacher_private units, even when accepted", () => {
    const u = classifyUnit({ ...good, role: "teacher_private", answer: "б" });
    expect(u.decision).toBe("private");
    expect(shouldPublish(u, "accept")).toBe(false);
    expect(shouldPublish(classifyUnit({ ...good, usable_for_learning: false }), "accept")).toBe(false);
  });
  it("creates no graded task when usable_for_grading is false", () => {
    expect(canCreateTask({ ...good, answer: "б" })).toBe(false);
    expect(canCreateTask({ ...good, role: "teacher_private", usable_for_grading: true, answer: "б" })).toBe(false);
  });
  it("unit key includes the source SHA", () => {
    expect(stableUnitKey("abc", "u1")).toBe("abc:u1");
  });
  it("blocks publication with unknown rights", () => {
    expect(canPublishWithRights("unknown")).toBe(false);
    expect(canPublishWithRights("own")).toBe(true);
  });
  it("parses the real status and paginated result contract", () => {
    expect(parseWorkerStatus({ status: "running", stage: "ocr" })).toMatchObject({ status: "processing", stage: "ocr" });
    expect(parseWorkerStatus({ status: "succeeded", units: { total_units: 2 } }).status).toBe("succeeded");
    const p = parseResultPage({ format: "pathy-extraction-result-v1", source: { sha256: "a".repeat(64) }, summary: { total_units: 45 }, units: [good], next_offset: 20 });
    expect(p).toMatchObject({ next_offset: 20, total_units: 45, source_sha256: "a".repeat(64) });
    expect(() => parseResultPage({ format: "other", units: [] })).toThrow();
    expect(() => parseResultPage({ format: "pathy-extraction-result-v1", units: [], next_offset: "x" })).toThrow();
  });
});

import { effectivePublication } from "../src/lib/extractor/pipeline";
describe("built-in review", () => {
  const flagged = classifyUnit({ ...good, requires_manual_review: true, review_reasons: ["ocr"] });
  it("confident units use untouched raw text without action", () => {
    expect(effectivePublication(classifyUnit(good), null, "чужой текст")).toEqual({ publish: true, text: "Текст", review_status: "auto_extracted_unverified" });
  });
  it("flagged units do not publish without a human choice", () => {
    expect(effectivePublication(flagged, null, "Исправлено").publish).toBe(false);
  });
  it("uses corrected text only on explicit accept_corrected", () => {
    expect(effectivePublication(flagged, "accept_corrected", "Исправлено")).toMatchObject({ publish: true, text: "Исправлено", review_status: "human_corrected" });
    expect(effectivePublication(flagged, "keep_original", "Исправлено")).toMatchObject({ text: "Текст", review_status: "human_approved_original" });
    expect(effectivePublication(flagged, "accept_corrected", "  ").publish).toBe(false);
    expect(effectivePublication(flagged, "reject", "x").publish).toBe(false);
  });
  it("teacher_private never publishes even after a manual choice", () => {
    const p = classifyUnit({ ...good, role: "teacher_private", content_text: "27. Ответ: б" });
    expect(effectivePublication(p, "accept_corrected", "27. Ответ: б").publish).toBe(false);
    expect(effectivePublication(p, "keep_original", null, "accept").publish).toBe(false);
  });
});
