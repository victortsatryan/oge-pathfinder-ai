import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Isolated: RPC wrappers, database, storage and worker HTTP are all in memory. Not LIVE E2E.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import {
  publishExtractorJob, publishApprovedExtractorCorrections,
  registerExtractorUpload, reprocessExtractorJob, retryExtractorJob,
} from "../src/lib/extractor/jobs.functions";
import { OCR_CORRECTION_VERSION, canPublishRevision, workerCorrectionVersion } from "../src/lib/extractor/pipeline";

type Row = Record<string, any>;
const sha = "5eebab6c023971fc733c59b258c5cedaf76b2764c4e1353b1bb7a75927acf589";
const rootId = "7aa99060-02c6-435d-87a9-743f3b207a7e";
const subjectId = "22222222-2222-4222-8222-222222222222";
const path = `${sha}/goltsova.pdf`;

function memoryDb(admin = true) {
  const material = { id: "mat1", content_text: "original OCR", subject_id: subjectId,
    status: "published", is_public: true,
    extractor_metadata: { job_id: rootId, source_sha256: sha, unit_key: sha + ":u1", unit_id: "u1" } };
  const tables: Record<string, Row[]> = {
    extractor_jobs: [{
      id: rootId, file_sha256: sha, file_name: "goltsova.pdf", mime_type: "application/pdf", size_bytes: 5250121,
      storage_path: path, subject_id: subjectId, author: "Гольцова", rights_basis: "public_domain", status: "published",
      revision: 1, parent_job_id: null, worker_rule_version: null, attempts: 1, unit_decisions: {}, publish_report: null, created_by: "owner",
    }],
    extractor_job_units: [{ id: "unit1", job_id: rootId, unit_id: "u1", publish_state: "published", raw: { unit_id: "u1", content_text: "original OCR" } }],
    materials: [material], topics: [],
  };
  const snapshot = JSON.stringify({ units: tables.extractor_job_units.filter((u) => u.job_id === rootId), materials: tables.materials, root: tables.extractor_jobs[0] });
  let writes = 0;
  let beforeInsert: ((rows: Row[]) => void) | null = null;
  const sb = {
    rpc: vi.fn(async () => ({ data: admin, error: null })),
    storage: { from: () => ({
      info: vi.fn(async (p: string) => (p === path ? { data: { size: 5250121 }, error: null } : { data: null, error: { message: "not found" } })),
      createSignedUrl: vi.fn(async (p: string) => ({ data: { signedUrl: `https://storage.invalid/${p}?token=signed` }, error: null })),
    }) },
    from: (name: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      let action = "select", payload: any, limit = Infinity, mode: "many" | "single" | "maybe" = "many", count = false;
      let order: { key: string; asc: boolean } | null = null;
      const q: any = {
        select: (_f?: string, opts?: Row) => { count = opts?.count === "exact"; return q; },
        eq: (k: string, v: unknown) => { filters.push((r) => (k.includes("->>") ? r.extractor_metadata?.[k.split("->>")[1]] : r[k]) === v); return q; },
        in: (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[k])); return q; },
        order: (key: string, o?: { ascending?: boolean }) => { order = { key, asc: o?.ascending !== false }; return q; },
        limit: (n: number) => { limit = n; return q; },
        single: () => { mode = "single"; return q; }, maybeSingle: () => { mode = "maybe"; return q; },
        update: (v: Row) => { action = "update"; payload = v; return q; },
        insert: (v: Row) => { action = "insert"; payload = v; return q; },
        then: (resolve: (r: Row) => unknown) => {
          const rows = tables[name];
          if (!rows) throw new Error(`Unexpected table ${name}`);
          let found = rows.filter((r) => filters.every((f) => f(r)));
          if (order) { const { key, asc } = order; found = [...found].sort((a, b) => (asc ? a[key] - b[key] : b[key] - a[key])); }
          found = found.slice(0, limit);
          let error: Row | null = null;
          if (action === "update") { writes++; found.forEach((r) => Object.assign(r, payload)); }
          if (action === "insert") {
            if (name === "extractor_jobs" && beforeInsert) { const hook = beforeInsert; beforeInsert = null; hook(rows); }
            const row = { id: `new-${rows.length}`, attempts: 0, unit_decisions: {}, error: null, revision: 1, parent_job_id: null, ...payload };
            if (name === "extractor_jobs" && rows.some((r) => r.file_sha256 === row.file_sha256 && r.revision === row.revision)) {
              error = { code: "23505", message: "duplicate key extractor_jobs_file_sha256_revision_key" };
              found = [];
            } else { writes++; rows.push(row); found = [row]; }
          }
          // Emulate PostgREST: maybeSingle/single over several rows is an error, never "first row".
          if (!error && mode !== "many" && found.length > 1) error = { code: "PGRST116", message: "multiple rows" };
          if (!error && mode === "single" && found.length === 0 && action === "select") error = { code: "PGRST116", message: "no rows" };
          const data = error ? null : mode === "many" ? found : found[0] ?? null;
          return Promise.resolve(resolve({ data, error, count: count ? found.length : null }));
        },
      };
      return q;
    },
  };
  return { tables, sb, writes: () => writes, unchanged: () => JSON.stringify({ units: tables.extractor_job_units.filter((u) => u.job_id === rootId), materials: tables.materials, root: tables.extractor_jobs[0] }) === snapshot, setBeforeInsert: (f: (rows: Row[]) => void) => { beforeInsert = f; } };
}

