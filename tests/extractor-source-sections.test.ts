import { describe, expect, it } from "vitest";
import { parseSourceSections } from "../src/lib/extractor/source-sections";

const section = (n: number, title: string, body = "Содержимое учебного параграфа с примерами и объяснением. ".repeat(12)) =>
  "\n§ " + n + ". " + title + "\n" + body;
describe("evidence-bound curriculum extraction", () => {
  it("segments two independently named source sections with offsets", () => {
    const text = "Предисловие\n" + section(12,"Лексикография") + section(13, "Звуки и буквы");
    const out = parseSourceSections([{id:"m1",title:"Параграф",content_text:text}]);
    expect(out.map(x=>x.number)).toEqual([12,13]);
    expect(out.every(x=>x.confidence==="high")).toBe(true);
    expect(out[0].text).toContain("Лексикография");
    expect(out[1].origin_material_id).toBe("m1");
    expect(out[0].offset_end).toBeLessThan(out[1].offset_end);
  });
  it("never derives topics from a single symbol or free-form unnumbered prose", () => {
    expect(parseSourceSections([{id:"m1",title:"|",content_text:"|"}])).toEqual([]);
    expect(parseSourceSections([{id:"m2",title:"Глава",content_text:"Орфография: ".repeat(300)}])).toEqual([]);
  });
  it("holds duplicate section numbers with contradictory headings for editorial review", () => {
    const text = section(1,"Слово и его значение")+section(2,"Омонимы и их употребление") + section(1,"Фразеология и устойчивые сочетания");
    const result = parseSourceSections([{id:"a",title:"Книга",content_text:text}]);
    expect(result.find(x=>x.number===1)?.confidence).toBe("review");
    expect(result.find(x=>x.number===1)?.review_reason).toBe("conflicting_section_headings");
  });
  it("excludes oversized merged blocks from automated topic assignment", () => {
    const content=section(8,"Происхождение лексики", "Русский язык и его история. ".repeat(650));
    const result=parseSourceSections([{id:"a",title:"Книга",content_text:content}]);
    expect(result[0].confidence).toBe("review");
  });
});
