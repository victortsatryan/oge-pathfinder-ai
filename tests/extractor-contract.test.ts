import { describe, expect, it } from "vitest";
import { parseResultPage, parseWorkerStatus, canCreateTask, sourceExtension, canPublishWithRights } from "../src/lib/extractor/pipeline";

const sha = "a".repeat(64);
const unit = { unit_id: "u1", role: "student_material", content_text: "Original", source: { sha256: sha } };
const page = { format: "pathy-extraction-result-v1", source: { sha256: sha }, summary: { total_units: 1 }, units: [unit], next_offset: null };

describe("v0.6 fail-closed result contract", () => {
  it("rejects an unknown worker state rather than silently queuing", () => {
    expect(() => parseWorkerStatus({ status: "unexpected" })).toThrow();
  });
  it("rejects damaged unit entries rather than silently dropping them", () => {
    expect(() => parseResultPage({ ...page, units: [null] })).toThrow();
  });
  it("rejects unit source SHA inconsistent with the page", () => {
    expect(() => parseResultPage({ ...page, units: [{ ...unit, source: { sha256: "b".repeat(64) } }] })).toThrow();
  });
  it("rejects missing stable unit identity", () => {
    expect(() => parseResultPage({ ...page, units: [{ ...unit, unit_id: "" }] })).toThrow();
  });
  it("rejects invalid source SHA and negative total", () => {
    expect(() => parseResultPage({ ...page, source: { sha256: "x" } })).toThrow();
    expect(() => parseResultPage({ ...page, summary: { total_units: -1 } })).toThrow();
  });
  it("never authorizes a graded task in the v0.6 pipeline even with a supplied answer", () => {
    expect(canCreateTask({ ...unit, usable_for_grading: true, answer: "27" })).toBe(false);
  });
  it("rejects pagination gaps and changing totals", () => {
    expect(() => parseResultPage({ ...page, summary: { total_units: 3 }, next_offset: 2 }, { sha, offset: 0, total: 3 })).toThrow();
    expect(() => parseResultPage(page, { sha, offset: 0, total: 2 })).toThrow();
  });
  it("rejects a page from another source before persistence", () => {
    expect(() => parseResultPage(page, { sha: "b".repeat(64), offset: 0, total: 1 })).toThrow();
  });
  it.each(["pdf", "docx", "xlsx", "png", "txt"])("accepts declared source extension %s (not actual extraction)", ext => {
    expect(sourceExtension(`source.${ext}`)).toBe(ext);
  });
  it("explicitly rejects HTML: worker support is not established", () => {
    expect(sourceExtension("source.html")).toBeNull();
  });
  it.each(["own", "licensed", "public_domain"])("allows the explicit rights basis %s", rights => {
    expect(canPublishWithRights(rights)).toBe(true);
  });
});