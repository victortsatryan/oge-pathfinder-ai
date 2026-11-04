// Pure, client-safe logic for the source-file -> Extractor worker -> Pathy pipeline.
// The worker HTTP contract is defined here (see docs/extractor-worker-contract.md);
// the Python repository itself was not readable from this environment.

export const SOURCE_EXTENSIONS = ["pdf", "docx", "txt", "md", "xlsx", "csv", "png", "jpg", "jpeg"] as const;
export const MAX_SOURCE_BYTES = 50 * 1024 * 1024;

export function sourceExtension(name: string): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return (SOURCE_EXTENSIONS as readonly string[]).includes(ext) ? ext : null;
}

export type WorkerState = "queued" | "processing" | "succeeded" | "failed";

export function parseWorkerStatus(body: unknown): { status: WorkerState; progress: number; error: string | null; result: unknown } {
  const b = (body ?? {}) as Record<string, unknown>;
  const raw = String(b.status ?? "").toLowerCase();
  const status: WorkerState =
    ["succeeded", "success", "done", "completed"].includes(raw) ? "succeeded"
      : ["failed", "error"].includes(raw) ? "failed"
        : ["running", "processing", "started"].includes(raw) ? "processing" : "queued";
  const p = Number(b.progress);
  const progress = status === "succeeded" ? 100 : Number.isFinite(p) ? Math.max(0, Math.min(99, Math.round(p <= 1 && p > 0 ? p * 100 : p))) : 0;
  return { status, progress, error: status === "failed" ? String(b.error ?? "Ошибка обработчика") : null, result: b.result ?? null };
}

/** Units may be at result.units, result.canonical.units or result.canonical_json.units. */
export function extractUnits(result: unknown): Record<string, unknown>[] {
  const r = (result ?? {}) as Record<string, any>;
  const list = r.units ?? r.canonical?.units ?? r.canonical_json?.units ?? [];
  return Array.isArray(list) ? list.filter((u) => u && typeof u === "object") : [];
}

const REVIEW_STATUSES = ["needs_review", "needs_structure_review", "low_confidence", "conflict", "unresolved", "ocr_conflict"];
export const CONFIDENCE_THRESHOLD = 0.85;

export type ClassifiedUnit = {
  unit_id: string; title: string; kind: string; content_text: string; pages: number[];
  author: string | null; answer: unknown; topic_id: string | null; explanation: string | null;
  confidence: number | null; decision: "confident" | "review" | "invalid"; reasons: string[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveAuthor(unitSource: unknown, jobAuthor: string | null | undefined): string | null {
  const s = (unitSource ?? {}) as Record<string, unknown>;
  const a = typeof s.author === "string" ? s.author.trim() : "";
  if (a) return a;
  const j = (jobAuthor ?? "").trim();
  return j || null; // never invent an author
}

export function classifyUnit(u: Record<string, any>, jobAuthor?: string | null): ClassifiedUnit {
  const reasons: string[] = [];
  const unit_id = String(u.unit_id ?? "").trim();
  const title = String(u.title ?? "").trim();
  const content_text = String(u.content_text ?? u.text ?? "").trim();
  const pages = Array.isArray(u.pages) ? u.pages.filter((p: unknown) => Number.isInteger(p) && (p as number) > 0) : [];
  const confRaw = u.confidence ?? u.quality?.confidence;
  const confidence = typeof confRaw === "number" && Number.isFinite(confRaw) ? confRaw : null;
  const review = String(u.review_status ?? "").toLowerCase();
  const issues = Array.isArray(u.issues) ? u.issues : Array.isArray(u.flags) ? u.flags : [];
  const answer = u.answer ?? u.correct_answer ?? null;
  const topic_id = typeof u.topic_id === "string" && UUID.test(u.topic_id) ? u.topic_id : null;

  if (!unit_id) reasons.push("Нет unit_id");
  if (!title) reasons.push("Нет заголовка");
  if (!content_text) reasons.push("Пустой текст");
  if (reasons.length) return { unit_id: unit_id || "?", title, kind: String(u.kind ?? ""), content_text, pages, author: null, answer, topic_id, explanation: null, confidence, decision: "invalid", reasons };

  if (u.needs_structure_review === true) reasons.push("Экстрактор пометил: нужна проверка структуры");
  if (REVIEW_STATUSES.includes(review)) reasons.push(`Статус экстрактора: ${review}`);
  if (confidence !== null && confidence < CONFIDENCE_THRESHOLD) reasons.push(`Уверенность ${confidence.toFixed(2)} < ${CONFIDENCE_THRESHOLD}`);
  if (issues.length) reasons.push(`Замечания экстрактора: ${issues.length}`);
  if (!pages.length) reasons.push("Нет страниц источника");

  return {
    unit_id, title, kind: String(u.kind ?? "reference"), content_text, pages,
    author: resolveAuthor(u.source, jobAuthor), answer, topic_id,
    explanation: typeof u.explanation === "string" ? u.explanation : null,
    confidence, decision: reasons.length ? "review" : "confident", reasons,
  };
}

/** Effective admin choice: confident units publish unless rejected; review units only when accepted. */
export function shouldPublish(u: ClassifiedUnit, decision: "accept" | "reject" | undefined): boolean {
  if (u.decision === "invalid") return false;
  if (decision === "reject") return false;
  return u.decision === "confident" || decision === "accept";
}

/** A task is created only with an explicit answer AND an explicit topic link — never guessed. */
export function canCreateTask(u: ClassifiedUnit): boolean {
  const hasAnswer = u.answer !== null && u.answer !== undefined && String(u.answer).trim() !== "";
  return hasAnswer && u.topic_id !== null && /exercise|task|задани|упражн/i.test(u.kind);
}

export function kindToMaterialType(kind: string): string {
  if (/exercise|task|упражн/i.test(kind)) return "exercise_set";
  if (kind === "book_page") return "textbook_paragraph";
  if (/rule|theory|правил/i.test(kind)) return "theory";
  return "reference";
}

export function canPublishWithRights(rights: string): boolean {
  return rights === "own" || rights === "licensed" || rights === "public_domain";
}
