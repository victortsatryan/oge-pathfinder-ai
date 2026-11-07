import { describe, expect, it } from "vitest";
import {
  LESSON_THEORY_MATERIAL_TYPES, needsContentReview, topicBelongsToSubject,
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
