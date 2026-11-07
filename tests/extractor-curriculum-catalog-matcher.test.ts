import { describe, it, expect } from "vitest";
import {
  normalizeCurriculumName, matchCurriculumHeading,
} from "../src/lib/curriculum/catalog-matcher";
import { RU_FRP_2025_DRAFT } from "../src/lib/curriculum/ru-frp-2025-draft";

const approved = [
  { id: "approved-1", title: "Орфоэпия и произносительные нормы",
    review_status: "approved" as const, aliases: ["Орфоэпия"] },
  { id: "draft-1", title: "Фразеологизмы",
    review_status: "draft" as const, aliases: ["Фразеология"] },
];
describe("FRP draft curriculum taxonomy", () => {
  it("has unique canonical keys and titles and 11 parent sections", () => {
    expect(new Set(RU_FRP_2025_DRAFT.map((r) => r.key)).size).toBe(RU_FRP_2025_DRAFT.length);
    const titles = RU_FRP_2025_DRAFT.map((x) => normalizeCurriculumName(x.title));
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(RU_FRP_2025_DRAFT.map((x) => x.sectionCode)).size).toBe(11);
  });
  it("keeps cross-grade topics as one concept instead of repeated rows", () => {
    expect(RU_FRP_2025_DRAFT.filter((x) => x.title === "Состав слова")).toHaveLength(1);
    expect(RU_FRP_2025_DRAFT.find((x) => x.title === "Состав слова")?.bands)
      .toEqual(["1-4","5-9","10-11"]);
  });
});
describe("heading comparison never creates curricular topics", () => {
  it("matches reviewed canonical topic by exact approved alias", () => {
    expect(matchCurriculumHeading("§ 14. ОРФОЭПИЯ",approved))
      .toMatchObject({status:"approved_exact",topic_id:"approved-1"});
    expect(normalizeCurriculumName("Орфоэпия")).toBe("орфоэпия");
  });
  it("returns draft proposal instead of linking to unapproved curriculum", () => {
    expect(matchCurriculumHeading("ФРАЗЕОЛОГИЯ", approved))
      .toMatchObject({status:"draft_exact",topic_id:null,candidate_ids:["draft-1"]});
  });
  it("never guesses OCR letter substitution or arbitrary notes", () => {
    expect(matchCurriculumHeading("Орфобпия",approved).status).toBe("no_match");
    expect(matchCurriculumHeading("Примечание",approved).topic_id).toBeNull();
    expect(matchCurriculumHeading("|",approved).status).toBe("no_match");
  });
  it("holds duplicate aliases for review", () => {
    const duplicated = [...approved, {
      id:"approved-2",title:"Нормы произношения",
      review_status:"approved" as const, aliases:["Орфоэпия"],
    }];
    expect(matchCurriculumHeading("Орфоэпия",duplicated))
      .toMatchObject({status:"ambiguous",topic_id:null});
  });
  it("never treats an exact retired topic as a valid automatic link", () => {
    expect(matchCurriculumHeading("Звуки и буквы", [
      { id:"retired",title:"Звуки и буквы",
        review_status:"retired" as const,aliases:[] },
    ]).topic_id).toBeNull();
  });
});
