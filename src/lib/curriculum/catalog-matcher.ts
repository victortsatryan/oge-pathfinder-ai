/**
 * Conservative, evidence-first topic matching.
 * A textbook heading is a source observation, not a curriculum ontology node.
 * Never fuzzy-match OCR (false friends: "юродивый" / corrupted letters), and
 * never automatically use a DRAFT or retired curriculum topic.
 */
export interface CurriculumMatchTopic {
  id: string;
  title: string;
  review_status: "draft" | "approved" | "retired";
  aliases: string[];
}
export interface CurriculumMatch {
  topic_id: string | null;
  status: "approved_exact" | "draft_exact" | "ambiguous" | "no_match";
  candidate_ids: string[];
}
export function normalizeCurriculumName(input: string): string {
  return input.normalize("NFKC").toLocaleLowerCase("ru")
    .replace(/ё/g,"е").replace(/§\s*\d+\s*[.:]?\s*/gu," ")
    .replace(/[^а-яa-z0-9]+/gu," ").trim().replace(/\s+/g," ");
}
export function matchCurriculumHeading(
  heading: string, topics: readonly CurriculumMatchTopic[],
): CurriculumMatch {
  const key = normalizeCurriculumName(heading);
  if (key.length < 5 || key.split(" ").every((x) => x.length <= 2)) {
    return { topic_id: null, status: "no_match", candidate_ids: [] };
  }
  const matches = topics.filter((t) => [t.title, ...t.aliases]
    .some((v) => normalizeCurriculumName(v) === key));
  const ids = [...new Set(matches.map((t) => t.id))];
  if (!ids.length) return { topic_id: null, status: "no_match", candidate_ids: [] };
  if (ids.length > 1) return { topic_id: null, status: "ambiguous", candidate_ids: ids };
  const topic = matches[0];
  if (topic.review_status !== "approved") {
    return { topic_id: null, status: "draft_exact", candidate_ids: ids };
  }
  return { topic_id: topic.id, status: "approved_exact", candidate_ids: ids };
}
