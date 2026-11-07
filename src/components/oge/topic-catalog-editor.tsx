import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createCatalogTopic, getTopicCatalogEditor, reviewCurriculumTopic } from "@/lib/content-catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TopicCatalogEditor() {
  const catalog = useServerFn(getTopicCatalogEditor);
  const create = useServerFn(createCatalogTopic);
  const review = useServerFn(reviewCurriculumTopic);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["topics-editor"], queryFn: () => catalog() });
  const [subject, setSubject] = useState("");
  const [parent, setParent] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"topic" | "section" | "subtopic">("topic");
  const [filter, setFilter] = useState("");
  const [onlyDraft, setOnlyDraft] = useState(false);
  const decide = useMutation({
    mutationFn: (value: { topic_id: string; decision: "approved" | "draft" }) => review({ data: value }),
    onSuccess: () => { toast.success("Статус темы обновлён"); qc.invalidateQueries({ queryKey: ["topics-editor"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ошибка утверждения"),
  });
  const save = useMutation({
    mutationFn: () => create({ data: {
      subject_id: subject, title: title.trim(), description: description.trim() || null,
      parent_topic_id: parent || null, topic_type: kind,
    } }),
    onSuccess: (r) => {
      toast.success(r.existing ? "Такая тема уже есть в предмете" : "Новая тема создана");
      setTitle(""); setDescription(""); setParent("");
      qc.invalidateQueries({ queryKey: ["topics-editor"] });
      qc.invalidateQueries({ queryKey: ["extractor-jobs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Не удалось создать тему"),
  });
  const topics = (q.data?.topics ?? []).filter((t) =>
    (!subject || t.subject_id === subject) &&
    (!onlyDraft || t.review_status === "draft") &&
    (!filter || (t.title + " " + (t.description ?? "")).toLocaleLowerCase("ru").includes(filter.toLocaleLowerCase("ru"))),
  );
  const existing = (q.data?.topics ?? []).find((t) =>
    t.subject_id === subject && t.title.trim().toLocaleLowerCase("ru") === title.trim().toLocaleLowerCase("ru"),
  );
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Темы учебной программы</h2>
        <p className="text-sm text-muted-foreground">
          Здесь создаётся самостоятельная система учебных тем: орфография, лексика, морфология и другие.
          Она не ограничена заданиями ЕГЭ или ОГЭ. Экзаменационные задания связываются с темами отдельно.
          Создание темы не меняет учебные маршруты и результаты учеников.
        </p>
      </div>
      {q.isError && <p className="text-sm text-destructive">{String(q.error)}</p>}
      <section className="space-y-3 rounded-md border p-4">
        <h3 className="font-medium">Добавить тему или раздел</h3>
        <select aria-label="Предмет" className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={subject} onChange={(e) => { setSubject(e.target.value); setParent(""); }}>
          <option value="">Выберите предмет</option>
          {(q.data?.subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Input placeholder="Название темы (например, Правописание корней)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid gap-3 md:grid-cols-2">
          <select aria-label="Тип" className="h-9 rounded-md border bg-background px-3 text-sm" value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="topic">Тема</option>
            <option value="section">Раздел</option>
            <option value="subtopic">Подтема</option>
          </select>
          <select aria-label="Родительский раздел" className="h-9 rounded-md border bg-background px-3 text-sm"
            value={parent} disabled={!subject} onChange={(e) => setParent(e.target.value)}>
            <option value="">Без родительской темы</option>
            {(q.data?.topics ?? []).filter((t) => t.subject_id === subject)
              .map((t) => <option value={t.id} key={t.id}>{t.title}</option>)}
          </select>
        </div>
        <textarea className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" value={description}
          placeholder="Описание темы и границы её содержания (необязательно)"
          onChange={(e) => setDescription(e.target.value)} />
        {existing && <p className="text-xs text-muted-foreground">Такая тема уже существует. Повтор не будет создан.</p>}
        <Button disabled={!subject || title.trim().length < 3 || save.isPending || Boolean(existing)}
          onClick={() => save.mutate()}>{save.isPending ? "Сохранение…" : "Создать тему"}</Button>
      </section>
      <section className="space-y-3">
        <h3 className="font-medium">Каталог существующих тем ({topics.length})</h3>
        <Input placeholder="Поиск темы" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyDraft} onChange={(e) => setOnlyDraft(e.target.checked)} /> Только черновики программы</label>
        <p className="text-xs text-muted-foreground">Каталог ФРП 1–11 классов — рабочая нормализация для методологического ревью. Только администратор утверждает темы; до этого они недоступны для автоматического включения в маршрут.</p>
        <div className="max-h-96 divide-y overflow-y-auto rounded border">
          {topics.map((t) => (
            <div key={t.id} className="px-3 py-2 text-sm">
              <div className="font-medium">{t.title}</div>
              <div className="text-xs text-muted-foreground">
                {q.data?.subjects.find((s) => s.id === t.subject_id)?.name} ·
                {t.topic_type === "section" ? " раздел" : t.topic_type === "subtopic" ? " подтема" : " тема"}
                {t.parent_topic_id ? " · в разделе: " + (q.data?.topics.find((p) => p.id === t.parent_topic_id)?.title ?? "—") : ""}
              </div>
              {t.review_status && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={t.review_status === "approved" ? "text-green-700" : "text-amber-700"}>
                    {t.review_status === "approved" ? "Утверждена" : t.review_status === "retired" ? "Архив" : "Черновик ФРП"}
                  </span>
                  <span className="text-muted-foreground">{t.grade_bands.join(", ")}</span>
                  {q.data?.role === "admin" && t.source_standard === "frp_ru_2025_working" && (
                    <Button size="sm" variant="outline" disabled={decide.isPending}
                      onClick={() => decide.mutate({
                        topic_id: t.id, decision: t.review_status === "approved" ? "draft" : "approved",
                      })}>
                      {t.review_status === "approved" ? "Вернуть в черновики" : "Утвердить тему"}
                    </Button>
                  )}
                </div>
              )}
              {t.source_standard === "textbook_numbered_heading" &&
                <p className="mt-1 text-xs text-muted-foreground">Архивный OCR-заголовок: не каноническая учебная тема</p>}
              {t.description && <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}
            </div>
          ))}
          {!q.isLoading && topics.length === 0 && <p className="p-3 text-sm text-muted-foreground">Нет подходящих тем.</p>}
        </div>
      </section>
    </div>
  );
}
