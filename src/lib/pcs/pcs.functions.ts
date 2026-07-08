import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pcsSchema, pcsDiagnosticSchema, detectPcsKind } from "./schema";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Только для администраторов");
}

export const amIContentAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any).rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

export const pcsDashboardCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const tables = [
      "subject_programs", "subjects", "topics", "learning_objectives",
      "materials", "task_patterns", "content_imports",
    ];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const { count } = await sb.from(t).select("*", { count: "exact", head: true });
      counts[t] = count ?? 0;
    }
    const { count: sectionCount } = await sb.from("topics")
      .select("*", { count: "exact", head: true }).eq("topic_type", "section");
    counts.sections = sectionCount ?? 0;
    const { data: lastImport } = await sb.from("content_imports")
      .select("*").order("imported_at", { ascending: false }).limit(1).maybeSingle();
    return { counts, lastImport };
  });

export const pcsPreviewImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ json: z.any() }).parse(i))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const parsed = pcsSchema.safeParse(data.json);
    if (!parsed.success) {
      return {
        ok: false,
        errors: parsed.error.issues.map((i) => ({
          path: i.path.join("."), message: i.message,
        })),
      };
    }
    const p = parsed.data;
    const { data: subject } = await sb.from("subjects").select("id,title:name")
      .or(`pcs_key.eq.${p.subject.key},slug.eq.${p.subject.key}`).maybeSingle();
    const { data: program } = await sb.from("subject_programs").select("id,title")
      .or(`pcs_key.eq.${p.program.key},slug.eq.${p.program.key}`).maybeSingle();

    let loExists = false;
    if (subject) {
      const subtopicKey = p.subtopic?.key ?? p.topic.key;
      const { data: subt } = await sb.from("topics").select("id")
        .eq("subject_id", subject.id).eq("pcs_key", subtopicKey).maybeSingle();
      if (subt) {
        const { data: lo } = await sb.from("learning_objectives").select("id")
          .eq("topic_id", subt.id).eq("pcs_key", p.learning_objective.key).maybeSingle();
        loExists = Boolean(lo);
      }
    }
    return {
      ok: true,
      summary: {
        program: p.program.title,
        subject: p.subject.title,
        section: p.section.title,
        topic: p.topic.title,
        subtopic: p.subtopic?.title ?? null,
        learning_objective: p.learning_objective.title,
        materials: p.materials?.length ?? 0,
        task_patterns: p.task_patterns.length,
        examples: p.examples?.length ?? 0,
        sources: p.sources?.length ?? 0,
        pcs_version: p.pcs_version,
        schema_version: p.schema_version,
      },
      resolved: {
        subject_exists: Boolean(subject),
        program_exists: Boolean(program),
        lo_exists: loExists,
      },
    };
  });

export const pcsRunImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    json: z.any(),
    filename: z.string().optional(),
    mode: z.enum(["update", "new_version", "skip"]).default("update"),
  }).parse(i))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const parsed = pcsSchema.safeParse(data.json);
    if (!parsed.success) {
      await sb.from("content_imports").insert({
        filename: data.filename, imported_by: context.userId,
        pcs_version: null, status: "failed", rows_failed: 1,
        error_log: parsed.error.issues as any,
      });
      throw new Error("PCS JSON: " + parsed.error.issues.map((i) => i.message).join("; "));
    }
    const { data: rpc, error } = await sb.rpc("pcs_import", {
      payload: parsed.data as any, mode: data.mode,
    });
    if (error) {
      await sb.from("content_imports").insert({
        filename: data.filename, imported_by: context.userId,
        pcs_version: parsed.data.pcs_version, status: "failed", rows_failed: 1,
        error_log: { message: error.message } as any,
      });
      throw new Error(error.message);
    }
    const created = rpc?.created ?? 0;
    const updated = rpc?.updated ?? 0;
    await sb.from("content_imports").insert({
      filename: data.filename, imported_by: context.userId,
      pcs_version: parsed.data.pcs_version, status: "success",
      rows_created: created, rows_updated: updated,
      summary: rpc as any,
    });
    return { ok: true, result: rpc };
  });

export const pcsListImports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { data, error } = await sb.from("content_imports")
      .select("*").order("imported_at", { ascending: false }).limit(50);
    if (error) throw error;
    return { logs: data ?? [] };
  });

export const pcsProgramTree = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const [{ data: subjects }, { data: topics }, { data: los }] = await Promise.all([
      sb.from("subjects").select("id,name,slug").order("name"),
      sb.from("topics").select("id,subject_id,title,topic_type,parent_topic_id,sort_order").order("sort_order"),
      sb.from("learning_objectives").select("id,topic_id,title,status,version").order("sort_order"),
    ]);
    return { subjects: subjects ?? [], topics: topics ?? [], learning_objectives: los ?? [] };
  });

export const pcsGetLearningObjective = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const [{ data: lo }, { data: examples }, { data: patterns }, { data: sources }, { data: diag }] = await Promise.all([
      sb.from("learning_objectives").select("*").eq("id", data.id).maybeSingle(),
      sb.from("lo_examples").select("*").eq("learning_objective_id", data.id).order("order_index"),
      sb.from("task_patterns").select("*").eq("learning_objective_id", data.id).order("order_index"),
      sb.from("lo_sources").select("*").eq("learning_objective_id", data.id).order("order_index"),
      sb.from("lo_diagnostic_settings").select("*").eq("learning_objective_id", data.id).maybeSingle(),
    ]);
    if (!lo) throw new Error("Не найдено");
    return { lo, examples: examples ?? [], patterns: patterns ?? [], sources: sources ?? [], diagnostic: diag };
  });

export const pcsListLearningObjectives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await assertAdmin(sb, context.userId);
    const { data, error } = await sb.from("learning_objectives")
      .select("id,title,status,version,pcs_key,topic:topics(id,title,subject_id,subject:subjects(name))")
      .order("updated_at", { ascending: false }).limit(500);
    if (error) throw error;
    return { items: data ?? [] };
  });
