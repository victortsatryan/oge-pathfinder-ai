import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireEditor(sb: any, userId: string): Promise<"admin" | "teacher"> {
  const [admin, teacher] = await Promise.all([
    sb.rpc("has_role", { _user_id: userId, _role: "admin" }),
    sb.rpc("has_role", { _user_id: userId, _role: "teacher" }),
  ]);
  if (admin.error || teacher.error) throw new Error("Не удалось проверить роль редактора");
  if (admin.data) return "admin";
  if (teacher.data) return "teacher";
  throw new Error("Редактирование тем доступно только администратору и преподавателю");
}

/** Shared editor for an independent subject/topic curriculum, not an exam-only hierarchy. */
export const getTopicCatalogEditor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const role = await requireEditor(sb, context.userId);
    const [s, t] = await Promise.all([
      sb.from("subjects").select("id,name").order("name").limit(100),
      sb.from("topics").select("id,subject_id,title,description,parent_topic_id,topic_type,is_public,created_by")
        .order("title").limit(1000),
    ]);
    if (s.error) throw new Error(s.error.message);
    if (t.error) throw new Error(t.error.message);
    return { role, subjects: s.data ?? [], topics: t.data ?? [] };
  });

export const createCatalogTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    subject_id: z.string().uuid(),
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().max(2000).nullable().optional(),
    parent_topic_id: z.string().uuid().nullable().optional(),
    topic_type: z.enum(["topic", "section", "subtopic"]).default("topic"),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const role = await requireEditor(sb, context.userId);
    const subject = await sb.from("subjects").select("id").eq("id", data.subject_id).maybeSingle();
    if (subject.error) throw new Error(subject.error.message);
    if (!subject.data) throw new Error("Предмет не найден");
    let parentLevel = 0;
    if (data.parent_topic_id) {
      const parent = await sb.from("topics").select("id,subject_id,level").eq("id", data.parent_topic_id).maybeSingle();
      if (parent.error) throw new Error(parent.error.message);
      if (!parent.data || parent.data.subject_id !== data.subject_id) throw new Error("Родительская тема должна относиться к тому же предмету");
      parentLevel = parent.data.level ?? 1;
    }
    const catalog = await sb.from("topics").select("id,title").eq("subject_id", data.subject_id).limit(1000);
    if (catalog.error) throw new Error(catalog.error.message);
    const normalized = (v: string) => v.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
    const found = (catalog.data ?? []).find((t) => normalized(t.title) === normalized(data.title));
    if (found) return { id: found.id, existing: true, role };
    const ins = await sb.from("topics").insert({
      subject_id: data.subject_id, title: data.title.trim(),
      description: data.description || null,
      parent_topic_id: data.parent_topic_id ?? null,
      topic_type: data.topic_type, level: parentLevel + 1, is_public: true, created_by: context.userId,
    }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    return { id: ins.data.id, existing: false, role };
  });

/** Real published materials catalog. Legacy PCS imports and Python Worker publications share this table. */
export const getPublishedContentCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    subject_id: z.string().uuid().nullable().optional(),
    search: z.string().trim().max(150).default(""),
    offset: z.number().int().min(0).max(100000).default(0),
  }).parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await requireEditor(sb, context.userId);
    let q = sb.from("materials")
      .select("id,title,subject_id,topic_id,material_type,source_name,created_at,extractor_metadata,subjects(name),topics(title)", { count: "exact" })
      .eq("status", "published").eq("is_public", true)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + 49);
    if (data.subject_id) q = q.eq("subject_id", data.subject_id);
    if (data.search) q = q.ilike("title", "%" + data.search.replace(/[%_,]/g, " ").trim() + "%");
    const res = await q;
    if (res.error) throw new Error(res.error.message);
    return {
      count: res.count ?? 0,
      materials: (res.data ?? []).map((m) => ({
        id: m.id, title: m.title, subject_id: m.subject_id, topic_id: m.topic_id,
        material_type: m.material_type, source_name: m.source_name,
        subject_name: (m.subjects as any)?.name ?? null,
        topic_title: (m.topics as any)?.title ?? null,
        origin: m.extractor_metadata ? "Python Extractor" : "PCS / редакция",
      })),
    };
  });
