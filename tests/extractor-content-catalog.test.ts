import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { getPublishedContentCatalog, linkMaterialToApprovedTopic } from "../src/lib/content-catalog.functions";

const own = "8ee8190d-fd18-4a08-916a-7f8258c3cd7e";
const other = "22222222-2222-4222-8222-222222222222";
const materialId = "33333333-3333-4333-8333-333333333333";
const topicA = "44444444-4444-4444-8444-444444444444";
const topicB = "55555555-5555-4555-8555-555555555555";
const topicForeign = "66666666-6666-4666-8666-666666666666";
const topicDraft = "77777777-7777-4777-8777-777777777777";
type Row = Record<string, any>;

function memoryDB(role: "admin" | "teacher" | "student" = "admin") {
  const tables: Record<string, Row[]> = {
    materials: [
      { id: materialId, subject_id: own, title: "Розенталь", source_name: "Розенталь",
        status: "draft", is_public: false, material_type: "theory", license_type: "permission_unverified" },
      { id: "88888888-8888-4888-8888-888888888888", subject_id: own,
        title: "Общая теория", source_name: "Pathy", status: "published", is_public: true,
        material_type: "theory" },
    ],
    topics: [
      { id: topicA, subject_id: own, is_public: true },
      { id: topicB, subject_id: own, is_public: true },
      { id: topicForeign, subject_id: other, is_public: true },
      { id: topicDraft, subject_id: own, is_public: false },
    ],
    curriculum_topic_meta: [
      { topic_id: topicA, review_status: "approved" },
      { topic_id: topicB, review_status: "approved" },
      { topic_id: topicForeign, review_status: "approved" },
      { topic_id: topicDraft, review_status: "draft" },
    ],
    material_topic_links: [],
    lessons: [],
    tasks: [],
  };
  let writes = 0;
  const sb = {
    rpc: vi.fn(async (_name: string, args: Row) =>
      ({ data: args._role === role, error: null })),
    from: (name: string) => {
      if (!tables[name]) throw new Error("Unexpected table: " + name);
      const filters: Array<(row: Row) => boolean> = [];
      let limit = Infinity, offset = 0, single = false, count = false;
      let payload: Row | null = null;
      const q: any = {
        select: (_fields?: string, options?: Row) => { count = options?.count === "exact"; return q; },
        eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return q; },
        in: (key: string, values: string[]) => { filters.push(row => values.includes(row[key])); return q; },
        ilike: (key: string, value: string) => {
          const search = value.replace(/%/g, "").toLocaleLowerCase();
          filters.push(row => String(row[key] ?? "").toLocaleLowerCase().includes(search)); return q;
        },
        order: () => q,
        range: (a: number, b: number) => { offset = a; limit = b - a + 1; return q; },
        maybeSingle: () => { single = true; return q; },
        insert: (value: Row) => { payload = value; return q; },
        then: (resolve: (x: Row) => unknown) => {
          if (payload) {
            writes++;
            if (name === "material_topic_links" &&
                tables[name].some(r => r.material_id === payload?.material_id && r.topic_id === payload?.topic_id)) {
              return Promise.resolve(resolve({ data: null, error: { message: "duplicate key" } }));
            }
            tables[name].push(payload);
            return Promise.resolve(resolve({ data: payload, error: null }));
          }
          const matched = tables[name].filter(r => filters.every(filter => filter(r)));
          return Promise.resolve(resolve({
            data: single ? matched[0] ?? null : matched.slice(offset, offset + limit),
            count: count ? matched.length : null,
            error: null,
          }));
        },
      };
      return q;
    },
  };
  return { tables, sb, writes: () => writes };
}

const invoke = (handler: unknown, db: ReturnType<typeof memoryDB>, data: Row) =>
  (handler as (args: unknown) => Promise<any>)({
    data, context: { userId: "isolated-user", supabase: db.sb },
  });

describe("content catalog permissions and explicit topic mapping (isolated)", () => {
  it("rejects teacher/student attempts to read private drafts", async () => {
    for (const role of ["teacher", "student"] as const) {
      const db = memoryDB(role);
      await expect(invoke(getPublishedContentCatalog, db, {
        include_drafts: true, source: "", offset: 0, search: "",
      })).rejects.toThrow();
      expect(db.writes()).toBe(0);
    }
  });
  it("admin sees private drafts only when deliberately requested", async () => {
    const db = memoryDB();
    const options = { offset: 0, search: "", source: "" };
    const visible = await invoke(getPublishedContentCatalog, db, { ...options, include_drafts: false });
    expect(visible.materials).toHaveLength(1);
    expect(visible.materials[0].status).toBe("published");
    const admin = await invoke(getPublishedContentCatalog, db, { ...options, include_drafts: true });
    expect(admin.materials).toHaveLength(2);
    expect(admin.materials.some((m: Row) => m.status === "draft" && m.is_public === false)).toBe(true);
    expect(db.writes()).toBe(0);
  });
  it("rejects teacher, cross-subject topic and unapproved curriculum topic", async () => {
    const teacher = memoryDB("teacher");
    await expect(invoke(linkMaterialToApprovedTopic, teacher, { material_id: materialId, topic_id: topicA })).rejects.toThrow("администратору");
    expect(teacher.writes()).toBe(0);
    const db = memoryDB();
    await expect(invoke(linkMaterialToApprovedTopic, db, { material_id: materialId, topic_id: topicForeign })).rejects.toThrow("другого предмета");
    await expect(invoke(linkMaterialToApprovedTopic, db, { material_id: materialId, topic_id: topicDraft })).rejects.toThrow("утверждённые");
    expect(db.writes()).toBe(0);
  });
  it("safely links two approved topics, repeats idempotently, and never publishes draft", async () => {
    const db = memoryDB();
    const a = await invoke(linkMaterialToApprovedTopic, db, { material_id: materialId, topic_id: topicA });
    const b = await invoke(linkMaterialToApprovedTopic, db, { material_id: materialId, topic_id: topicB });
    const again = await invoke(linkMaterialToApprovedTopic, db, { material_id: materialId, topic_id: topicA });
    expect(a).toEqual({ existing: false, visible_in_lessons: false });
    expect(b).toEqual({ existing: false, visible_in_lessons: false });
    expect(again).toEqual({ existing: true, visible_in_lessons: false });
    expect(db.tables.material_topic_links).toHaveLength(2);
    expect(db.tables.material_topic_links.every(r => r.link_source === "explicit_admin" && r.link_type === "explains")).toBe(true);
    expect(db.tables.materials[0]).toMatchObject({ status: "draft", is_public: false });
    expect(db.tables.lessons).toHaveLength(0);
    expect(db.tables.tasks).toHaveLength(0);
    expect(db.writes()).toBe(2);
  });
});
