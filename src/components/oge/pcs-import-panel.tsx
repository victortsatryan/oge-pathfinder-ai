import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { pcsPreviewImport, pcsRunImport } from "@/lib/pcs/pcs.functions";

export function PcsImportPanel({ json, filename, canWrite, onReset }: {
  json: unknown; filename: string; canWrite: boolean; onReset: () => void
}) {
  const previewFn = useServerFn(pcsPreviewImport);
  const importFn = useServerFn(pcsRunImport);
  const [preview, setPreview] = useState<any>(null);
  const [mode, setMode] = useState<"update" | "new_version" | "skip">("update");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function check() {
    setBusy(true); setMessage("");
    try {
      const result = await previewFn({ data: { json } });
      setPreview(result);
    } catch (e) { setMessage(String(e)); }
    setBusy(false);
  }
  async function save() {
    if (!canWrite || !preview?.ok || mode === "skip") return;
    setBusy(true); setMessage("");
    try {
      const result = await importFn({ data: { json, filename, mode } });
      setMessage("Импорт PCS выполнен. Результат: " + JSON.stringify(result.result ?? {}));
    } catch (e) { setMessage(String(e)); }
    setBusy(false);
  }
  return <div className="border rounded-lg p-4 space-y-3">
    <h3 className="font-semibold">Импорт образовательного модуля PCS</h3>
    <p className="text-sm">{filename}</p>
    {!canWrite && <p role="alert" className="text-destructive">Нужен вход в аккаунт администратора. <Link to="/auth" className="underline">Войти</Link>.</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy || !canWrite} onClick={() => void check()}>Проверить PCS</Button>
      <Button variant="outline" disabled={busy} onClick={onReset}>Другой файл</Button>
    </div>
    {preview && !preview.ok && <ul className="text-sm text-destructive">{(Array.isArray(preview.errors) ? preview.errors : [{ path: "root", message: "Неизвестная ошибка PCS" }]).map((e:any,i:number)=><li key={i}>{e.path}: {e.message}</li>)}</ul>}
    {preview?.ok && <div className="space-y-3">
      <p>Тип: {preview.kind}; предмет: {preview.summary?.subject}; программа: {preview.summary?.program || "—"}</p>
      <p className="text-sm">Структура PCS подтверждена. Перед записью выбери режим существующего материала.</p>
      <select className="border rounded px-2 py-1" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}>
        <option value="update">Обновить</option><option value="new_version">Новая версия</option><option value="skip">Не импортировать</option>
      </select>
      <Button disabled={busy || !canWrite || mode === "skip"} onClick={()=>void save()}>Импортировать PCS</Button>
    </div>}
    {busy && <p role="status">Обработка…</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
