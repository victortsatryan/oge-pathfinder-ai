/**
 * Source-bound section segmentation.
 *
 * OCR sometimes merges several textbook sections into 20–40k-character units.
 * Only explicitly printed numbered §/$ headings are eligible for automatic
 * curricular topic creation; unclear numbering, OCR fragments and oversized
 * sections go to review. Neither task answers nor exam mappings are inferred.
 */
export interface SourceTextUnit { id: string; content_text: string | null; title: string }
export interface SectionCandidate {
  number: number;
  title: string;
  text: string;
  origin_material_id: string;
  offset_start: number;
  offset_end: number;
  evidence: string;
  confidence: "high" | "review";
  review_reason: string | null;
}
const HEADING = /(?:^|\n)[ \t]*[$§][ \t]*(\d{1,3})\.[ \t]*([^\n]{4,115})/g;
const SMALL_WORDS = new Set(["и", "его", "ее", "её", "на", "по", "в", "во", "к", "с", "со", "для", "их", "при", "из", "как", "языка", "слова"]);
const normalized = (v: string) => v.normalize("NFKC").toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim();
const lexemes = (v: string) => normalized(v).split(/\s+/).filter((w) => w.length >= 4 && !SMALL_WORDS.has(w)).map((w) => w.slice(0, Math.min(w.length, 6)));
function coherentTitles(a: string, b: string): boolean {
  const aa = lexemes(a), bb = lexemes(b);
  return aa.some((a) => bb.some((b) => a === b || (a.length >= 5 && b.startsWith(a.slice(0, 5)))));
}
function cleanedTitle(s: string) {
  return s.replace(/\s+/g, " ").trim().replace(/[.;,:—–-]+$/g, "").trim().slice(0, 110);
}
function plausibleTitle(t: string) {
  const letters = (t.match(/[а-яё]/gi) ?? []).length;
  return letters >= 6 && t.length >= 7 && t.length <= 110 && !/^(?:\d+|\W+)$/u.test(t);
}

export function parseSourceSections(units: SourceTextUnit[]): SectionCandidate[] {
  const all: SectionCandidate[] = [];
  for (const unit of units) {
    const text = unit.content_text ?? "";
    if (text.length < 800) continue;
    const hits = Array.from(text.matchAll(HEADING));
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      const number = Number(hit[1]);
      const title = cleanedTitle(hit[2]);
      const start = hit.index ?? 0;
      const end = i + 1 < hits.length ? hits[i + 1].index ?? text.length : text.length;
      const sectionText = text.slice(start, end).trim();
      if (number < 1 || number > 300 || !plausibleTitle(title)) continue;
      const validLength = sectionText.length >= 300 && sectionText.length <= 12000;
      all.push({
        number, title, text: sectionText,
        origin_material_id: unit.id,
        offset_start: start, offset_end: end,
        evidence: "$/§ " + number + ". " + title,
        confidence: validLength ? "high" : "review",
        review_reason: validLength ? null : "short_or_oversized_ocr_section",
      });
    }
  }
  const byNumber = new Map<number, SectionCandidate[]>();
  for (const section of all) byNumber.set(section.number, [...(byNumber.get(section.number) ?? []), section]);
  const result: SectionCandidate[] = [];
  for (const [number, group] of byNumber) {
    const substantive = group.filter((x) => x.text.length >= 300 && x.text.length <= 12000);
    const selected = [...(substantive.length ? substantive : group)]
      .sort((a, b) => b.text.length - a.text.length)[0];
    const conflict = group.some((c) =>
      c.title !== selected.title && !coherentTitles(c.title, selected.title));
    const closestTitle = [...group].filter((c) => coherentTitles(c.title, selected.title) || c.title === selected.title)
      .sort((a, b) => b.title.length - a.title.length)[0]?.title ?? selected.title;
    const reason = conflict ? "conflicting_section_headings" : selected.review_reason;
    result.push({
      ...selected, number, title: closestTitle,
      confidence: reason ? "review" : "high",
      review_reason: reason,
    });
  }
  return result.sort((a, b) => a.number - b.number);
}

/** Keep all source units, but prevent OCR artifacts from silently being treated as lesson-ready. */
export function sourceUnitQuality(text: string | null | undefined, title: string, kind: string): string {
  const s = (text ?? "").trim();
  if (s.length < 100) return "needs_review_short_ocr";
  if (s.length > 12000) return "needs_review_merged_sections";
  if (kind === "artifact" || /^[^\\p{L}\\p{N}]+$/u.test(title.trim())) return "needs_review_artifact";
  return "source_ocr_unverified";
}
