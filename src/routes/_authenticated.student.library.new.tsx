import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/oge/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCandidate,
  listSubjectsForLibrary,
  saveCandidate,
} from "@/lib/community-library.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const searchSchema = z.object({ id: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/student/library/new")({
  validateSearch: (s) => searchSchema.parse(s),
  component: NewCandidatePage,
});

const CONTENT_KINDS = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "image", label: "Изображение" },
  { value: "video", label: "Видео" },
  { value: "link", label: "Ссылка" },
  { value: "text", label: "Текст" },
];

const MATERIAL_TYPES = [
  { value: "theory", label: "Теория" },
  { value: "practice", label: "Практика" },
  { value: "solution", label: "Разбор" },
  { value: "notes", label: "Конспект" },
  { value: "cheatsheet", label: "Шпаргалка" },
  { value: "article", label: "Статья" },
  { value: "video", label: "Видео" },
  { value: "other", label: "Другое" },
];

const LEVELS = [
  { value: "basic", label: "Базовый" },
  { value: "intermediate", label: "Средний" },
  { value: "advanced", label: "Продвинутый" },
];

const CONTAINS = [
  { value: "rule", label: "Правило" },
  { value: "examples", label: "Примеры" },
  { value: "exercises", label: "Упражнения" },
  { value: "test", label: "Тест" },
  { value: "error_analysis", label: "Разбор ошибок" },
  { value: "table", label: "Таблица" },
  { value: "scheme", label: "Схема" },
  { value: "video", label: "Видео" },
  { value: "illustrations", label: "Иллюстрации" },
];

const EDUCATION_SYSTEMS = [
  { value: "school_ru_oge", label: "9 класс (ОГЭ)" },
  { value: "school_ru_ege", label: "11 класс (ЕГЭ)" },
  { value: "other", label: "Другое" },
];

type FormState = {
  id?: string;
  title: string;
  description: string;
  content_kind: string;
  education_system: string;
  grade: string;
  subject_id: string;
  material_type: string;
  file_path: string | null;
  file_url: string | null;
  link_url: string;
  content_text: string;
  contains: string[];
  level: string;
  usefulness: string;
};

const EMPTY: FormState = {
  title: "",
  description: "",
  content_kind: "text",
  education_system: "school_ru_oge",
  grade: "",
  subject_id: "",
  material_type: "theory",
  file_path: null,
  file_url: null,
  link_url: "",
  content_text: "",
  contains: [],
  level: "basic",
  usefulness: "",
};

