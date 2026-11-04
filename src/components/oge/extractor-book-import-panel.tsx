import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { inspectFile, splitBatches, type UnitReport } from "@/lib/extractor/schema";
import { importBookBatch } from "@/lib/admin-book-import.functions";

type Props = { book: unknown; filename: string; canWrite: boolean; onReset: () => void };

export function ExtractorBookImportPanel({ book, filename, canWrite, onReset }: Props) {
  const checked = inspectFile(book);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [created, setCreated] = useState(0);
  const [existing, setExisting] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const saveFn = useServerFn(importBookBatch);
  const valid = checked.reports.filter((r) => r.status === "new");
  const groups = splitBatches(valid, checked.units);
  const kinds = checked.units.reduce<Record<string, number>>((acc, u) => {
    const kind = typeof u === "object" && u !== null && "kind" in u ? String(u.kind) : "unknown";
    acc[kind] = (acc[kind] ?? 0) + 1;
    return acc;
  }, {});
  async function save() {
    if (!canWrite || !confirmed || busy || done) return;
    setBusy(true);
    let added = 0, seen = 0;
    const failures: string[] = [];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      try {
        const result = await saveFn({ data: { confirmed: true, units: group.map(r => checked.units[r.index]) } });
        for (const row of result.reports) {
          if (row.status === "created") added++;
          else if (row.status === "existing") seen++;
          else failures.push(row.unit_id + ": " + (row.error || "Ошибка записи"));
        }
      } catch (error) {
        failures.push("Пакет " + (i + 1) + ": " + String(error));
        // Stop: server may have partially committed; re-upload is idempotent.
        setProgress(i + 1);
        break;
      }
      setProgress(i + 1);
      setCreated(added);
      setExisting(seen);
      setErrors([...failures]);
    }
    setCreated(added); setExisting(seen); setErrors(failures);
    setDone(true); setBusy(false);
  }
  return <div className="border rounded-lg p-4 space-y-3">
    <h3 className="font-semibold">Импорт книги из Pathy Extractor</h3>
    <p className="text-sm">{filename}: {checked.units.length} отдельных единиц, включая страницы, упражнения, правила и темы.</p>
    <p className="text-sm">{Object.entries(kinds).map(([name, n]) => name + " — " + n).join(" · ")}</p>
    <p className="text-sm text-muted-foreground">Сохраняются в существующие материалы Pathy, статус «Черновик», без публичного доступа. Источник и оригинальный JSON каждого элемента сохраняются. Никаких PCS-целей придумывать не нужно.</p>
    {checked.errors.length > 0 && <div role="alert" className="text-destructive">{checked.errors.join("; ")}</div>}
    <p className="text-sm">Валидных: {valid.length} · отклонённых: {checked.reports.length - valid.length} · пакетов: {groups.length}</p>
    {checked.reports.some(r => r.status === "failed") && <details><summary>Ошибки формата</summary>
      <ul className="text-sm text-destructive">{checked.reports.filter(r => r.status === "failed").slice(0,40).map((r,i)=><li key={i}>{r.unit_id}: {r.reasons.join("; ")}</li>)}</ul>
    </details>}
    {!canWrite && <p role="alert" className="text-destructive">Нет подтверждённой администраторской сессии. Режим DEV/Preview позволяет открыть страницу, но не записывать в базу. <Link className="underline" to="/auth">Войти в Pathy</Link>.</p>}
    {!done && <label className="text-sm flex gap-2 items-start">
      <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />
      Подтверждаю сохранение проверенных единиц книги как закрытых материалов без публикации.
    </label>}
    <div className="flex gap-2">
      <Button disabled={!canWrite || !confirmed || busy || done || valid.length === 0 || checked.errors.length > 0}
        onClick={()=>void save()}>{busy ? "Загрузка…" : done ? "Завершено" : "Импортировать материалы (" + valid.length + ")"}</Button>
      <Button variant="outline" disabled={busy} onClick={onReset}>Другой файл</Button>
    </div>
    {(busy || done) && <p role="status" className="text-sm">Пакетов: {progress} / {groups.length}. Создано: {created}; уже было: {existing}; ошибки: {errors.length}.</p>}
    {errors.length > 0 && <details open><summary>Ошибки импорта ({errors.length})</summary><ul className="text-sm text-destructive">
      {errors.map((e,i)=><li key={i}>{e}</li>)}</ul></details>}
  </div>;
}
