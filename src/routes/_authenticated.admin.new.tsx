import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { createMaterialManual } from "@/lib/admin-materials.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/new")({
  component: NewMaterialPage,
});

const MATERIAL_TYPES = [
  "theory", "textbook_paragraph", "video", "article", "scheme", "infographic",
  "exercise_set", "task", "test", "task_solution", "reference", "scientific_material",
];
const STATUSES = ["draft", "reviewed", "published", "archived"];

const empty = {
  subject_title: "", grade: "", program_title: "", topic_title: "", subtopic_title: "",
  learning_objective_title: "", material_type: "theory", title: "", description: "",
  source_name: "", source_url: "", content_text: "", video_url: "", file_url: "",
  difficulty: 1, estimated_time_minutes: "", license_note: "", status: "draft",
};

function NewMaterialPage() {
  const createFn = useServerFn(createMaterialManual);
  const [form, setForm] = useState<Record<string, any>>(empty);

  const mut = useMutation({
    mutationFn: () => createFn({
      data: {
        ...form,
        difficulty: Number(form.difficulty) || 1,
        estimated_time_minutes: form.estimated_time_minutes ? Number(form.estimated_time_minutes) : null,
      },
    }),
    onSuccess: () => { toast.success("Материал сохранён"); setForm(empty); },
    onError: (e: any) => toast.error(e?.message ?? "Ошибка"),
  });

  const set = (k: string, v: any) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <Card>
      <CardHeader><CardTitle>Создать материал вручную</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
          <Field label="Предмет *"><Input value={form.subject_title} onChange={(e) => set("subject_title", e.target.value)} required /></Field>
          <Field label="Класс"><Input value={form.grade} onChange={(e) => set("grade", e.target.value)} placeholder="9" /></Field>
          <Field label="Программа"><Input value={form.program_title} onChange={(e) => set("program_title", e.target.value)} placeholder="ОГЭ / ФГОС" /></Field>
          <Field label="Тема"><Input value={form.topic_title} onChange={(e) => set("topic_title", e.target.value)} /></Field>
          <Field label="Подтема"><Input value={form.subtopic_title} onChange={(e) => set("subtopic_title", e.target.value)} /></Field>
          <Field label="Learning objective"><Input value={form.learning_objective_title} onChange={(e) => set("learning_objective_title", e.target.value)} /></Field>
          <Field label="Тип материала *">
            <Select value={form.material_type} onValueChange={(v) => set("material_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Статус">
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Название *" className="md:col-span-2"><Input value={form.title} onChange={(e) => set("title", e.target.value)} required /></Field>
          <Field label="Описание" className="md:col-span-2"><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Источник (название)"><Input value={form.source_name} onChange={(e) => set("source_name", e.target.value)} /></Field>
          <Field label="Источник (ссылка)"><Input value={form.source_url} onChange={(e) => set("source_url", e.target.value)} /></Field>
          <Field label="Видео URL"><Input value={form.video_url} onChange={(e) => set("video_url", e.target.value)} /></Field>
          <Field label="Файл URL"><Input value={form.file_url} onChange={(e) => set("file_url", e.target.value)} /></Field>
          <Field label="Сложность (1-5)"><Input type="number" min={1} max={5} value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)} /></Field>
          <Field label="Время (мин)"><Input type="number" min={0} value={form.estimated_time_minutes} onChange={(e) => set("estimated_time_minutes", e.target.value)} /></Field>
          <Field label="Лицензионная заметка" className="md:col-span-2"><Input value={form.license_note} onChange={(e) => set("license_note", e.target.value)} /></Field>
          <Field label="Текст материала" className="md:col-span-2"><Textarea rows={6} value={form.content_text} onChange={(e) => set("content_text", e.target.value)} /></Field>
          <div className="md:col-span-2">
            <Button type="submit" disabled={mut.isPending}>Сохранить материал</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
