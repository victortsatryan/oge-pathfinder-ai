import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { unitSchema, sourceSha, canonicalJson } from "@/lib/extractor/schema";
import { kindToMaterial } from "@/lib/extractor/book-mapping";

const batch = z.object({ units: z.array(z.unknown()).min(1).max(20), confirmed: z.literal(true) });

export const importBookBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => batch.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const role = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("Для импорта нужна действующая сессия admin.");
    const subject = await sb.from("subjects").select("id").eq("name", "Русский язык").single();
    if (subject.error) throw new Error(subject.error.message);
    const reports: Array<{ unit_id: string; status: string; error?: string }> = [];
    for (const raw of data.units) {
      const parsed = unitSchema.safeParse(raw);
      if (!parsed.success) {
        reports.push({ unit_id: String((raw as any)?.unit_id || ""), status: "failed", error: "Неверный формат элемента" });
        continue;
      }
      const u = parsed.data;
      const query = () => sb.from("materials").select("id,extractor_metadata").eq("extractor_metadata->>unit_id", u.unit_id).maybeSingle();
      const prior = await query();
      if (prior.error) throw new Error(prior.error.message);
      if (prior.data) {
        const old = prior.data.extractor_metadata;
        const matches = old?.source_sha256 === sourceSha(u) &&
          canonicalJson(old?.original_unit) === canonicalJson(raw);
        reports.push({ unit_id: u.unit_id, status: matches ? "existing" : "failed",
          error: matches ? undefined : "Конфликт с существующим ID; данные не изменены" });
        continue;
      }
      // Never invent an author: only an explicit source.author is recorded.
      const author = typeof u.source.author === "string" && u.source.author.trim() ? u.source.author.trim() : null;
      const row = {
        subject_id: subject.data.id, title: u.title.slice(0, 500), content_text: u.content_text,
        material_type: kindToMaterial(u.kind), source_name: author,
        license_note: "Автор: " + (author ?? "не указан") + "; стр. " + u.pages.join(", ") +
          "; публичные права на воспроизведение не подтверждены",
        license_type: "permission_unverified", status: "draft", is_public: false,
        created_by: context.userId,
        extractor_metadata: {
          unit_id: u.unit_id, source_sha256: sourceSha(u), pages: u.pages,
          review_status: u.review_status, kind: u.kind, original_unit: raw,
        },
      };
      const inserted = await sb.from("materials").insert(row);
      reports.push({ unit_id: u.unit_id, status: inserted.error ? "failed" : "created",
        error: inserted.error?.message });
    }
    return { reports };
  });
