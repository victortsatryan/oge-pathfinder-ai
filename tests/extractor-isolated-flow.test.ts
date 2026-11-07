import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// No production client is loaded. RPC wrappers, database and worker HTTP are isolated in memory.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { publishExtractorJob, refreshExtractorJob, saveExtractorUnitReview, getExtractorJobs } from "../src/lib/extractor/jobs.functions";
const sha = "a".repeat(64);
const jobId = "11111111-1111-4111-8111-111111111111";
const subjectId = "22222222-2222-4222-8222-222222222222";
type Row = Record<string, any>;
const rawUnit = (i: number, overrides: Row = {}) => ({
  unit_id: `u${i}`, role: "student_material", kind: "exercise", title: `Unit ${i}`,
  content_text: `Source text ${i}`, pages: [i + 1], source: { sha256: sha, author: "Source author" },
  usable_for_learning: true, usable_for_grading: false, answer: null, ...overrides,
});

function memoryDatabase(admin = true) {
  const tables: Record<string, Row[]> = {
    extractor_jobs: [{ id: jobId, file_sha256: sha, file_name: "isolated.txt", status: "succeeded", author: null, unit_decisions: {}, publish_report: null }],
    extractor_job_units: [], materials: [], subjects: [],
  };
  let writes = 0;
  const sb = {
    rpc: vi.fn(async () => ({ data: admin, error: null })),
    from: (name: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      let action = "select", payload: any, limit = Infinity, single = false, count = false;
      const q: any = {
        select: (_fields?: string, opts?: Row) => { count = opts?.count === "exact"; return q; },
        eq: (key: string, value: unknown) => { filters.push(r => (key === "extractor_metadata->>unit_key" ? r.extractor_metadata?.unit_key : r[key]) === value); return q; },
        order: () => q, limit: (n: number) => { limit = n; return q; },
        single: () => { single = true; return q; }, maybeSingle: () => { single = true; return q; },
        update: (value: Row) => { action = "update"; payload = value; return q; },
        insert: (value: Row) => { action = "insert"; payload = value; return q; },
        upsert: (value: Row[]) => { action = "upsert"; payload = value; return q; },
        then: (resolve: (r: Row) => unknown) => {
          const rows = tables[name];
          if (!rows) throw new Error(`Unexpected table ${name}`);
          let found = rows.filter(r => filters.every(f => f(r))).slice(0, limit);
          if (action === "update") { writes++; found.forEach(r => Object.assign(r, payload)); }
          if (action === "insert") { writes++; const row = { id: `m${rows.length}`, ...payload }; rows.push(row); found = [row]; }
          if (action === "upsert") {
            writes++;
            for (const row of payload) if (!rows.some(r => r.job_id === row.job_id && r.unit_id === row.unit_id)) rows.push({ id: row.unit_id, publish_state: "pending", ...row });
          }
          return Promise.resolve(resolve({ data: single ? found[0] ?? null : found, error: null, count: count ? found.length : null }));
        },
      };
      return q;
    },
  };
  return { tables, sb, writes: () => writes };
}

// Invoke the actual handler body; middleware transport is intentionally not part of this mock test.
const invoke = (fn: unknown, db: ReturnType<typeof memoryDatabase>, data?: Row) =>
  (fn as (arg: unknown) => Promise<any>)({ data, context: { supabase: db.sb, userId: "isolated-admin" } });
const publishInput = { id: jobId, subject_id: subjectId, rights_basis: "licensed", confirmed: true };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.stubEnv("PATHY_EXTRACTOR_API_URL", "");
  vi.stubEnv("PATHY_EXTRACTOR_API_TOKEN", "");
});

