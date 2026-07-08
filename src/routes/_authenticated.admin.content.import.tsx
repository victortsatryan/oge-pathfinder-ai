import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { pcsPreviewImport, pcsRunImport } from "@/lib/pcs/pcs.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/content/import")({
  component: ImportPage,
});

function ImportPage() {
  const previewFn = useServerFn(pcsPreviewImport);
  const runFn = useServerFn(pcsRunImport);
  const [filename, setFilename] = useState<string>("");
  const [json, setJson] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [mode, setMode] = useState<"update" | "new_version" | "skip">("update");

  const previewMut = useMutation({
    mutationFn: (j: any) => previewFn({ data: { json: j } }),
    onSuccess: (res) => setPreview(res),
    onError: (e: any) => toast.error(e?.message ?? "Ошибка preview"),
  });
  const runMut = useMutation({
    mutationFn: () => runFn({ data: { json, filename, mode } }),
    onSuccess: () => { toast.success("Импорт выполнен"); setPreview(null); setJson(null); setFilename(""); },
    onError: (e: any) => toast.error(e?.message ?? "Ошибка импорта"),
  });

  function handleFile(f: File) {
    setFilename(f.name);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? ""));
        setJson(parsed);
        previewMut.mutate(parsed);
      } catch (e: any) {
        toast.error("Неверный JSON: " + (e?.message ?? ""));
      }
    };
    reader.readAsText(f);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Импорт PCS JSON</CardTitle>
          <CardDescription>Загрузите .json файл образовательного модуля</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".json,application/json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {filename && <p className="text-sm text-muted-foreground">{filename}</p>}
        </CardContent>
      </Card>

      {previewMut.isPending && <p className="text-sm text-muted-foreground">Проверка…</p>}

      {preview && !preview.ok && (
        <Card className="border-destructive">
          <CardHeader><CardTitle>Ошибки валидации</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {preview.errors.map((e: any, i: number) => (
                <li key={i} className="text-destructive"><b>{e.path || "root"}:</b> {e.message}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {preview?.ok && preview.kind === "diagnostic_test" && (
        <Card>
          <CardHeader><CardTitle>Preview — диагностика</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><b>Предмет:</b> {preview.summary.subject}</div>
              <div><b>Программа:</b> {preview.summary.program ?? "—"}</div>
              <div><b>Название:</b> {preview.summary.diagnostic_title}</div>
              <div><b>Тип:</b> {preview.summary.diagnostic_type}</div>
              <div><b>Задания:</b> {preview.summary.tasks}</div>
              <div><b>PCS version:</b> {preview.summary.pcs_version}</div>
            </div>
            <div className="rounded-md bg-muted p-3 text-xs space-y-1">
              <div>
                Предмет: {preview.resolved.subject_exists ? "существует" : "НЕ найден — импорт упадёт"} ·
                Диагностика: {preview.resolved.diagnostic_exists ? "будет обновлена" : "будет создана"}
              </div>
              {preview.resolved.topic_keys_missing?.length > 0 && (
                <div className="text-amber-700">
                  Не найдены темы: {preview.resolved.topic_keys_missing.join(", ")} — задания привяжутся без темы.
                </div>
              )}
            </div>
            {preview.resolved.diagnostic_exists && (
              <div className="flex gap-2 items-center">
                <span className="text-sm">Действие:</span>
                <select className="border rounded px-2 py-1 text-sm"
                  value={mode} onChange={(e) => setMode(e.target.value as any)}>
                  <option value="update">Обновить</option>
                  <option value="skip">Отмена (пропустить)</option>
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => runMut.mutate()} disabled={runMut.isPending || mode === "skip"}>
                Импортировать
              </Button>
              <Button variant="outline" onClick={() => { setPreview(null); setJson(null); }}>Отмена</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {preview?.ok && preview.kind !== "diagnostic_test" && (
        <Card>
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><b>Программа:</b> {preview.summary.program}</div>
              <div><b>Предмет:</b> {preview.summary.subject}</div>
              <div><b>Раздел:</b> {preview.summary.section}</div>
              <div><b>Тема:</b> {preview.summary.topic}</div>
              <div><b>Подтема:</b> {preview.summary.subtopic ?? "—"}</div>
              <div><b>Learning Objective:</b> {preview.summary.learning_objective}</div>
              <div><b>Материалы:</b> {preview.summary.materials}</div>
              <div><b>Task Patterns:</b> {preview.summary.task_patterns}</div>
              <div><b>Примеры:</b> {preview.summary.examples}</div>
              <div><b>Источники:</b> {preview.summary.sources}</div>
              <div><b>PCS version:</b> {preview.summary.pcs_version}</div>
              <div><b>Schema version:</b> {preview.summary.schema_version}</div>
            </div>
            <div className="rounded-md bg-muted p-3 text-xs">
              Предмет: {preview.resolved.subject_exists ? "существует" : "будет создан"} ·
              Программа: {preview.resolved.program_exists ? " существует" : " будет создана"} ·
              LO: {preview.resolved.lo_exists ? " уже существует — выберите действие" : " новый"}
            </div>

            {preview.resolved.lo_exists && (
              <div className="flex gap-2 items-center">
                <span className="text-sm">Действие:</span>
                <select className="border rounded px-2 py-1 text-sm"
                  value={mode} onChange={(e) => setMode(e.target.value as any)}>
                  <option value="update">Обновить</option>
                  <option value="new_version">Создать новую версию</option>
                  <option value="skip">Отмена (пропустить)</option>
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => runMut.mutate()} disabled={runMut.isPending || mode === "skip"}>
                Импортировать
              </Button>
              <Button variant="outline" onClick={() => { setPreview(null); setJson(null); }}>Отмена</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
