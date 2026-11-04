import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { amIContentAdmin } from "@/lib/pcs/pcs.functions";
import { getExtractorOverview, importExtractorBatch, inspectExtractorDraft, previewExtractorBatch } from "@/lib/extractor/extractor.functions";
import { EXTRACTOR_FORMAT, inspectFile, splitBatches, type UnitReport } from "@/lib/extractor/schema";

export const Route = createFileRoute("/_authenticated/admin/content/extractor")({
  head: () => ({ meta: [
    { title: "Extractor: черновики — Pathy Studio" },
    { name: "description", content: "Закрытая проверка исходных черновиков Pathy Extractor, прав источников и ручных OCR решений." },
    { property: "og:title", content: "Extractor: черновики — Pathy Studio" },
    { property: "og:description", content: "Администраторская проверка и безопасное хранение черновиков Extractor." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ExtractorAccess,
});
function ExtractorAccess() {
  const check = useServerFn(amIContentAdmin);
  const access = useQuery({ queryKey: ["extractor-admin"], queryFn: () => check(), retry: false });
  if (access.isPending) return <p>Проверка доступа…</p>;
  if (access.error || !access.data?.isAdmin) return <p role="alert">Доступ только администратору.</p>;
  return <ExtractorPage />;
}
function ExtractorPage() {
  const overviewFn = useServerFn(getExtractorOverview);
  const previewFn = useServerFn(previewExtractorBatch);
  const importFn = useServerFn(importExtractorBatch);
  const detailFn = useServerFn(inspectExtractorDraft);
  const [page, setPage] = useState(0);
  const overview = useQuery({ queryKey: ["extractor-overview", page], queryFn: () => overviewFn({ data: { page } }), retry: false });
  const [units, setUnits] = useState<unknown[]>([]);
  const [reports, setReports] = useState<UnitReport[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [imported, setImported] = useState(false);
  const [filter, setFilter] = useState("");
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof inspectExtractorDraft>> | null>(null);
  async function load(file: File) {
    setBusy(true); setReady(false); setConfirmed(false); setImported(false); setErrors([]); setReports([]); setUnits([]); setFilename(file.name);
    try {
      const checked = inspectFile(JSON.parse(await file.text()));
      setUnits(checked.units); setReports(checked.reports); setErrors(checked.errors);
      if (checked.errors.length) return;
      const next = [...checked.reports];
      const valid = checked.reports.filter((r) => r.status !== "failed");
      for (const batch of splitBatches(valid, checked.units)) {
        try {
          const result = await previewFn({ data: { format: EXTRACTOR_FORMAT, units: batch.map((r) => checked.units[r.index]) } });
          result.reports.forEach((r, i) => { next[batch[i].index] = { ...r, index: batch[i].index }; });
        } catch (e) {
          batch.forEach((r) => { next[r.index] = { ...r, status: "failed", reasons: [String(e)] }; });
        }
        setReports([...next]);
      }
      setReady(true);
    } catch (e) { setErrors([`JSON не прочитан: ${String(e)}`]); }
    finally { setBusy(false); }
  }
  async function run() {
    if (!confirmed || !ready || busy) return;
    setBusy(true); setReady(false);
    const next = [...reports];
    const candidates = reports.filter((r) => r.status === "new");
    for (const batch of splitBatches(candidates, units)) {
      try {
        const result = await importFn({ data: { format: EXTRACTOR_FORMAT, confirmed: true, units: batch.map((r) => units[r.index]) } });
        result.reports.forEach((r, i) => { next[batch[i].index] = { ...r, index: batch[i].index }; });
      } catch (e) {
        batch.forEach((r) => { next[r.index] = { ...r, status: "failed", reasons: [`Пакет не подтверждён: ${String(e)}. Повторный предпросмотр определит сохранённые записи.`] }; });
      }
      setReports([...next]);
    }
    setBusy(false); setImported(true); setConfirmed(false); await overview.refetch();
  }
  const count = (status: UnitReport["status"]) => reports.filter((r) => r.status === status).length;
  const data = overview.data;
  return <div className="space-y-8 min-w-0">
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Extractor: черновики</h2>
      <p className="text-sm text-muted-foreground">Исходный текст · закрыто для учеников · без публикации. Ручные OCR решения не применены автоматически к этим черновикам.</p>
      <Input aria-label="JSON Extractor" type="file" accept=".json,application/json" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void load(f); }} />
      {filename && <p className="text-sm break-all">{filename} · {units.length} units · {busy ? "Обработка…" : imported ? "Отчёт импорта" : "Предпросмотр"}</p>}
      {errors.map((e, i) => <p role="alert" className="text-destructive break-words" key={i}>{e}</p>)}
      {reports.length > 0 && <>
        <p>new: {count("new")} · existing: {count("existing")} · failed: {count("failed")} · duplicates: {reports.filter((r) => r.reasons.some((s) => s.includes("Повтор unit_id"))).length}</p>
        <div className="flex items-center gap-3"><Checkbox id="extractor-confirm" checked={confirmed} disabled={busy || imported} onCheckedChange={(v) => setConfirmed(v === true)} /><label htmlFor="extractor-confirm" className="text-sm">Подтверждаю поштучное сохранение валидных units только в закрытые черновики; ошибки остаются в отчёте.</label></div>
        <Button disabled={!ready || !confirmed || busy || count("new") === 0} onClick={() => void run()}>Сохранить закрытые черновики ({count("new")})</Button>
        <div className="flex flex-wrap gap-2">{["", ...new Set(units.map((u) => u && typeof u === "object" && "kind" in u ? String(u.kind) : "без kind"))].map((k) => <Button key={k} variant={filter === k ? "default" : "outline"} size="sm" onClick={() => setFilter(k)}>{k || "Все"}</Button>)}</div>
        <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
          {reports.filter((r) => !filter || (units[r.index] as Record<string, unknown>)?.kind === filter).map((r) => {
            const u = units[r.index] as Record<string, unknown> | null;
            return <details key={r.index} className="py-3 text-sm"><summary className="cursor-pointer break-words">{r.index + 1}. {r.unit_id} · {String(u?.kind ?? "—")} · {String(u?.title ?? "Без названия")} · {r.status}</summary>
              <div className="space-y-2 py-3">{r.reasons.map((s, i) => <p className="text-destructive break-words" key={i}>{s}</p>)}{r.warnings.map((s, i) => <p key={i}>{s}</p>)}
                <p>Страницы: {JSON.stringify(u?.pages)} · review_status: {String(u?.review_status ?? "—")}</p>
                <pre className="whitespace-pre-wrap break-all bg-muted p-3">Источник: {JSON.stringify(u?.source, null, 2)}{"\n"}Права: {JSON.stringify(u?.rights, null, 2)}</pre>
                <pre className="whitespace-pre-wrap break-words">{String(u?.content_text ?? "Нет content_text")}</pre>
                <details><summary>Исходный unit целиком</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(u, null, 2)}</pre></details>
              </div></details>;
          })}
        </div>
      </>}
    </section>
    {overview.error && <p role="alert" className="text-destructive">Данные не загружены: {String(overview.error)}</p>}
    {data && <>
      <section className="space-y-3"><h3 className="text-lg font-semibold">Сохранённые исходные черновики · {data.draftCount}</h3>
        {data.drafts.length === 0 && <p className="text-muted-foreground">На этой странице черновиков нет.</p>}
        {data.drafts.map((d) => <div key={d.unit_id} className="border-b border-border py-3 flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1 break-words">{d.title} · {d.kind} · draft · непубличный<br /><span className="text-xs text-muted-foreground break-all">{d.unit_id} · {d.source_sha256} · {JSON.stringify(d.source_pages)}</span></span><Button variant="outline" size="sm" onClick={async () => { try { setDetail(await detailFn({ data: { unit_id: d.unit_id } })); } catch (e) { setErrors([String(e)]); } }}>Исходник и связи</Button></div>)}
        {detail && <div className="space-y-3 border-y border-border py-4"><h4 className="font-semibold">{detail.draft.title}</h4><p>{detail.links.note}</p><p>topics: {detail.links.topic ? `${detail.links.topic.title} (${detail.links.topic.id})` : "Связь отсутствует"}</p><p>tasks: {detail.links.task ? `${detail.links.task.task_key} (${detail.links.task.id}); topic_id: ${detail.links.task.topic_id ?? "нет"}` : "Связь отсутствует"}</p><p>teacher_assignments: {detail.links.assignments.length ? JSON.stringify(detail.links.assignments) : "Связь отсутствует"}</p><pre className="max-h-[500px] overflow-auto whitespace-pre-wrap break-all bg-muted p-3 text-xs">{JSON.stringify(detail.draft.payload, null, 2)}</pre><Button variant="outline" size="sm" onClick={() => setDetail(null)}>Закрыть</Button></div>}
      </section>
      <section className="space-y-3"><h3 className="text-lg font-semibold">Источники и права · {data.sources.length}</h3>{data.sources.map((s) => <div key={s.id} className="border-b border-border py-3 text-sm"><p className="font-medium">{s.title} · {s.is_approved ? "Источник одобрен" : "Источник не одобрен"}</p><p>{s.license_note || "Права на копирование неизвестны"}</p><p className="text-muted-foreground">Одобрение источника не означает разрешение на публикацию черновика.</p></div>)}</section>
      <section className="space-y-3"><h3 className="text-lg font-semibold">Ручные OCR решения · {data.decisionCount}</h3><p className="text-sm">text_layer: {data.choices.text_layer} · ocr: {data.choices.ocr} · custom: {data.choices.custom} · unresolved: {data.choices.unresolved}</p><p className="text-sm text-muted-foreground">Сохранённый выбор, не подтверждение исправления исходного текста. Сопоставление требует source SHA, anchor SHA и queue revision.</p><div className="max-h-[400px] overflow-y-auto">{data.decisions.map((d) => <details key={`${d.source_sha256}:${d.decision_id}`} className="border-b border-border py-2 text-sm"><summary className="break-all cursor-pointer">{d.decision_id} · {d.choice}</summary><pre className="whitespace-pre-wrap break-all text-xs py-2">{JSON.stringify(d, null, 2)}</pre></details>)}</div></section>
      <div className="flex gap-3 items-center"><Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Назад</Button><span>Страница {page + 1} · по 50 записей</span><Button variant="outline" disabled={(page + 1) * 50 >= Math.max(data.draftCount, data.decisionCount)} onClick={() => setPage((p) => p + 1)}>Далее</Button></div>
    </>}
  </div>;
}