import { describe, expect, it } from "vitest";
import { batchSchema, importBatchSchema, canonicalJson, EXTRACTOR_FORMAT, inspectFile, splitBatches, unitSchema } from "../src/lib/extractor/schema";
const unit = { unit_id: "unit-1", kind: "exercise", title: "Draft", content_text: "Original", pages: [3], source: { sha256: "a".repeat(64) }, review_status: "needs_structure_review", rights: { status: "unknown" }, platform: { status: "draft", is_public: false }, needs_structure_review: true };
describe("Extractor draft safety", () => {
  it("accepts the requested audit format", () => expect(inspectFile({ format: EXTRACTOR_FORMAT, units: [unit] }).reports[0].status).toBe("new"));
  it("rejects public units", () => expect(unitSchema.safeParse({ ...unit, platform: { status: "draft", is_public: true } }).success).toBe(false));
  it("rejects non-draft units", () => expect(unitSchema.safeParse({ ...unit, platform: { status: "published", is_public: false } }).success).toBe(false));
  it("blocks every duplicate id", () => expect(inspectFile({ format: EXTRACTOR_FORMAT, units: [unit, unit] }).reports.map((r) => r.status)).toEqual(["failed", "failed"]));
  it("reports missing source SHA", () => expect(inspectFile({ format: EXTRACTOR_FORMAT, units: [{ ...unit, source: {} }] }).reports[0].reasons.length).toBeGreaterThan(0));
  it("requires source pages", () => expect(unitSchema.safeParse({ ...unit, pages: [] }).success).toBe(false));
  it("allows unknown rights only as private staging", () => expect(unitSchema.safeParse(unit).success).toBe(true));
  it("limits a batch to 20", () => expect(batchSchema.safeParse({ format: EXTRACTOR_FORMAT, units: Array(21).fill(unit) }).success).toBe(false));
  it("compares payloads independently of property order", () => expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 })));
  it("detects changed source pages in payload comparison", () => expect(canonicalJson(unit)).not.toBe(canonicalJson({ ...unit, pages: [4] })));
  it("requires explicit confirmation before writing", () => expect(importBatchSchema.safeParse({ format: EXTRACTOR_FORMAT, units: [unit] }).success).toBe(false));
  it("blocks duplicate ids with whitespace too", () => expect(inspectFile({ format: EXTRACTOR_FORMAT, units: [unit, { ...unit, unit_id: " unit-1 " }] }).reports.map((r) => r.status)).toEqual(["failed", "failed"]));
  it("supports a 1 MB text draft", () => expect(batchSchema.safeParse({ format: EXTRACTOR_FORMAT, units: [{ ...unit, content_text: "x".repeat(1_000_000) }] }).success).toBe(true));
  it("rejects payloads beyond the byte limit", () => expect(batchSchema.safeParse({ format: EXTRACTOR_FORMAT, units: [{ ...unit, extra: "x".repeat(3_000_000) }] }).success).toBe(false));
  it("splits large files by byte size", () => {
    const units = [0, 1, 2].map((n) => ({ ...unit, unit_id: String(n), content_text: "x".repeat(1_000_000) }));
    const reports = inspectFile({ format: EXTRACTOR_FORMAT, units }).reports;
    expect(splitBatches(reports, units).map((b) => b.length)).toEqual([2, 1]);
  });
});