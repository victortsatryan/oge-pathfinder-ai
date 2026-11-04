export function kindToMaterial(kind: string): string {
  if (kind === "exercise") return "exercise_set";
  if (kind === "book_page") return "textbook_paragraph";
  if (kind === "rule") return "theory";
  return "reference";
}
