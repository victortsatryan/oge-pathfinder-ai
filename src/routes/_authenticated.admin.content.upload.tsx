import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  getExtractorJobs, publishExtractorJob, refreshExtractorJob, registerExtractorUpload,
  retryExtractorJob, setExtractorUnitDecision,
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
  processing: "Обрабатывается", succeeded: "Готов к проверке", failed: "Ошибка", published: "Опубликован",
};

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
  const jobs = useQuery({ queryKey: ["extractor-jobs"], queryFn: () => list(), refetchInterval: 8000 });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Выберите файл");
      if (!sourceExtension(file.name)) throw new Error("Поддерживаются: " + SOURCE_EXTENSIONS.join(", "));
      if (file.size > MAX_SOURCE_BYTES) throw new Error("Файл больше 50 MB");
      const sha = await sha256(file);
      const path = `${sha}/${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const up = await supabase.storage.from("extractor-sources").upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (up.error && !/exists|duplicate/i.test(up.error.message)) throw new Error(up.error.message);
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
        <p className="text-sm text-muted-foreground">PDF, DOCX, TXT, MD, XLSX, CSV, PNG или JPEG до 50 MB. Файл разбирается обработчиком Pathy Content Extractor; уверенные блоки публикуются без ручной проверки, сомнительные — показываются отдельно.</p>
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
        <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>{upload.isPending ? "Загрузка…" : "Загрузить и разобрать"}</Button>
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
            {(j.status === "queued" || j.status === "processing") && <Progress value={j.progress} />}
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
    refetchInterval: (query) => ["queued", "processing"].includes(query.state.data?.job.status ?? "") ? 5000 : false,
  });
  const pub = useMutation({
    mutationFn: () => publish({ data: { id, subject_id: subject, rights_basis: rights, confirmed: true } }),
    onSuccess: (r) => { toast.success(`Опубликовано материалов: ${r.materials}, заданий: ${r.tasks}, уже было: ${r.existing}, ошибок: ${r.failed.length}`); qc.invalidateQueries({ queryKey: ["extractor-jobs"] }); q.refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка публикации"),
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">{String(q.error)}</p>;
  const { units, job } = q.data;
  if (!units.length) return <p className="text-sm text-muted-foreground">Результата разбора пока нет.</p>;
  const review = units.filter((u) => u.decision === "review");
  const toPublish = units.filter((u) => u.publish).length;
  const setD = async (unit_id: string, decision: "accept" | "reject" | null) => { await decide({ data: { id, unit_id, decision } }); q.refetch(); };

  return (
    <div className="space-y-3 border-t pt-3">
      <p className="text-sm">Блоков: {units.length} · уверенных: {units.filter((u) => u.decision === "confident").length} · требуют решения: {review.length} · некорректных: {units.filter((u) => u.decision === "invalid").length} · к публикации: {toPublish} · с заданием и ответом: {units.filter((u) => u.publish && u.task).length}</p>
      {review.length > 0 && <h3 className="text-sm font-semibold">Требуют решения</h3>}
      {units.filter((u) => u.decision !== "confident").map((u) => (
        <div key={u.unit_id} className="rounded border p-2 text-sm space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{u.title || u.unit_id}</span>
            <span className="text-xs text-muted-foreground">стр. {u.pages.join(", ") || "—"}</span>
            {u.decision === "review" && (
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant={u.admin === "accept" ? "default" : "outline"} onClick={() => setD(u.unit_id, u.admin === "accept" ? null : "accept")}>Принять</Button>
                <Button size="sm" variant={u.admin === "reject" ? "destructive" : "outline"} onClick={() => setD(u.unit_id, u.admin === "reject" ? null : "reject")}>Отклонить</Button>
              </div>
            )}
          </div>
          <ul className="text-xs text-destructive list-disc pl-4">{u.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{u.content_text}</p>
        </div>
      ))}
      <details className="text-sm"><summary className="cursor-pointer">Уверенные блоки ({units.filter((u) => u.decision === "confident").length})</summary>
        {units.filter((u) => u.decision === "confident").map((u) => (
          <div key={u.unit_id} className="flex items-center gap-2 py-1">
            <span className={u.admin === "reject" ? "line-through text-muted-foreground" : ""}>{u.title}</span>
            {u.task && <Badge variant="secondary">задание с ответом</Badge>}
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
          {job.status === "published" ? "Дополнить публикацию" : `Опубликовать для учеников Pathy (${toPublish})`}
        </Button>
        <span className="text-xs text-muted-foreground">Видно только вошедшим пользователям Pathy. Существующие материалы и задания не изменяются.</span>
      </div>
    </div>
  );
}
