import { z } from "zod";

export const EXTRACTOR_FORMAT = "pathy-extractor-audit-staging-v1";
export const BATCH_SIZE = 20;
const text = z.string().trim().min(1);
const sha = z.string().regex(/^[0-9a-fA-F]{64}$/, "Нужен SHA-256 из 64 hex-символов");
export const unitSchema = z.object({
  unit_id: text.max(500), kind: text.max(100), title: text.max(2000),
  content_text: text.max(2_000_000),
  pages: z.array(z.number().int().positive()).min(1),
  source: z.object({ sha256: sha.optional(), source_sha256: sha.optional() }).passthrough()
    .refine((s) => Boolean(s.sha256 || s.source_sha256), "Нет source.sha256 / source.source_sha256")
    .refine((s) => !s.sha256 || !s.source_sha256 || s.sha256.toLowerCase() === s.source_sha256.toLowerCase(), "SHA источника противоречат друг другу"),
  review_status: text,
  rights: z.union([text, z.object({}).passthrough()]),
  platform: z.object({ status: z.literal("draft"), is_public: z.literal(false) }).passthrough(),
  needs_structure_review: z.boolean().optional(),
}).passthrough();
export type ExtractorUnit = z.infer<typeof unitSchema>;
export type UnitReport = { index: number; unit_id: string; status: "new" | "existing" | "failed"; reasons: string[]; warnings: string[] };

export function sourceSha(unit: ExtractorUnit) {
  return (unit.source.sha256 ?? unit.source.source_sha256 ?? "").toLowerCase();
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
export async function payloadSha(value: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value)));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export function inspectFile(value: unknown) {
  const envelope = z.object({ format: z.literal(EXTRACTOR_FORMAT), units: z.array(z.unknown()).min(1) }).passthrough().safeParse(value);
  if (!envelope.success) return { units: [] as unknown[], errors: envelope.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), reports: [] as UnitReport[] };
  const ids = new Map<string, number>();
  for (const u of envelope.data.units) {
    if (u && typeof u === "object" && "unit_id" in u && typeof u.unit_id === "string") ids.set(u.unit_id.trim(), (ids.get(u.unit_id.trim()) ?? 0) + 1);
  }
  const reports: UnitReport[] = envelope.data.units.map((u, index) => {
    const p = unitSchema.safeParse(u);
    const id = u && typeof u === "object" && "unit_id" in u ? String(u.unit_id).trim() : `#${index + 1}`;
    const reasons = p.success ? [] : p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    if ((ids.get(id) ?? 0) > 1) reasons.push("Повтор unit_id внутри файла — все повторы заблокированы");
    return { index, unit_id: id, status: reasons.length ? "failed" : "new", reasons, warnings: p.success ? unitWarnings(p.data) : [] };
  });
  return { units: envelope.data.units, errors: [] as string[], reports };
}
export function unitWarnings(unit: ExtractorUnit) {
  const warnings = ["Публикация заблокирована: права и текст требуют ручной проверки", "Связи с topics / tasks / teacher_assignments не создаются"];
  if (unit.needs_structure_review || unit.review_status === "needs_structure_review" || /exercise|task|упражнение/i.test(unit.kind)) warnings.push("Упражнение: требуется проверка структуры, ответ не создаётся");
  return warnings;
}
export const batchSchema = z.object({ format: z.literal(EXTRACTOR_FORMAT), units: z.array(z.unknown()).min(1).max(BATCH_SIZE), confirmed: z.boolean().optional() })
  .refine((v) => new TextEncoder().encode(JSON.stringify(v)).length <= 3_000_000, "Пакет превышает 3 MB");
export const importBatchSchema = batchSchema.refine((b) => b.confirmed === true, "Нужно явное подтверждение администратора");
export function splitBatches(reports: UnitReport[], units: unknown[]) {
  const batches: UnitReport[][] = [];
  let batch: UnitReport[] = [], bytes = 0;
  for (const report of reports) {
    const size = new TextEncoder().encode(JSON.stringify(units[report.index])).length;
    if (batch.length && (batch.length >= BATCH_SIZE || bytes + size > 2_500_000)) { batches.push(batch); batch = []; bytes = 0; }
    batch.push(report); bytes += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}