describe("isolated actual extractor handlers (mock DB + worker, not LIVE E2E)", () => {
  it.each(["student", "teacher"])("denies %s before reading or writing job data", async () => {
    const db = memoryDatabase(false);
    await expect(invoke(publishExtractorJob, db, publishInput)).rejects.toThrow("администратору");
    expect(db.writes()).toBe(0);
    expect(db.tables.materials).toHaveLength(0);
  });
  it("reports worker not configured without a job or network call", async () => {
    const db = memoryDatabase(); const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await invoke(getExtractorJobs, db)).workerConfigured).toBe(false);
    expect(db.writes()).toBe(0); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rights gate denies unknown rights before any write", async () => {
    const db = memoryDatabase();
    await expect(invoke(publishExtractorJob, db, { ...publishInput, rights_basis: "unknown" })).rejects.toThrow("Права");
    expect(db.writes()).toBe(0);
  });
  it("runs review -> batched publication -> repeat with attribution, privacy and no grading", async () => {
    const db = memoryDatabase();
    const raws = [rawUnit(0), rawUnit(1, { requires_manual_review: true }), rawUnit(2, { role: "teacher_private", content_text: "27. answer" }), ...Array.from({ length: 31 }, (_, i) => rawUnit(i + 3))];
    db.tables.extractor_job_units = raws.map((raw, i) => ({ id: `row${i}`, job_id: jobId, unit_id: raw.unit_id, raw, publish_state: "pending" }));
    await invoke(saveExtractorUnitReview, db, { id: jobId, unit_id: "u1", choice: "accept_corrected", reviewed_text: "Human corrected" });
    const first = await invoke(publishExtractorJob, db, publishInput);
    expect(first.remaining).toBe(4);
    expect(first.materials).toBe(29);
    expect((await invoke(publishExtractorJob, db, publishInput)).remaining).toBe(0);
    expect(db.tables.materials).toHaveLength(33);
    expect(db.tables.materials.find(m => m.extractor_metadata.unit_id === "u2")).toBeUndefined();
    const corrected = db.tables.materials.find(m => m.extractor_metadata.unit_id === "u1");
    expect(corrected?.content_text).toBe("Human corrected");
    expect(corrected?.extractor_metadata.original_ocr_text).toBe("Source text 1");
    expect(corrected?.source_name).toBe("Source author");
    expect(corrected?.extractor_metadata.source_sha256).toBe(sha);
    expect(corrected?.extractor_metadata.usable_for_grading).toBe(false);
    expect(corrected?.topic_id).toBeNull();
    // Replay persisted units: actual handler reads existing stable identities and never inserts again.
    db.tables.extractor_job_units.forEach(r => { r.publish_state = "pending"; });
    await invoke(publishExtractorJob, db, publishInput); await invoke(publishExtractorJob, db, publishInput);
    expect(db.tables.materials).toHaveLength(33);
  });
  it("flagged units without acceptance stay unpublished", async () => {
    const db = memoryDatabase();
    db.tables.extractor_job_units.push({ id: "r", job_id: jobId, unit_id: "u0", publish_state: "pending", raw: rawUnit(0, { review_status: "needs_review" }) });
    await invoke(publishExtractorJob, db, publishInput);
    expect(db.tables.materials).toHaveLength(0);
  });
  it("pulls real-format result pages and replays them idempotently in memory", async () => {
    const db = memoryDatabase();
    Object.assign(db.tables.extractor_jobs[0], { status: "fetching_result", external_job_id: jobId, result_next_offset: 0, result_total_units: null });
    vi.stubEnv("PATHY_EXTRACTOR_API_URL", "https://worker.invalid"); vi.stubEnv("PATHY_EXTRACTOR_API_TOKEN", "isolated-fixture");
    const fetchMock = vi.fn(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get("offset"));
      const units = Array.from({ length: offset === 0 ? 40 : 5 }, (_, i) => rawUnit(offset + i));
      return new Response(JSON.stringify({ format: "pathy-extraction-result-v1", source: { sha256: sha }, summary: { total_units: 45 }, units, next_offset: offset === 0 ? 40 : null }));
    });
    vi.stubGlobal("fetch", fetchMock);
    expect((await invoke(refreshExtractorJob, db, { id: jobId })).job.status).toBe("succeeded");
    expect(db.tables.extractor_job_units).toHaveLength(45); expect(fetchMock).toHaveBeenCalledTimes(2);
    Object.assign(db.tables.extractor_jobs[0], { status: "fetching_result", result_next_offset: 0 });
    await invoke(refreshExtractorJob, db, { id: jobId });
    expect(db.tables.extractor_job_units).toHaveLength(45);
  });
});