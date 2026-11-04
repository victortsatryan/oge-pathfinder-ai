import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  getExtractorJobs, publishExtractorJob, refreshExtractorJob, registerExtractorUpload,
  getExtractorSourceLink, reopenSkippedUnits, retryExtractorJob, saveExtractorUnitReview, setExtractorUnitDecision,
} from "@/lib/extractor/jobs.functions";
import { MAX_SOURCE_BYTES, SOURCE_EXTENSIONS, sourceExtension } from "@/lib/extractor/pipeline";

export const Route = createFileRoute("/_authenticated/admin/content/upload")({
  head: () => ({ meta: [
    { title: "Загрузка источника — Pathy Studio" },
    { name: "description", content: "Загрузка учебника или пособия для автоматического разбора в Pathy." },
    { property: "og:title", content: "Загрузка источника — Pathy Studio" },
    { property: "og:description", content: "Автоматический разбор источников для Pathy." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: UploadPage,
});

const STATUS: Record<string, string> = {
  uploaded: "Загружен", worker_not_configured: "Обработчик не подключён", queued: "В очереди",
  processing: "Обрабатывается", fetching_result: "Получение результата", succeeded: "Готов к проверке", failed: "Ошибка", publishing: "Публикуется", published: "Опубликован",
};

/** Resumable (TUS) upload in 6 MB chunks — needed for 100+ MB sources. */
async function resumableUpload(file: File, path: string, onProgress: (p: number) => void) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Нет сессии");
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  await new Promise<void>((resolve, reject) => {
    const up = new tus.Upload(file, {
      endpoint: `${base}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string, "x-upsert": "false" },
      uploadDataDuringCreation: true, removeFingerprintOnSuccess: true, chunkSize: 6 * 1024 * 1024,
      metadata: { bucketName: "extractor-sources", objectName: path, contentType: file.type || "application/octet-stream", cacheControl: "3600" },
      onError: (e) => (/already exists|409/i.test(String(e)) ? resolve() : reject(e)),
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    up.findPreviousUploads().then((prev) => { if (prev.length) up.resumeFromPreviousUpload(prev[0]); up.start(); });
  });
}

async function sha256(file: File) {
  const d = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function UploadPage() {
  const qc = useQueryClient();
  const list = useServerFn(getExtractorJobs);
  const register = useServerFn(registerExtractorUpload);
  const retry = useServerFn(retryExtractorJob);
  const [file, setFile] = useState<File | null>(null);
  const [author, setAuthor] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [upPct, setUpPct] = useState(0);
  const jobs = useQuery({ queryKey: ["extractor-jobs"], queryFn: () => list(), refetchInterval: 8000 });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Выберите файл");
      if (!sourceExtension(file.name)) throw new Error("Поддерживаются: " + SOURCE_EXTENSIONS.join(", "));
      if (file.size > MAX_SOURCE_BYTES) throw new Error("Файл больше 160 MB");
      const sha = await sha256(file);
      const path = `${sha}/${file.name.replace(/[^\w.\-]+/g, "_")}`;
      setUpPct(0);
      await resumableUpload(file, path, setUpPct);
      return register({ data: { storage_path: path, file_sha256: sha, file_name: file.name, mime_type: file.type || null, subject_id: subjectId || null, author: author.trim() || null } });
    },
    onSuccess: (r) => {
      toast.success(r.duplicate ? "Этот файл уже загружен — открыта существующая обработка" : "Файл загружен");
      setOpenId(r.id); setFile(null);
      qc.invalidateQueries({ queryKey: ["extractor-jobs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка загрузки"),
  });

  const data = jobs.data;
  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-5 space-y-4">
        <h2 className="text-lg font-semibold">Загрузить источник</h2>
        <p className="text-sm text-muted-foreground">PDF, DOCX, TXT, MD, XLSX, CSV, PNG или JPEG до 160 MB. Файл разбирается обработчиком Pathy Content Extractor; уверенные блоки публикуются без ручной проверки, сомнительные — показываются отдельно.</p>
        {data && !data.workerConfigured && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            Обработчик не подключён. Файлы сохраняются, но разбор не запускается, пока в настройках проекта не заданы адрес и ключ обработчика.
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <Input type="file" accept={SOURCE_EXTENSIONS.map((e) => "." + e).join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Input placeholder="Автор (если известен)" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Предмет — выбрать позже</option>
            {data?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>{upload.isPending ? `Загрузка… ${upPct}%` : "Загрузить и разобрать"}</Button>
        {upload.isPending && <Progress value={upPct} />}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Обработки</h2>
        {jobs.isError && <p className="text-sm text-destructive">{String(jobs.error)}</p>}
        {data?.jobs.length === 0 && <p className="text-sm text-muted-foreground">Пока ничего не загружено.</p>}
        {data?.jobs.map((j) => (
          <div key={j.id} className="rounded-md border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{j.file_name}</span>
              <Badge variant={j.status === "failed" || j.status === "worker_not_configured" ? "destructive" : "secondary"}>{STATUS[j.status] ?? j.status}</Badge>
              <span className="text-xs text-muted-foreground">SHA {j.file_sha256.slice(0, 12)} · {(j.size_bytes / 1024).toFixed(0)} KB · автор: {j.author ?? "не указан"}</span>
              <div className="ml-auto flex gap-2">
                {["failed", "worker_not_configured"].includes(j.status) && (
                  <Button size="sm" variant="outline" onClick={async () => { try { await retry({ data: { id: j.id } }); qc.invalidateQueries({ queryKey: ["extractor-jobs"] }); } catch (e) { toast.error(String(e)); } }}>Повторить</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setOpenId(openId === j.id ? null : j.id)}>{openId === j.id ? "Скрыть" : "Открыть"}</Button>
              </div>
            </div>
            {["queued", "processing", "fetching_result"].includes(j.status) && <><Progress value={j.progress} /><span className="text-xs text-muted-foreground">Этап: {j.stage ?? "—"}{j.result_total_units ? ` · блоков: ${j.result_total_units}` : ""}</span></>}
            {j.error && <p className="text-xs text-destructive">{j.error}</p>}
            {openId === j.id && <JobDetail id={j.id} subjects={data.subjects} defaultSubject={j.subject_id} />}
          </div>
        ))}
      </section>
    </div>
  );
}

function JobDetail({ id, subjects, defaultSubject }: { id: string; subjects: { id: string; name: string }[]; defaultSubject: string | null }) {
  const qc = useQueryClient();
  const refresh = useServerFn(refreshExtractorJob);
  const decide = useServerFn(setExtractorUnitDecision);
  const publish = useServerFn(publishExtractorJob);
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [rights, setRights] = useState<"unknown" | "own" | "licensed" | "public_domain">("unknown");
  const q = useQuery({
    queryKey: ["extractor-job", id], queryFn: () => refresh({ data: { id } }),
    refetchInterval: (query) => ["queued", "processing", "fetching_result"].includes(query.state.data?.job.status ?? "") ? 5000 : false,
  });
  const reopen = useServerFn(reopenSkippedUnits);
  const [pubPct, setPubPct] = useState<string | null>(null);
  const pub = useMutation({
    mutationFn: async () => {
      if (q.data?.job.status === "published") await reopen({ data: { id } });
      let r = await publish({ data: { id, subject_id: subject, rights_basis: rights, confirmed: true } });
      while (r.remaining > 0) {
        setPubPct(`осталось ${r.remaining}`);
        r = await publish({ data: { id, subject_id: subject, rights_basis: rights, confirmed: true } });
      }
      setPubPct(null);
      return r.total;
    },
    onSuccess: (t) => { toast.success(`Материалов: ${t.materials}, уже было: ${t.existing}, пропущено: ${t.skipped}, ошибок: ${t.failed}`); qc.invalidateQueries({ queryKey: ["extractor-jobs"] }); q.refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка публикации"),
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">{String(q.error)}</p>;
  const { units, job } = q.data;
  if (!units.length || !["succeeded", "publishing", "published"].includes(job.status)) return <p className="text-sm text-muted-foreground">Результат разбора ещё не получен полностью{units.length ? ` (получено блоков: ${units.length})` : ""}.</p>;
  const review = units.filter((u) => u.decision === "review");
  const toPublish = units.filter((u) => u.publish).length;
  const setD = async (unit_id: string, decision: "accept" | "reject" | null) => { await decide({ data: { id, unit_id, decision } }); q.refetch(); };

  return (
    <div className="space-y-3 border-t pt-3">
      <p className="text-sm">Блоков: {units.length} · уверенных: {units.filter((u) => u.decision === "confident").length} · требуют решения: {review.length} · только для учителя (не публикуются): {units.filter((u) => u.decision === "private").length} · некорректных: {units.filter((u) => u.decision === "invalid").length} · к публикации: {toPublish}. Задания с автопроверкой не создаются: экстрактор не даёт проверенных ответов.</p>
      {review.length > 0 && <h3 className="text-sm font-semibold">Требуют решения</h3>}
      {units.filter((u) => u.decision === "review" || u.decision === "invalid").map((u) => (
        u.decision === "review"
          ? <UnitReview key={u.unit_id} jobId={id} unit={u} onSaved={() => q.refetch()} />
          : (
            <div key={u.unit_id} className="rounded border p-2 text-sm space-y-1">
              <span className="font-medium">{u.title || u.unit_id}</span>
              <ul className="text-xs text-destructive list-disc pl-4">{u.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          )
      ))}
      <details className="text-sm"><summary className="cursor-pointer">Уверенные блоки ({units.filter((u) => u.decision === "confident").length})</summary>
        {units.filter((u) => u.decision === "confident").map((u) => (
          <div key={u.unit_id} className="flex items-center gap-2 py-1">
            <span className={u.admin === "reject" ? "line-through text-muted-foreground" : ""}>{u.title}</span>
            {u.state !== "pending" && <Badge variant="secondary">{u.state}</Badge>}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setD(u.unit_id, u.admin === "reject" ? null : "reject")}>{u.admin === "reject" ? "Вернуть" : "Исключить"}</Button>
          </div>
        ))}
      </details>
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">Предмет</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={rights} onChange={(e) => setRights(e.target.value as typeof rights)}>
          <option value="unknown">Права не подтверждены</option><option value="own">Собственный материал</option>
          <option value="licensed">Есть лицензия/разрешение</option><option value="public_domain">Общественное достояние</option>
        </select>
        <Button disabled={!subject || rights === "unknown" || toPublish === 0 || pub.isPending} onClick={() => pub.mutate()}>
          {pub.isPending ? `Публикация… ${pubPct ?? ""}` : job.status === "published" ? "Дополнить публикацию" : `Опубликовать для пользователей Pathy (${toPublish})`}
        </Button>
        <span className="text-xs text-muted-foreground">Видно только вошедшим пользователям Pathy. Существующие материалы и задания не изменяются.</span>
      </div>
    </div>
  );
}

type ReviewUnit = { unit_id: string; title: string; pages: number[]; reasons: string[]; content_text: string; reviewed_text: string | null; review_choice: string | null; reviewed_at: string | null; state: string };

/** Built-in review: full raw OCR (read-only) beside an editable correction. Raw unit is never changed. */
function UnitReview({ jobId, unit, onSaved }: { jobId: string; unit: ReviewUnit; onSaved: () => void }) {
  const save = useServerFn(saveExtractorUnitReview);
  const link = useServerFn(getExtractorSourceLink);
  const [text, setText] = useState(unit.reviewed_text ?? unit.content_text);
  const [busy, setBusy] = useState(false);
  const locked = unit.state === "published";
  const changed = text.trim() !== unit.content_text.trim();
  const act = async (choice: "accept_corrected" | "keep_original" | "reject" | null) => {
    setBusy(true);
    try {
      await save({ data: { id: jobId, unit_id: unit.unit_id, choice, reviewed_text: choice === "accept_corrected" || (choice === null && changed) ? text : null } });
      toast.success("Решение сохранено"); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Ошибка"); } finally { setBusy(false); }
  };
  const open = async (page: number | null) => {
    const w = window.open("about:blank", "_blank"); if (w) w.opener = null;
    try { const r = await link({ data: { id: jobId, page } }); if (w) w.location.href = r.url; }
    catch (e) { w?.close(); toast.error(e instanceof Error ? e.message : "Ошибка"); }
  };
  const CHOICE: Record<string, string> = { accept_corrected: "Принято исправленное", keep_original: "Оставлен исходный", reject: "Отклонено" };
  return (
    <div className="rounded border p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{unit.title || unit.unit_id}</span>
        <span className="text-xs text-muted-foreground">ID {unit.unit_id} · стр. {unit.pages.join(", ") || "—"}</span>
        {unit.review_choice && <Badge variant="secondary">{CHOICE[unit.review_choice]}{unit.reviewed_at ? " · " + new Date(unit.reviewed_at).toLocaleString("ru-RU") : ""}</Badge>}
        {locked && <Badge>Опубликован</Badge>}
        <div className="ml-auto flex flex-wrap gap-1">
          {(unit.pages.length ? unit.pages : [null]).slice(0, 4).map((p) => (
            <Button key={String(p)} size="sm" variant="outline" onClick={() => open(p)}>{p ? `Открыть оригинал, стр. ${p}` : "Открыть оригинал"}</Button>
          ))}
        </div>
      </div>
      <ul className="text-xs text-destructive list-disc pl-4">{unit.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Исходный OCR (не изменяется)</span>
          <textarea readOnly className="h-64 w-full rounded-md border bg-muted/40 p-2 font-mono text-xs" value={unit.content_text} /></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Исправленный текст {changed ? "· изменён" : "· совпадает с исходным"}</span>
          <textarea disabled={locked} className="h-64 w-full rounded-md border bg-background p-2 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} /></label>
      </div>
      {!locked && (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" disabled={busy || !changed || !text.trim()} onClick={() => act("accept_corrected")}>Принять исправленное</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("keep_original")}>Оставить исходный</Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => act("reject")}>Отклонить</Button>
          <Button size="sm" variant="ghost" disabled={busy || !changed} onClick={() => act(null)}>Сохранить черновик правки</Button>
          {unit.review_choice && <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(null)}>Снять решение</Button>}
        </div>
      )}
    </div>
  );
}
