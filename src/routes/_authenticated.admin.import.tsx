import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import Papa from "papaparse";
import { toast } from "sonner";

import { listImportLogs, previewImport, runImport } from "@/lib/admin-materials.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/import")({
  component: ImportPage,
});

type Row = Record<string, string>;
type PreviewError = { row: number; message: string };
type Preview = { total: number; created: number; updated: number; skipped: number; errors: PreviewError[]; sample: Row[] };

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(s(v)) || 0);

function normalizePreview(res: unknown): Preview {
  const r = (res ?? {}) as Record<string, unknown>;
  const rawErrors = Array.isArray(r.errors) ? r.errors : [];
  return {
    total: n(r.total),
    created: n(r.created),
    updated: n(r.updated),
    skipped: n(r.skipped),
    sample: Array.isArray(r.sample) ? (r.sample as Row[]) : [],
    errors: rawErrors.map((e, i) => {
      const obj = (e ?? {}) as Record<string, unknown>;
      return { row: n(obj.row) || i + 1, message: s(obj.message) || "Неизвестная ошибка" };
    }),
  };
}

const EXPECTED_HEADERS = [
  "subject_title", "grade", "program_title", "topic_title", "subtopic_title",
  "learning_objective_title", "material_type", "title", "description",
  "source_name", "source_url", "content_text", "video_url", "file_url",
  "difficulty", "estimated_time_minutes", "license_note", "status",
];

function ImportPage() {
  const previewFn = useServerFn(previewImport);
  const importFn = useServerFn(runImport);
  const listLogs = useServerFn(listImportLogs);
  const qc = useQueryClient();

  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [preview, setPreview] = useState<Preview | null>(null);

  const logsQ = useQuery({ queryKey: ["import-logs"], queryFn: () => listLogs() });

  const previewMut = useMutation({
    mutationFn: () => previewFn({ data: { rows, fileName, format } }),
    onSuccess: (res) => setPreview(normalizePreview(res)),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Ошибка предпросмотра"),
  });

  const importMut = useMutation({
    mutationFn: () => importFn({ data: { rows, fileName, format } }),
    onSuccess: (raw) => {
      const res = normalizePreview(raw);
      toast.success(`Импорт завершён: создано ${res.created}, обновлено ${res.updated}, пропущено ${res.skipped}, ошибок ${res.errors.length}`);
      qc.invalidateQueries({ queryKey: ["import-logs"] });
      setPreview(null);
      setRows([]);
      setFileName("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Ошибка импорта"),
  });


  function handleFile(file: File) {
    setFileName(file.name);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = s(reader.result);
      if (file.name.toLowerCase().endsWith(".json")) {
        try {
          const parsed: unknown = JSON.parse(text);
          const arr = Array.isArray(parsed)
            ? parsed
            : Array.isArray((parsed as { materials?: unknown })?.materials)
              ? ((parsed as { materials: unknown[] }).materials)
              : [];
          setRows(arr.map((r) => {
            const obj: Row = {};
            for (const [k, v] of Object.entries((r ?? {}) as Record<string, unknown>)) obj[k] = s(v);
            return obj;
          }));
          setFormat("json");
        } catch (e: unknown) {
          toast.error("Неверный JSON: " + (e instanceof Error ? e.message : ""));
        }
      } else {
        const result = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => s(h).trim(),
        });
        const parseErrors = Array.isArray(result.errors) ? result.errors : [];
        if (parseErrors.length > 0) toast.error(`CSV: ${s(parseErrors[0]?.message) || "ошибка разбора"}`);
        const data = Array.isArray(result.data) ? result.data : [];
        const normalized = data.map((r) => {
          const obj: Row = {};
          for (const [k, v] of Object.entries((r ?? {}) as Record<string, unknown>)) obj[s(k).trim()] = s(v);
          return obj;
        });
        setRows(normalized.filter((r) => Object.values(r).some((v) => s(v).trim() !== "")));
        setFormat("csv");
      }
    };

    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Загрузить файл</CardTitle>
          <CardDescription>CSV или JSON. Колонки: {EXPECTED_HEADERS.join(", ")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {fileName ? (
            <p className="text-sm text-muted-foreground">{fileName} — {rows.length} строк</p>
          ) : null}

          {rows.length > 0 && (
            <>
              <div>
                <h3 className="text-sm font-medium mb-2">Предпросмотр (первые 10)</h3>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>subject</TableHead><TableHead>topic</TableHead>
                        <TableHead>type</TableHead><TableHead>title</TableHead><TableHead>status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 10).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{s(r.subject_title)}</TableCell>
                          <TableCell>{s(r.topic_title)}{s(r.subtopic_title) ? ` / ${s(r.subtopic_title)}` : ""}</TableCell>
                          <TableCell>{s(r.material_type)}</TableCell>
                          <TableCell className="max-w-xs truncate">{s(r.title)}</TableCell>
                          <TableCell>{s(r.status) || "draft"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => previewMut.mutate()} disabled={previewMut.isPending} variant="outline">
                  Проверить
                </Button>
                <Button onClick={() => importMut.mutate()} disabled={importMut.isPending || !preview}>
                  Импортировать материалы
                </Button>
              </div>

              {preview && (
                <div className="rounded-md border p-4 text-sm space-y-1 bg-muted/50">
                  <div>Всего строк: <strong>{preview.total}</strong></div>
                  <div>Будет создано: <strong>{preview.created}</strong></div>
                  <div>Будет обновлено: <strong>{preview.updated}</strong></div>
                  <div>Будет пропущено: <strong>{preview.skipped}</strong></div>
                  <div>Ошибки: <strong>{(preview.errors ?? []).length}</strong></div>
                  {(preview.errors ?? []).length > 0 && (
                    <details className="mt-2" open>
                      <summary className="cursor-pointer">Показать ошибки</summary>
                      <ul className="mt-2 space-y-1">
                        {(preview.errors ?? []).slice(0, 50).map((e, i) => (
                          <li key={`${e.row}-${i}`} className="text-destructive">
                            Строка {e.row}: {s(e.message)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История импортов</CardTitle>
        </CardHeader>
        <CardContent>
          {logsQ.isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Файл</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Всего</TableHead>
                    <TableHead>Создано</TableHead>
                    <TableHead>Обновлено</TableHead>
                    <TableHead>Пропущено</TableHead>
                    <TableHead>Ошибки</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Array.isArray(logsQ.data?.logs) ? logsQ.data.logs : []).map((raw: unknown, i: number) => {
                    const log = (raw ?? {}) as Record<string, unknown>;
                    const created = s(log.created_at);
                    const date = created ? new Date(created) : null;
                    return (
                      <TableRow key={s(log.id) || i}>
                        <TableCell>{date && !Number.isNaN(date.getTime()) ? date.toLocaleString("ru-RU") : "—"}</TableCell>
                        <TableCell>{s(log.file_name) || "—"}</TableCell>
                        <TableCell>{s(log.status)}</TableCell>
                        <TableCell>{n(log.total_rows)}</TableCell>
                        <TableCell>{n(log.created_count)}</TableCell>
                        <TableCell>{n(log.updated_count)}</TableCell>
                        <TableCell>{n(log.skipped_count)}</TableCell>
                        <TableCell>{n(log.error_count)}</TableCell>
                      </TableRow>
                    );
                  })}

                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
