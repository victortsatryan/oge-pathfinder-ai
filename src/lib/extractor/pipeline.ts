// Pure, client-safe logic for the source-file -> Extractor worker -> Pathy pipeline.
// HTTP contract: docs/extractor-worker-contract.md (pathy_extractor/worker_service_v06.py).

export const SOURCE_EXTENSIONS = ["pdf", "docx", "txt", "md", "xlsx", "csv", "png", "jpg", "jpeg"] as const;
export const MAX_SOURCE_BYTES = 160 * 1024 * 1024;
export const RESULT_PAGE_LIMIT = 40; // worker allows <= 50
export const PUBLISH_BATCH = 30;
export const RESULT_FORMAT = "pathy-extraction-result-v1";

export function sourceExtension(name: string): string | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return (SOURCE_EXTENSIONS as readonly string[]).includes(ext) ? ext : null;
}

/** Magic-byte check of the first bytes of the stored object against the extension. */
export function magicMatches(ext: string, head: Uint8Array): boolean {
  const s = (n: number[]) => n.every((b, i) => head[i] === b);
  switch (ext) {
    case "pdf": return s([0x25, 0x50, 0x44, 0x46]);
    case "docx": case "xlsx": return s([0x50, 0x4b, 0x03, 0x04]);
    case "png": return s([0x89, 0x50, 0x4e, 0x47]);
    case "jpg": case "jpeg": return s([0xff, 0xd8, 0xff]);
    default: return !head.slice(0, 512).includes(0); // text formats: no NUL bytes
  }
}

export type WorkerState = "queued" | "processing" | "succeeded" | "failed";

/** GET /v1/jobs/{id} -> { job_id, status: queued|running|succeeded|failed, stage, units, error }. No `result` field. */
export function parseWorkerStatus(body: unknown): { status: WorkerState; stage: string | null; error: string | null; units: unknown } {
  const b = (body ?? {}) as Record<string, unknown>;
  const raw = String(b.status ?? "");
  const status: WorkerState = raw === "succeeded" ? "succeeded" : raw === "failed" ? "failed" : raw === "running" ? "processing" : "queued";
  return {
    status, stage: typeof b.stage === "string" ? b.stage : null,
    error: status === "failed" ? String(b.error ?? "Ошибка обработчика") : null, units: b.units ?? null,
  };
}

export type ResultPage = { units: Record<string, unknown>[]; next_offset: number | null; total_units: number | null; source_sha256: string | null; summary: unknown };

/** GET /v1/jobs/{id}/result?offset&limit. Throws on any contract violation instead of guessing. */
export function parseResultPage(body: unknown): ResultPage {
  const b = (body ?? {}) as Record<string, any>;
  if (b.format !== RESULT_FORMAT) throw new Error(`Неизвестный формат результата: ${String(b.format)}`);
  if (!Array.isArray(b.units)) throw new Error("В результате нет списка units");
  const n = b.next_offset;
  if (n !== null && !(Number.isInteger(n) && n >= 0)) throw new Error("Некорректный next_offset");
  const total = Number.isInteger(b.summary?.total_units) ? b.summary.total_units : null;
  return {
    units: b.units.filter((u: unknown) => u && typeof u === "object"), next_offset: n,
    total_units: total, source_sha256: typeof b.source?.sha256 === "string" ? b.source.sha256 : null, summary: b.summary ?? null,
  };
}