function NewCandidatePage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const fetchSubjects = useServerFn(listSubjectsForLibrary);
  const fetchCandidate = useServerFn(getCandidate);
  const saveFn = useServerFn(saveCandidate);

  const subjectsQuery = useQuery({
    queryKey: ["library-subjects"],
    queryFn: () => fetchSubjects(),
  });

  const existing = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => fetchCandidate({ data: { id: id! } }),
    enabled: !!id,
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const c = existing.data?.candidate;
    if (!c) return;
    setForm({
      id: c.id,
      title: c.title ?? "",
      description: c.description ?? "",
      content_kind: c.content_kind ?? "text",
      education_system: c.education_system ?? "school_ru_oge",
      grade: c.grade ?? "",
      subject_id: c.subject_id ?? "",
      material_type: c.material_type ?? "theory",
      file_path: c.file_path ?? null,
      file_url: c.file_url ?? null,
      link_url: c.link_url ?? "",
      content_text: c.content_text ?? "",
      contains: Array.isArray(c.contains) ? c.contains : [],
      level: c.level ?? "basic",
      usefulness: c.usefulness ?? "",
    });
  }, [existing.data]);

  const save = useMutation({
    mutationFn: (submit: boolean) =>
      saveFn({
        data: {
          id: form.id,
          title: form.title,
          description: form.description || null,
          content_kind: form.content_kind as any,
          education_system: form.education_system || null,
          grade: form.grade || null,
          subject_id: form.subject_id || null,
          topic_id: null,
          subtopic_id: null,
          material_type: form.material_type as any,
          file_url: form.file_url,
          file_path: form.file_path,
          link_url: form.link_url || null,
          content_text: form.content_text || null,
          contains: form.contains as any,
          level: (form.level as any) || null,
          usefulness: form.usefulness || null,
          submit,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.status === "submitted"
          ? "Материал отправлен на проверку"
          : "Черновик сохранён",
      );
      navigate({ to: "/student/library" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Ошибка сохранения"),
  });

  async function handleUpload(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("community-library")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      setForm((s) => ({ ...s, file_path: path, file_url: null }));
      toast.success(`Файл загружен: ${file.name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось загрузить файл");
    } finally {
      setUploading(false);
    }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const toggleContains = (value: string) =>
    setForm((s) => ({
      ...s,
      contains: s.contains.includes(value)
        ? s.contains.filter((x) => x !== value)
        : [...s.contains, value],
    }));

  const canSubmit = form.title.trim().length >= 2;
  const needsFile = ["pdf", "docx", "image", "video"].includes(form.content_kind);
  const needsLink = form.content_kind === "link";
  const needsText = form.content_kind === "text";

  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb">
          <b>Библиотека</b> · {form.id ? "редактирование" : "новый материал"}
        </div>
      </div>

      <PageHeader
        title="Предложить материал"
        lead="Опишите материал: он сразу будет доступен вам и попадёт в очередь модерации Pathy."
      />

      <div className="pf-block mt-6 space-y-6 max-w-3xl">
        <Section title="1. О чём материал">
          <Field label="Название *">
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={300} />
          </Field>
          <Field label="Описание">
            <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
          </Field>
        </Section>

        <Section title="2. Формат">
          <Field label="Тип файла / контента">
            <Select value={form.content_kind} onValueChange={(v) => set("content_kind", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTENT_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          {needsFile && (
            <Field label={form.file_path ? "Файл загружен" : "Загрузите файл"}>
              <input
                type="file"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
                className="block text-sm"
              />
              {form.file_path && (
                <div className="mt-2 text-xs text-[color:var(--pf-muted)] break-all">
                  {form.file_path}
                </div>
              )}
            </Field>
          )}
          {needsLink && (
            <Field label="Ссылка *">
              <Input placeholder="https://..." value={form.link_url} onChange={(e) => set("link_url", e.target.value)} />
            </Field>
          )}
          {needsText && (
            <Field label="Текст материала">
              <Textarea rows={8} value={form.content_text} onChange={(e) => set("content_text", e.target.value)} maxLength={20000} />
            </Field>
          )}
        </Section>

        <Section title="3. Куда относится">
          <Field label="Образовательная система">
            <Select value={form.education_system} onValueChange={(v) => set("education_system", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EDUCATION_SYSTEMS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Класс">
            <Input value={form.grade} onChange={(e) => set("grade", e.target.value)} placeholder="например, 9" />
          </Field>
          <Field label="Предмет">
            <Select value={form.subject_id || "__none"} onValueChange={(v) => set("subject_id", v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="выберите предмет" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— не указан —</SelectItem>
                {(subjectsQuery.data?.subjects ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Тип материала">
            <Select value={form.material_type} onValueChange={(v) => set("material_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MATERIAL_TYPES.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="4. Что внутри материала">
          <div className="flex flex-wrap gap-2">
            {CONTAINS.map((c) => {
              const active = form.contains.includes(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleContains(c.value)}
                  className="pf-chip"
                  style={{
                    background: active ? "var(--pf-ink)" : "transparent",
                    color: active ? "var(--pf-paper)" : "var(--pf-ink)",
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <Field label="Уровень">
            <Select value={form.level} onValueChange={(v) => set("level", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Почему этот материал полезен?">
            <Textarea rows={3} value={form.usefulness} onChange={(e) => set("usefulness", e.target.value)} maxLength={2000} />
          </Field>
        </Section>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            variant="outline"
            disabled={!canSubmit || save.isPending || uploading}
            onClick={() => save.mutate(false)}
          >
            Сохранить черновик
          </Button>
          <Button
            disabled={!canSubmit || save.isPending || uploading}
            onClick={() => save.mutate(true)}
          >
            Отправить на проверку
          </Button>
          <Button variant="ghost" onClick={() => navigate({ to: "/student/library" })}>
            Отмена
          </Button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--pf-muted)" }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
