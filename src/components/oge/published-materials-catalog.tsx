import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublishedContentCatalog, getTopicCatalogEditor } from "@/lib/content-catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PublishedMaterialsCatalog({ isAdmin = false }: { isAdmin?: boolean }) {
  const list = useServerFn(getPublishedContentCatalog);
  const topicList = useServerFn(getTopicCatalogEditor);
  const [subject, setSubject] = useState("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const catalog = useQuery({ queryKey: ["catalog-subjects"], queryFn: () => topicList() });
  const q = useQuery({
    queryKey: ["published-catalog", subject, submittedSearch, offset],
    queryFn: () => list({ data: { subject_id: subject || null, search: submittedSearch, offset } }),
  });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Опубликованные учебные материалы</h2>
        <p className="text-sm text-muted-foreground">
          Здесь вместе отображаются материалы из Pathy Extractor и редакционного импорта.
          Загрузка источника создаёт материалы в библиотеке, но не создаёт автоматически новые темы,
          задания ЕГЭ, ответы или уроки. Для привязки книги к темам откройте её обработку.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Фильтр по предмету" value={subject} onChange={(e) => { setSubject(e.target.value); setOffset(0); }}
          className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">Все предметы</option>
          {(catalog.data?.subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Input className="max-w-sm" placeholder="Поиск по названию" value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setSubmittedSearch(search.trim()); setOffset(0); } }} />
        <Button variant="outline" onClick={() => { setSubmittedSearch(search.trim()); setOffset(0); }}>Найти</Button>
      </div>
      {q.isError && <p className="text-sm text-destructive">{String(q.error)}</p>}
      <p className="text-sm text-muted-foreground">Найдено: {q.data?.count ?? "…"} · на странице: {q.data?.materials.length ?? 0}</p>
      <div className="divide-y rounded-md border">
        {(q.data?.materials ?? []).map((m) => (
          <div key={m.id} className="space-y-1 px-3 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link to="/material/$materialId" params={{ materialId: m.id }} className="font-medium underline-offset-2 hover:underline">
                {m.title}
              </Link>
              <span className="text-xs text-muted-foreground">{m.origin}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {m.subject_name ?? "—"} · {m.topic_title ?? "Без темы"} · {m.material_type}
              {m.source_name ? " · " + m.source_name : ""}
            </p>
            {isAdmin && m.origin === "Python Extractor" && !m.topic_id && (
              <p className="text-xs text-muted-foreground">
                Нужна тематическая привязка. <Link to="/admin/content/upload" className="underline">Открыть загрузки источников</Link>
              </p>
            )}
          </div>
        ))}
        {!q.isLoading && !q.data?.materials.length && <p className="p-4 text-sm text-muted-foreground">Материалы не найдены.</p>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={offset === 0 || q.isFetching} onClick={() => setOffset(Math.max(0, offset - 50))}>Назад</Button>
        <span className="text-xs text-muted-foreground">{offset + 1}–{Math.min(offset + 50, q.data?.count ?? 0)}</span>
        <Button variant="outline" disabled={offset + 50 >= (q.data?.count ?? 0) || q.isFetching} onClick={() => setOffset(offset + 50)}>Далее</Button>
      </div>
    </div>
  );
}
