import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import Papa from "papaparse";
import { toast } from "sonner";

import { amIAdmin, listImportLogs, previewImport, runImport } from "@/lib/admin-materials.functions";
import { formatRowIssues, normalizeRow } from "@/lib/admin-import-normalize";
import { isDevOpenAccess } from "@/lib/admin-access";
import { useAuth } from "@/hooks/use-auth";

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

function validateLocally(rows: Row[]): Preview {
  const errors: PreviewError[] = [];
  let validRows = 0;

  rows.forEach((row, index) => {
    const result = normalizeRow(row);
    if (result.ok) {
      validRows += 1;
      return;
    }
    errors.push({ row: index + 1, message: formatRowIssues(result.issues) });
  });

  return {
    total: rows.length,
    created: validRows,
    updated: 0,
    skipped: 0,
    errors,
    sample: rows.slice(0, 10),
  };
}

async function errorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof Response) {
    const body = await error.text().catch(() => "");
    if (error.status === 401) return "Сессия истекла. Войдите снова, чтобы выполнить серверную проверку.";
    if (error.status === 403) return "Для этой операции нужны права администратора.";
    return body || `${fallback} (${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
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
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const csvHeaders = Array.from(new Set(rows.flatMap((r) => Object.keys(r ?? {}))));
  const normKey = (k: string) => k.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "");
  const rowsWith = (key: string) => {
    const wanted = normKey(key);
    return rows.filter((r) =>
      Object.entries(r ?? {}).some(([k, v]) => normKey(k) === wanted && s(v).trim() !== ""),
    ).length;
  };


  const { user } = useAuth();
  const devOpen = isDevOpenAccess();
  const checkAdmin = useServerFn(amIAdmin);
  const adminQ = useQuery({
    queryKey: ["am-i-admin"],
    retry: false,
    enabled: Boolean(user),
    queryFn: async (): Promise<{ isAdmin: boolean }> => {
      try {
        const res = (await checkAdmin()) as { isAdmin?: boolean } | null;
        return { isAdmin: Boolean(res?.isAdmin) };
      } catch {
        return { isAdmin: false };
      }
    },
  });
  const logsQ = useQuery({
    queryKey: ["import-logs"],
    retry: false,
    enabled: Boolean(user),

    queryFn: async (): Promise<{ logs: unknown[] }> => {
      try {
        const res = (await listLogs()) as unknown;
        const logs = (res ?? {}) as { logs?: unknown };
        return { logs: Array.isArray(logs.logs) ? logs.logs : Array.isArray(res) ? (res as unknown[]) : [] };
      } catch {
        // нет сессии/прав — показываем пустой журнал вместо падения
        return { logs: [] };
      }
    },

  });


  const previewMut = useMutation({
    mutationFn: async () => {
      // Preview routes intentionally allow browsing without auth. In that mode,
      // validate in the browser instead of calling a protected server function.
      if (!user) return validateLocally(rows);

      try {
        const res: unknown = await previewFn({ data: { rows, fileName, format } });
        const r = (res ?? {}) as Record<string, unknown>;
        setReport((r.report ?? null) as Record<string, unknown> | null);
        if (!Array.isArray(r.errors)) {
          const msg = s((r.error as Record<string, unknown> | undefined)?.message ?? r.message);
          throw new Error(msg || "Сервер вернул неожиданный ответ (проверьте права администратора)");
        }
        return normalizePreview(res);
      } catch (error: unknown) {
        throw new Error(await errorMessage(error, "Ошибка предпросмотра"));
      }
    },
    onSuccess: (res) => setPreview(res),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Ошибка предпросмотра"),
  });


  const importMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Войдите как администратор, чтобы импортировать материалы.");
      try {
        return await importFn({ data: { rows, fileName, format } });
      } catch (error: unknown) {
        throw new Error(await errorMessage(error, "Ошибка импорта"));
      }
    },
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
    setReport(null);
    setParseErrors([]);
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
        const errs = Array.isArray(result.errors) ? result.errors : [];
        const data = Array.isArray(result.data) ? result.data : [];
        const messages = errs
          .slice(0, 20)
          .map((e) => `строка ${n(e?.row) + 1}: ${s(e?.message) || "ошибка разбора"}`);
        // Rows whose quoting broke shift later columns (correct_answer!) into
        // __parsed_extra, so treat that as a hard parse failure too.
        const extras = data.filter((r) => r && "__parsed_extra" in (r as Record<string, unknown>)).length;
        if (extras > 0) messages.push(`${extras} строк(и) содержат лишние поля — вероятно незакрытые кавычки`);
        setParseErrors(messages);
        if (messages.length > 0) toast.error(`CSV: ${messages[0]}`);
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

  const invalidRows = (preview?.errors ?? []).length;
  const validRows = preview ? Math.max(preview.total - invalidRows, 0) : 0;
  const validationPassed = Boolean(preview) && invalidRows === 0;
  const isAdmin = Boolean(adminQ.data?.isAdmin);
  const canImport = validationPassed && Boolean(user) && isAdmin && parseErrors.length === 0;

  const blockReason = parseErrors.length > 0
    ? `CSV разобран с ошибками (${parseErrors.length}). Импорт заблокирован.`
    : !preview
    ? "Сначала нажмите «Проверить»."
    : !validationPassed
      ? `Файл содержит ошибки: ${invalidRows}. Исправьте их и проверьте снова.`
      : !user
        ? "Войдите в аккаунт администратора."
        : adminQ.isLoading
          ? "Проверяем роль аккаунта…"
          : !isAdmin
            ? "У этого аккаунта нет роли admin."
            : null;

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
                <Button onClick={() => importMut.mutate()} disabled={importMut.isPending || !canImport}>
                  Импортировать материалы
                </Button>
              </div>

              {blockReason ? (
                <p className="text-sm text-destructive">{blockReason}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Проверка пройдена — импорт доступен.</p>
              )}

              {!user && devOpen ? (
                <p className="text-sm text-muted-foreground">
                  В режиме предпросмотра «Проверить» выполняет безопасную локальную валидацию. Для импорта и проверки дубликатов войдите как администратор.
                </p>
              ) : null}

              <div className="rounded-md border p-3 text-xs font-mono space-y-0.5 text-muted-foreground">
                <div>session exists: {String(Boolean(user))}</div>
                <div>user id: {user?.id ?? "—"}</div>
                <div>role: {!user ? "—" : adminQ.isLoading ? "загрузка…" : adminQ.data?.isAdmin ? "admin" : "не admin"}</div>
                <div>validationPassed: {String(validationPassed)}</div>
                <div>validRows: {preview ? validRows : "—"}</div>
                <div>invalidRows: {preview ? invalidRows : "—"}</div>
                <div className="break-all">raw headers: {csvHeaders.join(" | ") || "—"}</div>
                <div>
                  diagnostic_title: {rowsWith("diagnostic_title")} · exam_task_number: {rowsWith("exam_task_number")} ·
                  correct_answer: {rowsWith("correct_answer")}
                </div>
                {report ? (
                  <div>
                    server: diagnosticRows {n(report.diagnosticRows)} · materialRows {n(report.materialRows)} ·
                    correct_answer {n(report.withCorrectAnswer)} · exam_task_number {n(report.withExamNumber)}
                  </div>
                ) : null}
              </div>



              {parseErrors.length > 0 && (
                <div className="rounded-md border border-destructive p-4 text-sm space-y-1">
                  <div className="font-medium text-destructive">Ошибки разбора CSV</div>
                  <ul className="space-y-1">
                    {parseErrors.map((m, i) => (
                      <li key={i} className="text-destructive">{m}</li>
                    ))}
                  </ul>
                </div>
              )}

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
