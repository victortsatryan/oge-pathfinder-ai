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
  getExtractorSourceLink, getPublishedExtractorMaterials, addPublishedExtractorMaterialTopicLinks,
  reopenSkippedUnits, reprocessExtractorJob, retryExtractorJob, saveExtractorUnitReview,
  publishApprovedExtractorCorrections,
  setExtractorUnitDecision, setPublishedExtractorMaterialsTopic,
} from "@/lib/extractor/jobs.functions";
import { MAX_SOURCE_BYTES, SOURCE_EXTENSIONS, sourceExtension } from "@/lib/extractor/pipeline";
import { applySourceTopicSections, previewSourceTopicSections } from "@/lib/extractor/source-section.functions";

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
  const reprocess = useServerFn(reprocessExtractorJob);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const startReprocess = async (id: string) => {
    if (!window.confirm("Создать новую версию обработки этого источника исправленным OCR-корректором?\n\nИсходная обработка и уже опубликованные материалы не изменяются. Новая версия не публикуется автоматически: машинно исправленный текст не проверен человеком.")) return;
    setReprocessing(id);
    try {
      const r = await reprocess({ data: { id } });
      if (r.status === "failed" || r.status === "worker_not_configured") toast.error(`Версия ${r.revision} создана, но не запущена: ${r.error ?? r.status}`);
      else toast.success(`Версия ${r.revision} отправлена в обработку (${r.worker_rule_version})`);
      setOpenId(r.id);
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
    finally { setReprocessing(null); qc.invalidateQueries({ queryKey: ["extractor-jobs"] }); }
  };
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
              <Badge variant="outline">Версия {j.revision}{j.revision > 1 ? " · повторная обработка" : " · исходная"}</Badge>
              {j.worker_rule_version && <Badge variant="outline">Корректор: {j.worker_rule_version}</Badge>}
              <span className="text-xs text-muted-foreground">SHA {j.file_sha256.slice(0, 12)} · {(j.size_bytes / 1024).toFixed(0)} KB · автор: {j.author ?? "не указан"}</span>
              <div className="ml-auto flex gap-2">
                {(["succeeded", "published"].includes(j.status) || (j.status === "failed" && j.revision > 1)) && (
                  <Button size="sm" variant="outline" disabled={reprocessing !== null} onClick={() => startReprocess(j.id)}>
                    {reprocessing === j.id ? "Проверка обработчика…" : "Повторно обработать новой версией"}
                  </Button>
                )}
                {["failed", "worker_not_configured"].includes(j.status) && (
                  <Button size="sm" variant="outline" onClick={async () => { try { await retry({ data: { id: j.id } }); qc.invalidateQueries({ queryKey: ["extractor-jobs"] }); } catch (e) { toast.error(String(e)); } }}>Повторить</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setOpenId(openId === j.id ? null : j.id)}>{openId === j.id ? "Скрыть" : "Открыть"}</Button>
              </div>
            </div>
            {["queued", "processing", "fetching_result"].includes(j.status) && <><Progress value={j.progress} /><span className="text-xs text-muted-foreground">Этап: {j.stage ?? "—"}{j.result_total_units ? ` · блоков: ${j.result_total_units}` : ""}</span></>}
            {j.error && <p className="text-xs text-destructive">{j.error}</p>}
            {openId === j.id && <JobDetail id={j.id} subjects={data.subjects} topics={data.topics} defaultSubject={j.subject_id} />}
          </div>
        ))}
      </section>
    </div>
  );
}