export type ClassifiedUnit = {
  unit_id: string; title: string; kind: string; material_type: string | null; content_text: string; pages: number[];
  author: string | null; role: string; related_unit_ids: string[];
  decision: "confident" | "review" | "private" | "invalid"; reasons: string[];
};

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
  const content_text = String(u.content_text ?? "").trim();
  const pages = Array.isArray(u.pages) ? u.pages.filter((p: unknown) => Number.isInteger(p) && (p as number) > 0) : [];
  const role = String(u.role ?? "");
  const related_unit_ids = Array.isArray(u.related_unit_ids) ? u.related_unit_ids.map(String) : [];
  const base = {
    unit_id: unit_id || "?", title, kind: String(u.kind ?? ""), material_type: typeof u.material_type === "string" ? u.material_type : null,
    content_text, pages, author: resolveAuthor(u.source, jobAuthor), role, related_unit_ids,
  };

  // Privacy first: teacher-only content (answer keys etc.) is never published, whatever else is true.
  if (role !== "student_material") {
    return { ...base, decision: "private", reasons: [role === "teacher_private" ? "Материал только для учителя (ключи/ответы) — не публикуется" : `Неизвестная роль: ${role || "—"}`] };
  }
  if (!unit_id) reasons.push("Нет unit_id");
  if (!content_text) reasons.push("Пустой текст");
  if (u.usable_for_learning !== true) reasons.push("Экстрактор: не пригодно для обучения");
  if (reasons.length) return { ...base, decision: "invalid", reasons };

  const rr = Array.isArray(u.review_reasons) ? u.review_reasons.map(String) : [];
  if (u.requires_manual_review === true || u.review_status === "needs_review") reasons.push("Экстрактор пометил: нужна проверка");
  for (const r of rr) reasons.push(r);
  if (!pages.length) reasons.push("Нет страниц источника");
  return { ...base, decision: reasons.length ? "review" : "confident", reasons };
}

/** Confident units publish unless rejected; review units only when accepted. Private/invalid: never. */
export function shouldPublish(u: ClassifiedUnit, decision: "accept" | "reject" | undefined): boolean {
  if (u.decision === "private" || u.decision === "invalid") return false;
  if (decision === "reject") return false;
  return u.decision === "confident" || decision === "accept";
}

/** v0.6 worker sets usable_for_grading:false and answer:null — no graded tasks are created from it. */
export function canCreateTask(raw: Record<string, any>): boolean {
  return raw.role === "student_material" && raw.usable_for_grading === true && raw.answer != null && String(raw.answer).trim() !== "";
}

/** Stable identity across re-runs: source SHA + extractor unit id. */
export function stableUnitKey(sha: string, unitId: string): string {
  return `${sha}:${unitId}`;
}

export function kindToMaterialType(kind: string, materialType?: string | null): string {
  const allowed = ["exercise_set", "textbook_paragraph", "theory", "reference"];
  if (materialType && allowed.includes(materialType)) return materialType;
  if (/exercise|task|упражн/i.test(kind)) return "exercise_set";
  if (kind === "book_page") return "textbook_paragraph";
  if (/rule|theory|правил/i.test(kind)) return "theory";
  return "reference";
}

export function canPublishWithRights(rights: string): boolean {
  return rights === "own" || rights === "licensed" || rights === "public_domain";
}

export type ReviewChoice = "accept_corrected" | "keep_original" | "reject";

/**
 * Text + status used at publication. Human-corrected text is used only on an explicit
 * "accept_corrected"; confident units always use the untouched raw text. Private/invalid never publish.
 */
export function effectivePublication(
  u: ClassifiedUnit, choice: ReviewChoice | null | undefined, reviewedText: string | null | undefined,
  legacy?: "accept" | "reject",
): { publish: boolean; text: string; review_status: string } {
  const no = { publish: false, text: "", review_status: "not_published" };
  if (u.decision === "private" || u.decision === "invalid") return no;
  if (choice === "reject") return no;
  if (choice === "accept_corrected") {
    const t = (reviewedText ?? "").trim();
    return t ? { publish: true, text: t, review_status: "human_corrected" } : no;
  }
  if (choice === "keep_original") return { publish: true, text: u.content_text, review_status: "human_approved_original" };
  if (!shouldPublish(u, legacy)) return no;
  return { publish: true, text: u.content_text, review_status: u.decision === "confident" ? "auto_extracted_unverified" : "human_approved_original" };
}
