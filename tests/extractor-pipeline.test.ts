import { describe, expect, it } from "vitest";
import { canCreateTask, canPublishWithRights, classifyUnit, extractUnits, parseWorkerStatus, resolveAuthor, shouldPublish, sourceExtension } from "../src/lib/extractor/pipeline";

const good = { unit_id: "u1", title: "Правило", kind: "rule", content_text: "Текст", pages: [3], confidence: 0.95 };

describe("extractor pipeline", () => {
  it("accepts only supported source files", () => {
    expect(sourceExtension("book.PDF")).toBe("pdf");
    expect(sourceExtension("data.json")).toBeNull();
  });
  it("does not default the author to Rosenthal", () => {
    expect(resolveAuthor({}, null)).toBeNull();
    expect(resolveAuthor({ author: "Иванов" }, "Петров")).toBe("Иванов");
  });
  it("confident units publish without manual review", () => {
    const u = classifyUnit(good);
    expect(u.decision).toBe("confident");
    expect(shouldPublish(u, undefined)).toBe(true);
    expect(shouldPublish(u, "reject")).toBe(false);
  });
  it("doubtful units need explicit acceptance", () => {
    const u = classifyUnit({ ...good, confidence: 0.5 });
    expect(u.decision).toBe("review");
    expect(shouldPublish(u, undefined)).toBe(false);
    expect(shouldPublish(u, "accept")).toBe(true);
    expect(classifyUnit({ ...good, needs_structure_review: true }).decision).toBe("review");
  });
  it("creates tasks only with explicit answer and topic", () => {
    const t = { ...good, kind: "exercise", answer: "б" };
    expect(canCreateTask(classifyUnit(t))).toBe(false);
    expect(canCreateTask(classifyUnit({ ...t, topic_id: "8ee8190d-fd18-4a08-916a-7f8258c3cd7e" }))).toBe(true);
  });
  it("blocks publication with unknown rights", () => {
    expect(canPublishWithRights("unknown")).toBe(false);
    expect(canPublishWithRights("own")).toBe(true);
  });
  it("parses worker status and units", () => {
    expect(parseWorkerStatus({ status: "done", result: { units: [good] } }).status).toBe("succeeded");
    expect(parseWorkerStatus({ status: "running", progress: 0.4 }).progress).toBe(40);
    expect(extractUnits({ canonical: { units: [good] } })).toHaveLength(1);
  });
});