function JobDetail({ id, subjects, topics, defaultSubject }: { id: string; subjects: { id: string; name: string }[]; topics: { id: string; title: string; subject_id: string }[]; defaultSubject: string | null }) {
  const [topic, setTopic] = useState("");
  const qc = useQueryClient();
  const refresh = useServerFn(refreshExtractorJob);
  const decide = useServerFn(setExtractorUnitDecision);
  const publish = useServerFn(publishExtractorJob);
  const autoSectionsAfterPublish = useServerFn(applySourceTopicSections);
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
      let r = await publish({ data: { id, subject_id: subject, topic_id: topic || null, rights_basis: rights, confirmed: true } });
      while (r.remaining > 0) {
        setPubPct(`осталось ${r.remaining}`);
        r = await publish({ data: { id, subject_id: subject, topic_id: topic || null, rights_basis: rights, confirmed: true } });
      }
      setPubPct(null);
      return r.total;
    },
    onSuccess: async (t) => {
      toast.success(`Материалов: ${t.materials}, уже было: ${t.existing}, пропущено: ${t.skipped}, ошибок: ${t.failed}`);
      qc.invalidateQueries({ queryKey: ["extractor-jobs"] });
      q.refetch();
      // Link only exact matching APPROVED curriculum topics; never create a new
      // topic from a paragraph, footnote or OCR title.
      try {
        let made = 0;
        for (let i = 0; i < 100; i++) {
          const r = await autoSectionsAfterPublish({ data: { job_id: id } });
          made += r.created_materials;
          if (!r.remaining) {
            if (made) toast.success(`Подтверждённых учебных материалов добавлено: ${made}`);
            qc.invalidateQueries({ queryKey: ["published-catalog"] });
            qc.invalidateQueries({ queryKey: ["source-section-preview", id] });
            qc.invalidateQueries({ queryKey: ["topics-editor"] });
            break;
          }
          if (i === 99) throw new Error("Требуется продолжить пакетную обработку разделов");
        }
      } catch (e) {
        toast.warning("Источник опубликован; сопоставление с утверждёнными темами требует проверки: " +
          (e instanceof Error ? e.message : String(e)));
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка публикации"),
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">{String(q.error)}</p>;
  const { units, job } = q.data;
  const isRevision = (job.revision ?? 1) > 1;
  const revisionNote = isRevision && (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-1">
      <p className="font-medium">Повторная обработка · версия {job.revision}{job.worker_rule_version ? ` · корректор ${job.worker_rule_version}` : ""}</p>
      <p>Текст в этой версии исправлен машинно и не проверен человеком. Публикация этой версии запрещена до отдельного аудита и явного решения о замене.</p>
      <p className="text-muted-foreground">Исходная обработка (версия 1) и уже опубликованные материалы не изменяются.</p>
    </div>
  );
  if (!units.length || !["succeeded", "publishing", "published"].includes(job.status)) return <div className="space-y-2 border-t pt-3">{revisionNote}<p className="text-sm text-muted-foreground">Результат разбора ещё не получен полностью{units.length ? ` (получено блоков: ${units.length})` : ""}.</p></div>;
  const review = units.filter((u) => u.decision === "review");
  const toPublish = units.filter((u) => u.publish).length;
  const setD = async (unit_id: string, decision: "accept" | "reject" | null) => { await decide({ data: { id, unit_id, decision } }); q.refetch(); };

  return (
    <div className="space-y-3 border-t pt-3">
      {revisionNote}
      <p className="text-sm">Блоков: {units.length} · уверенных: {units.filter((u) => u.decision === "confident").length} · требуют решения: {review.length} · только для учителя (не публикуются): {units.filter((u) => u.decision === "private").length} · некорректных: {units.filter((u) => u.decision === "invalid").length} · к публикации: {toPublish}. Задания с автопроверкой не создаются: экстрактор не даёт проверенных ответов.</p>
      {review.length > 0 && <h3 className="text-sm font-semibold">Требуют решения</h3>}
      {units.filter((u) => u.decision === "review" || u.decision === "invalid").map((u) => (
        u.decision === "review"
          ? <UnitReview key={u.unit_id} jobId={id} unit={u} isRevision={isRevision}
               canApplyRevision={isRevision && job.worker_rule_version === "pathy-ocr-postcorrection-v2"}
               onSaved={() => q.refetch()} />
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
      {!isRevision && <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={subject} onChange={(e) => { setSubject(e.target.value); setTopic(""); }}>
          <option value="">Предмет</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select aria-label="Тема" className="h-9 max-w-xs rounded-md border bg-background px-2 text-sm" value={topic} disabled={!subject} onChange={(e) => setTopic(e.target.value)}>
          <option value="">Без темы</option>{topics.filter((t) => t.subject_id === subject).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={rights} onChange={(e) => setRights(e.target.value as typeof rights)}>
          <option value="unknown">Права не подтверждены</option><option value="own">Собственный материал</option>
          <option value="licensed">Есть лицензия/разрешение</option><option value="public_domain">Общественное достояние</option>
        </select>
        <Button disabled={!subject || rights === "unknown" || toPublish === 0 || pub.isPending} onClick={() => pub.mutate()}>
          {pub.isPending ? `Публикация… ${pubPct ?? ""}` : job.status === "published" ? "Дополнить публикацию" : `Опубликовать для пользователей Pathy (${toPublish})`}
        </Button>
        <span className="text-xs text-muted-foreground">Видно только вошедшим пользователям Pathy. Существующие материалы и задания не изменяются.</span>
        <p className="w-full text-xs text-muted-foreground">Тема (необязательно) назначается только материалам, публикуемым в этой партии, и только по вашему выбору. Экзаменационные задания, ключи ответов, уроки и события календаря не создаются. Если книга охватывает несколько тем, оставьте «Без темы».</p>
      </div>}
      {job.status === "published" && <SourceTopicSections jobId={id} />}
      {job.status === "published" && <PublishedTopicLinker jobId={id} topics={topics} />}
    </div>
  );
}



/** Conservative source-driven § segmentation. Creates only headings with supporting evidence. */
function SourceTopicSections({ jobId }: { jobId: string }) {
  const previewFn = useServerFn(previewSourceTopicSections);
  const applyFn = useServerFn(applySourceTopicSections);
  const qc = useQueryClient();
  const [progress, setProgress] = useState("");
  const preview = useQuery({ queryKey: ["source-section-preview", jobId], queryFn: () => previewFn({ data: { job_id: jobId } }) });
  const apply = useMutation({
    mutationFn: async () => {
      let totalCreated = 0;
      for (let i = 0; i < 100; i++) {
        const r = await applyFn({ data: { job_id: jobId } });
        totalCreated += r.created_materials;
        setProgress(`Выделено материалов: ${totalCreated}; осталось: ${r.remaining}`);
        if (!r.remaining) return { totalCreated, manual_review: r.manual_review };
      }
      throw new Error("Пакетная обработка не завершена, повторите запуск");
    },
    onSuccess: (result) => {
      setProgress("");
      toast.success(`Параграфов выделено: ${result.totalCreated}; спорных: ${result.manual_review}`);
      qc.invalidateQueries({ queryKey: ["source-section-preview", jobId] });
      qc.invalidateQueries({ queryKey: ["extractor-published-topics", jobId] });
      qc.invalidateQueries({ queryKey: ["published-catalog"] });
      qc.invalidateQueries({ queryKey: ["topics-editor"] });
    },
    onError: (e) => { setProgress(""); toast.error(e instanceof Error ? e.message : "Ошибка разделения источника"); },
  });
  return (
    <section className="rounded-md border p-4 space-y-3">
      <h3 className="font-semibold text-sm">Разделение учебника на темы</h3>
      <p className="text-sm text-muted-foreground">
        Параграфы выделяются из текста по печатным заголовкам, но не становятся учебными темами.
        Автоматическая привязка возможна только к уже утверждённым темам программы при точном совпадении названия.
        Черновики программы, примечания, неоднозначные границы и ошибки OCR остаются на редакционное ревью.
        Исходные OCR-блоки и маршруты не изменяются.
      </p>
      {preview.isError && <p className="text-sm text-destructive">{String(preview.error)}</p>}
      {preview.data && <>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">Найдено: {preview.data.total}</Badge>
          <Badge>Совпало с утверждённой темой: {preview.data.ready}</Badge>
          <Badge variant="outline">На проверку: {preview.data.review}</Badge>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y rounded-md border">
          {preview.data.sections.map((s) => (
            <div key={s.number} className="p-2 text-sm">
              <span className="font-medium">§ {s.number}. {s.title}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {s.topic_id ? (s.imported ? "Материал существует — можно связать с темой" : "Можно связать") :
                  s.match_status === "draft_exact" ? "Совпадает с черновиком — ждёт утверждения" :
                  s.match_status === "ambiguous" ? "Несколько совпадений — ревью" : "Нужна проверка"}
                {" · "}{s.characters} символов
              </span>
              {s.review_reason && <p className="text-xs text-destructive">{s.review_reason}</p>}
            </div>
          ))}
        </div>
        <Button disabled={!preview.data.ready || apply.isPending} onClick={() => apply.mutate()}>
          {apply.isPending ? progress || "Сопоставление…" : "Связать с утверждёнными темами"}
        </Button>
      </>}
    </section>
  );
}

/** Link individual published blocks from a multi-topic book to verified catalog topics. */
function PublishedTopicLinker({ jobId, topics }: {
  jobId: string;
  topics: { id: string; title: string; subject_id: string }[];
}) {
  const query = useServerFn(getPublishedExtractorMaterials);
  const save = useServerFn(addPublishedExtractorMaterialTopicLinks);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["extractor-published-topics", jobId],
    queryFn: () => query({ data: { job_id: jobId } }),
  });
  const mutation = useMutation({
    mutationFn: (topicId: string) =>
      save({ data: { job_id: jobId, material_ids: selected, topic_id: topicId } }),
    onSuccess: (result) => {
      toast.success(`Созданы тематические связи для ${result.linked} материалов`);
      setSelected([]);
      q.refetch();
      qc.invalidateQueries({ queryKey: ["extractor-jobs"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Ошибка назначения темы"),
  });
  const materials = q.data?.materials ?? [];
  const shown = materials.filter((m) =>
    (m.title + " " + m.preview).toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru").trim()),
  );
  const eligibleVisible = shown.filter((m) => !m.needs_content_review).slice(0, 25);
  const allowedTopics = topics.filter((t) => t.subject_id === q.data?.subject_id);

  return (
    <section className="space-y-3 rounded-md border p-3">
      <h3 className="font-semibold text-sm">Привязка опубликованных материалов к темам</h3>
      <p className="text-xs text-muted-foreground">
        Книга может охватывать много тем. Выделяйте только относящиеся к выбранной теме блоки.
        К одному материалу можно добавить несколько тем. После назначения материалы появятся в тематической библиотеке и будут подбираться в уроки
        этого предмета. Никаких экзаменационных ответов и оценочных заданий не создаётся.
      </p>
      {q.isLoading && <p className="text-sm">Загрузка опубликованных материалов…</p>}
      {q.isError && <p className="text-sm text-destructive">{String(q.error)}</p>}
      {q.data && <>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Опубликовано: {materials.length}</Badge>
          <Badge variant="secondary">С темой: {materials.filter((m) => m.topic_ids.length > 0).length}</Badge>
          <Badge variant="outline">Требуют просмотра: {materials.filter((m) => m.needs_content_review).length}</Badge>
        </div>
        <Input placeholder="Поиск по названию или тексту" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setSelected(eligibleVisible.map((m) => m.id))}>
            Выделить до 25 подходящих из списка
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Снять выделение</Button>
          <span className="text-xs text-muted-foreground">Выбрано: {selected.length} / 25</span>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-2">
          {shown.map((m) => (
            <label key={m.id} className="flex items-start gap-2 border-b pb-2 text-sm">
              <input aria-label={`Выбрать ${m.title}`} type="checkbox"
                className="mt-1" checked={selected.includes(m.id)}
                disabled={mutation.isPending || (!selected.includes(m.id) && selected.length >= 25)}
                onChange={(e) => setSelected((current) =>
                  e.target.checked ? [...current, m.id] : current.filter((id) => id !== m.id))} />
              <span className="min-w-0 flex-1">
                <span className="font-medium break-words">{m.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {m.material_type} · {m.characters} символов
                  {m.topic_ids.length ? " · " + m.topic_ids.map((id) => allowedTopics.find((t) => t.id === id)?.title ?? "Тема").join(", ") : " · Без темы"}
                </span>
                {m.needs_content_review && <span className="block text-xs text-destructive">Короткий/сомнительный фрагмент — проверьте перед привязкой</span>}
                <span className="block truncate text-xs text-muted-foreground">{m.preview}</span>
              </span>
            </label>
          ))}
          {!shown.length && <p className="text-sm text-muted-foreground">Ничего не найдено.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Тема для выбранных материалов" className="h-9 min-w-48 rounded-md border bg-background px-2 text-sm"
            value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Выберите тему</option>
            {allowedTopics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <Button size="sm" disabled={!selected.length || !target || mutation.isPending} onClick={() => mutation.mutate(target)}>
            Добавить тематическую связь
          </Button>
        </div>
      </>}
    </section>
  );
}

type ReviewUnit = { unit_id: string; title: string; pages: number[]; reasons: string[]; content_text: string; reviewed_text: string | null; review_choice: string | null; reviewed_at: string | null; state: string;
  original_content_text?: string | null; machine_patch_count?: number; material_id?: string | null };

/** Built-in review: full raw OCR (read-only) beside an editable correction. Raw unit is never changed. */
function UnitReview({ jobId, unit, isRevision, canApplyRevision, onSaved }: {
  jobId: string; unit: ReviewUnit; isRevision: boolean; canApplyRevision: boolean; onSaved: () => void;
}) {
  const save = useServerFn(saveExtractorUnitReview);
  const link = useServerFn(getExtractorSourceLink);
  const applyApproved = useServerFn(publishApprovedExtractorCorrections);
  const [text, setText] = useState(unit.reviewed_text ?? unit.content_text);
  const [busy, setBusy] = useState(false);
  const locked = unit.state === "published";
  const originalText = unit.original_content_text ?? unit.content_text;
  const changed = text.trim() !== originalText.trim();
  const act = async (choice: "accept_corrected" | "keep_original" | "reject" | null) => {
    setBusy(true);
    try {
      await save({ data: { id: jobId, unit_id: unit.unit_id, choice, reviewed_text: choice === "accept_corrected" || (choice === null && changed) ? text : null } });
      toast.success("Решение сохранено"); onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Ошибка"); } finally { setBusy(false); }
  };
  const publishChecked = async () => {
    if (!window.confirm("Применить именно этот подтверждённый текст к существующему материалу Pathy?\n\nПредыдущий текст сохранится в журнале изменений. Другие материалы не изменятся.")) return;
    setBusy(true);
    try {
      const r = await applyApproved({ data: { id: jobId, unit_ids: [unit.unit_id], confirmed: true } });
      toast.success(r.applied ? "Исправление опубликовано; предыдущий текст сохранён" : "Исправление уже применено");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Ошибка публикации"); }
    finally { setBusy(false); }
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
        {unit.machine_patch_count ? <Badge variant="outline">Машинных замен: {unit.machine_patch_count}</Badge> : null}
        {locked && <Badge>Опубликован</Badge>}
        <div className="ml-auto flex flex-wrap gap-1">
          {(unit.pages.length ? unit.pages : [null]).slice(0, 4).map((p) => (
            <Button key={String(p)} size="sm" variant="outline" onClick={() => open(p)}>{p ? `Открыть оригинал, стр. ${p}` : "Открыть оригинал"}</Button>
          ))}
        </div>
      </div>
      <ul className="text-xs text-destructive list-disc pl-4">{unit.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      {isRevision && !unit.material_id && <p className="text-xs text-muted-foreground">У этого блока нет соответствующего опубликованного материала исходной версии. Автоматическая замена не выполняется.</p>}
      {isRevision && unit.machine_patch_count && <p className="text-xs text-muted-foreground">Слева сохранён исходный OCR, справа — машинное предложение. Перед применением сверьте его с печатной страницей.</p>}
      <div className="grid gap-2 md:grid-cols-2">
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Исходный OCR (не изменяется)</span>
          <textarea readOnly className="h-64 w-full rounded-md border bg-muted/40 p-2 font-mono text-xs" value={originalText} /></label>
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
          {isRevision && canApplyRevision && unit.material_id && ["accept_corrected", "keep_original"].includes(unit.review_choice ?? "") && (
            <Button size="sm" variant="outline" disabled={busy} onClick={publishChecked}>Применить к опубликованному материалу</Button>
          )}
        </div>
      )}
    </div>
  );
}