const invoke = (fn: unknown, db: ReturnType<typeof memoryDb>, data?: Row) =>
  (fn as (arg: unknown) => Promise<any>)({ data, context: { supabase: db.sb, userId: "admin-1" } });

type Call = { url: string; method: string; body: any; auth: string | null };
function stubWorker(health: unknown, opts: { postStatus?: number } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method: init?.method ?? "GET", body, auth: h.get("Authorization") });
    if (url.endsWith("/health")) return new Response(JSON.stringify(health));
    if (url.endsWith("/v1/jobs")) {
      if (opts.postStatus) return new Response("{}", { status: opts.postStatus });
      return new Response(JSON.stringify({ job_id: body.job_id, status: "queued", stage: "queued", source_sha256: body.source_sha256, filename: body.filename, units: null, error: null }), { status: 202 });
    }
    throw new Error("unexpected url " + url);
  }));
  return calls;
}
const goodHealth = { status: "live", service: "pathy-content-extractor", ocr_correction_version: OCR_CORRECTION_VERSION };

beforeEach(() => {
  vi.stubEnv("PATHY_EXTRACTOR_API_URL", "https://worker.invalid");
  vi.stubEnv("PATHY_EXTRACTOR_API_TOKEN", "isolated-fixture");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("pure revision rules", () => {
  it("accepts only the exact correction version", () => {
    expect(workerCorrectionVersion(goodHealth)).toBe(OCR_CORRECTION_VERSION);
    for (const h of [{ status: "live" }, { ocr_correction_version: "pathy-ocr-postcorrection-v1" }, { ocr_correction_version: " pathy-ocr-postcorrection-v2" }, null, "x"]) {
      expect(workerCorrectionVersion(h)).toBeNull();
    }
  });
  it("only revision 1 is publishable", () => {
    expect(canPublishRevision(1)).toBe(true);
    expect(canPublishRevision(2)).toBe(false);
    expect(canPublishRevision(7)).toBe(false);
  });
});

describe("reprocessExtractorJob (isolated mock DB + worker)", () => {
  it.each(["student", "teacher"])("denies %s before any network call or write", async () => {
    const db = memoryDb(false); const calls = stubWorker(goodHealth);
    await expect(invoke(reprocessExtractorJob, db, { id: rootId })).rejects.toThrow("администратору");
    expect(calls).toHaveLength(0); expect(db.writes()).toBe(0);
  });

  it.each([
    ["health without correction version (current live worker shape)", { status: "live", service: "pathy-content-extractor" }],
    ["other version", { ocr_correction_version: "pathy-ocr-postcorrection-v0" }],
  ])("fails safe on %s: no job created, nothing dispatched", async (_n, health) => {
    const db = memoryDb(); const calls = stubWorker(health);
    await expect(invoke(reprocessExtractorJob, db, { id: rootId })).rejects.toThrow("не создана");
    expect(db.tables.extractor_jobs).toHaveLength(1);
    expect(calls.map((c) => c.url)).toEqual(["https://worker.invalid/health"]);
    expect(db.writes()).toBe(0); expect(db.unchanged()).toBe(true);
  });

  it("fails safe when worker is not configured or unreachable", async () => {
    vi.stubEnv("PATHY_EXTRACTOR_API_URL", ""); const db = memoryDb(); const calls = stubWorker(goodHealth);
    await expect(invoke(reprocessExtractorJob, db, { id: rootId })).rejects.toThrow("не подключён");
    expect(calls).toHaveLength(0);
    vi.stubEnv("PATHY_EXTRACTOR_API_URL", "https://worker.invalid");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    await expect(invoke(reprocessExtractorJob, db, { id: rootId })).rejects.toThrow("повторная обработка не создана");
    expect(db.tables.extractor_jobs).toHaveLength(1); expect(db.writes()).toBe(0);
  });

  it("creates revision 2 with cloned source/SHA/rights and a fresh UUID; original untouched", async () => {
    const db = memoryDb(); const calls = stubWorker(goodHealth);
    const r = await invoke(reprocessExtractorJob, db, { id: rootId });
    expect(r).toMatchObject({ revision: 2, status: "queued", worker_rule_version: OCR_CORRECTION_VERSION });
    const rev = db.tables.extractor_jobs.find((j) => j.id === r.id)!;
    expect(rev.id).not.toBe(rootId);
    expect(rev).toMatchObject({ file_sha256: sha, storage_path: path, file_name: "goltsova.pdf", author: "Гольцова", rights_basis: "public_domain",
      subject_id: subjectId, parent_job_id: rootId, revision: 2, worker_rule_version: OCR_CORRECTION_VERSION, created_by: "admin-1", external_job_id: r.id });
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toEqual({ job_id: r.id, source_url: `https://storage.invalid/${path}?token=signed`, source_sha256: sha, filename: "goltsova.pdf" });
    expect(calls.every((c) => c.auth === "Bearer isolated-fixture")).toBe(true);
    expect(db.unchanged()).toBe(true);
    expect(db.tables.extractor_job_units.filter((u) => u.job_id === r.id)).toHaveLength(0);
  });

  it("refuses a second run while one is in flight, then allows revision 3 after completion", async () => {
    const db = memoryDb(); stubWorker(goodHealth);
    const first = await invoke(reprocessExtractorJob, db, { id: rootId });
    await expect(invoke(reprocessExtractorJob, db, { id: rootId })).rejects.toThrow("уже выполняется");
    db.tables.extractor_jobs.find((j) => j.id === first.id)!.status = "succeeded";
    const third = await invoke(reprocessExtractorJob, db, { id: first.id });
    expect(third.revision).toBe(3);
    expect(db.tables.extractor_jobs.find((j) => j.id === third.id)!.parent_job_id).toBe(rootId);
  });

  it("retries the revision number on a unique conflict instead of overwriting", async () => {
    const db = memoryDb(); stubWorker(goodHealth);
    db.setBeforeInsert((rows) => rows.push({ id: "concurrent", file_sha256: sha, revision: 2, status: "failed", parent_job_id: rootId }));
    const r = await invoke(reprocessExtractorJob, db, { id: rootId });
    expect(r.revision).toBe(3);
    expect(db.tables.extractor_jobs.filter((j) => j.revision === 2)).toHaveLength(1);
  });

  it("dispatch failure keeps a failed revision with a real error, never reports success", async () => {
    const db = memoryDb(); stubWorker(goodHealth, { postStatus: 500 });
    const r = await invoke(reprocessExtractorJob, db, { id: rootId });
    expect(r.status).toBe("failed"); expect(r.error).toContain("500");
    expect(db.unchanged()).toBe(true);
  });

  it("rejects unfinished roots and a moved/missing source object", async () => {
    const db = memoryDb(); const calls = stubWorker(goodHealth);
    db.tables.extractor_jobs[0].status = "processing";
    await expect(invoke(reprocessExtractorJob, db, { id: rootId })).rejects.toThrow("завершённых");
    expect(calls).toHaveLength(0);
    db.tables.extractor_jobs[0].status = "published"; db.tables.extractor_jobs[0].storage_path = `${"b".repeat(64)}/x.pdf`;
    await expect(invoke(reprocessExtractorJob, db, { id: rootId })).rejects.toThrow("SHA-256");
    expect(db.tables.extractor_jobs).toHaveLength(1);
  });

  it("retry of a failed revision re-checks the worker version before dispatching", async () => {
    const db = memoryDb(); stubWorker(goodHealth, { postStatus: 500 });
    const r = await invoke(reprocessExtractorJob, db, { id: rootId });
    const calls = stubWorker({ status: "live" });
    await expect(invoke(retryExtractorJob, db, { id: r.id })).rejects.toThrow("не создана");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
});

describe("revision-safe upload dedup and publication guard", () => {
  it("re-upload of the same SHA returns the root revision even when revisions exist", async () => {
    const db = memoryDb(); stubWorker(goodHealth);
    await invoke(reprocessExtractorJob, db, { id: rootId });
    const before = db.writes();
    const r = await invoke(registerExtractorUpload, db, { storage_path: path, file_sha256: sha, file_name: "goltsova.pdf", mime_type: "application/pdf", subject_id: null, author: null });
    expect(r).toEqual({ id: rootId, duplicate: true });
    expect(db.writes()).toBe(before);
  });

  it("publishing a reprocess revision is refused before any write; old materials unchanged", async () => {
    const db = memoryDb(); stubWorker(goodHealth);
    const r = await invoke(reprocessExtractorJob, db, { id: rootId });
    const rev = db.tables.extractor_jobs.find((j) => j.id === r.id)!;
    rev.status = "succeeded";
    db.tables.extractor_job_units.push({ id: "rev-u1", job_id: r.id, unit_id: "u1", publish_state: "pending",
      raw: { unit_id: "u1", role: "student_material", kind: "theory", title: "U1", content_text: "machine corrected", pages: [1], source: { sha256: sha }, usable_for_learning: true, usable_for_grading: false, answer: null } });
    const before = db.writes();
    await expect(invoke(publishExtractorJob, db, { id: r.id, subject_id: subjectId, rights_basis: "public_domain", confirmed: true })).rejects.toThrow("не публикуется");
    expect(db.writes()).toBe(before);
    expect(rev.status).toBe("succeeded");
    expect(db.tables.materials).toHaveLength(1);
    expect(db.tables.materials[0].content_text).toBe("original OCR");
    expect(db.unchanged()).toBe(true);
  });
});


describe("admin revision update of existing published materials", () => {
  function makeReviewed(db: ReturnType<typeof memoryDb>, revisionId: string, overrides: Row = {}) {
    db.tables.extractor_jobs.find(j => j.id === revisionId)!.status = "succeeded";
    const unit: Row = {
      id: "revision-unit", job_id: revisionId, unit_id: "u1", publish_state: "pending",
      raw: { unit_id: "u1", title: "Учебник", kind: "theory",
        role: "student_material", usable_for_learning: true, usable_for_grading: false,
        source: { sha256: sha }, content_text: "предлагаемый машиной текст" },
      review_choice: "accept_corrected", reviewed_text: "проверенный текст",
      reviewed_by: "admin-1", reviewed_at: "2026-11-08T12:00:00Z", ...overrides,
    };
    db.tables.extractor_job_units.push(unit);
    return unit;
  }

  it("applies only the approved unit, with original text preserved in history; a retry is idempotent", async () => {
    const db = memoryDb(); stubWorker(goodHealth);
    const rev = await invoke(reprocessExtractorJob, db, { id: rootId });
    const unit = makeReviewed(db, rev.id);
    const rootSnapshot = JSON.stringify(db.tables.extractor_jobs[0]);
    const oldUnitSnapshot = JSON.stringify(db.tables.extractor_job_units[0]);
    const result = await invoke(publishApprovedExtractorCorrections, db,
      { id: rev.id, unit_ids: ["u1"], confirmed: true });
    expect(result).toEqual({ applied: 1, existing: 0, total: 1 });
    const m = db.tables.materials[0];
    expect(m.id).toBe("mat1");
    expect(m.content_text).toBe("проверенный текст");
    expect(m.extractor_metadata.correction_history).toHaveLength(1);
    expect(m.extractor_metadata.correction_history[0]).toMatchObject({
      previous_text: "original OCR", source_revision: 2, job_id: rev.id, unit_id: "u1",
      human_reviewer: "admin-1", grading_authorized: false,
    });
    expect(unit.publish_state).toBe("published");
    expect(JSON.stringify(db.tables.extractor_jobs[0])).toBe(rootSnapshot);
    expect(JSON.stringify(db.tables.extractor_job_units[0])).toBe(oldUnitSnapshot);
    expect(db.tables.extractor_jobs.find(j => j.id === rev.id)!.status).toBe("succeeded");
    const retry = await invoke(publishApprovedExtractorCorrections, db,
      { id: rev.id, unit_ids: ["u1"], confirmed: true });
    expect(retry).toEqual({ applied: 0, existing: 1, total: 1 });
    expect(m.extractor_metadata.correction_history).toHaveLength(1);
  });

  it("never applies v1 OCR or unreviewed/teacher-private/wrong SHA corrections", async () => {
    const db = memoryDb(); stubWorker(goodHealth);
    const rev = await invoke(reprocessExtractorJob, db, { id: rootId });
    const unit = makeReviewed(db, rev.id);
    const job = db.tables.extractor_jobs.find(j => j.id === rev.id)!;
    const before = db.writes();
    const apply = () => invoke(publishApprovedExtractorCorrections, db,
      { id: rev.id, unit_ids: ["u1"], confirmed: true });
    job.worker_rule_version = "pathy-ocr-postcorrection-v1";
    await expect(apply()).rejects.toThrow("новым корректором");
    job.worker_rule_version = OCR_CORRECTION_VERSION;
    unit.review_choice = null;
    await expect(apply()).rejects.toThrow("сохранённая проверка");
    unit.review_choice = "accept_corrected";
    unit.raw.role = "teacher_private";
    await expect(apply()).rejects.toThrow("Приватный");
    unit.raw.role = "student_material";
    unit.raw.source.sha256 = "b".repeat(64);
    await expect(apply()).rejects.toThrow("SHA");
    expect(db.writes()).toBe(before);
    expect(db.tables.materials[0].content_text).toBe("original OCR");
  });
});
