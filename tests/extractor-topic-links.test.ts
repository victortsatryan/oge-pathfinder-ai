import { describe, expect, it } from "vitest";
import {
  LESSON_THEORY_MATERIAL_TYPES, needsContentReview, topicBelongsToSubject, materialTopicOrFilter,
} from "../src/lib/extractor/topic-linking";

describe("published extractor topic and lesson eligibility", () => {
  it("only authorizes topics from the same, non-empty subject", () => {
    expect(topicBelongsToSubject("russian", "russian")).toBe(true);
    expect(topicBelongsToSubject("russian", "math")).toBe(false);
    expect(topicBelongsToSubject(null, "russian")).toBe(false);
    expect(topicBelongsToSubject("russian", null)).toBe(false);
  });
  it("accepts textbook paragraphs as lesson theory material, not graded tasks", () => {
    expect(LESSON_THEORY_MATERIAL_TYPES).toContain("textbook_paragraph");
    expect(LESSON_THEORY_MATERIAL_TYPES).toContain("reference");
    expect(LESSON_THEORY_MATERIAL_TYPES).not.toContain("task");
    expect(LESSON_THEORY_MATERIAL_TYPES).not.toContain("exercise_set");
  });
  it("flags lone OCR punctuation and broken snippets before topic assignment", () => {
    expect(needsContentReview("|", "|")).toBe(true);
    expect(needsContentReview("=", "=")).toBe(true);
    expect(needsContentReview("Словообразование", "Вводная строка")).toBe(true);
    expect(needsContentReview("§ 14. Орфоэпия", "Основные правила произношения согласных звуков. ".repeat(3))).toBe(false);
  });
  it("does not silently reclassify a long text solely from its title", () => {
    expect(needsContentReview("Синонимы", "Определение и примеры употребления синонимов. ".repeat(3))).toBe(false);
  });
});

describe("multiple curriculum topics per extracted material", () => {
  const tid = "4ce570eb-44ee-44f0-9a14-a3faacbfcaa8";
  const m1 = "06a8dadf-b6b0-43a3-9b46-a1dcb1ed0951";
  const m2 = "8ebdd4d1-3b9b-4693-bf37-27c8cf3958a3";
  it("selects primary and secondary topic links, without grading tasks", () => {
    expect(materialTopicOrFilter(tid, [])).toBe("topic_id.eq." + tid);
    expect(materialTopicOrFilter(tid, [m1, m2])).toBe("topic_id.eq." + tid + ",id.in.(" + m1 + "," + m2 + ")");
  });
  it("rejects malformed filter IDs rather than injecting a PostgREST expression", () => {
    expect(() => materialTopicOrFilter("all", [m1])).toThrow();
    expect(() => materialTopicOrFilter(tid, [m1 + "),status.eq.draft"])).toThrow();
  });
});
