import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { searchTaskBank } from "@/lib/oge-lesson-edit.functions";
import { saveLocalLessonOverride } from "@/lib/oge-lesson-overrides";
import type { PlanCustomTask, PlanItem } from "@/lib/oge-mvp-data";
import type { LessonPracticeTask } from "@/lib/oge-mvp-data";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: PlanItem;
  initialTasks: LessonPracticeTask[];
  onSaved: () => void;
};

type DraftTask = PlanCustomTask;

function uid() {
  return `t-${Math.random().toString(36).slice(2, 10)}`;
}

export function LessonEditorDialog({ open, onOpenChange, lesson, initialTasks, onSaved }: Props) {
  const [title, setTitle] = useState(lesson.subject);
  const [topic, setTopic] = useState(lesson.topic);
  const [date, setDate] = useState(lesson.dateISO);
  const [slot, setSlot] = useState<number>(() => {
    const map = ["09:00–10:00", "10:20–11:20", "11:40–12:40", "13:30–14:30"];
    const idx = map.indexOf(lesson.time);
    return idx >= 0 ? idx + 1 : 1;
  });
  const [difficulty, setDifficulty] = useState<string>(lesson.difficulty ?? "adaptive");
  const [status, setStatus] = useState<string>(lesson.status === "done" ? "done" : "pending");
  const [teacherNote, setTeacherNote] = useState<string>(lesson.teacherNote ?? lesson.note ?? "");
  const [theory, setTheory] = useState<string>(lesson.theoryMarkdown ?? "");
  const [tasks, setTasks] = useState<DraftTask[]>(() =>
    (lesson.customTasks && lesson.customTasks.length
      ? lesson.customTasks
      : initialTasks.map((t) => ({
          id: t.id,
          prompt: t.prompt,
          expectedAnswer: t.expectedAnswer,
          explanation: t.explanation,
          sourceLabel: t.sourceLabel,
          bankTaskId: null,
        }))
    ).map((t) => ({ ...t }))
  );
  const [saving, setSaving] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuery, setBankQuery] = useState("");
  const [bankResults, setBankResults] = useState<Array<{ id: string; prompt: string; explanation: string; correctAnswer: string; subjectName: string; topicTitle: string; difficulty: string }>>([]);
  const [bankLoading, setBankLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(lesson.subject);
    setTopic(lesson.topic);
    setDate(lesson.dateISO);
  }, [open, lesson]);

  const updateTask = (id: string, patch: Partial<DraftTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const addEmpty = () => {
    setTasks((prev) => [
      ...prev,
      { id: uid(), prompt: "", expectedAnswer: "", explanation: "", sourceLabel: "Добавлено вручную", bankTaskId: null },
    ]);
  };

  const removeTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const moveTask = (id: string, dir: -1 | 1) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const runSearch = async () => {
    setBankLoading(true);
    try {
      const res = await searchTaskBank({
        data: { query: bankQuery, subjectName: lesson.subject, limit: 15 },
      });
      setBankResults(res.tasks);
    } catch (e) {
      console.error(e);
    } finally {
      setBankLoading(false);
    }
  };

  const addFromBank = (task: typeof bankResults[number]) => {
    setTasks((prev) => [
      ...prev,
      {
        id: uid(),
        prompt: task.prompt,
        expectedAnswer: task.correctAnswer,
        explanation: task.explanation,
        sourceLabel: `Банк · ${task.subjectName || "ОГЭ"}${task.topicTitle ? " · " + task.topicTitle : ""}`,
        bankTaskId: task.id,
      },
    ]);
    setBankOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      saveLocalLessonOverride({
        lessonKey: lesson.id,
        title: title || null,
        topic: topic || null,
        lessonDate: date || null,
        slotNumber: slot ?? null,
        difficulty: (difficulty as "easy" | "adaptive" | "medium" | "hard") || null,
        status: (status as "done" | "pending") || null,
        teacherNote: teacherNote || null,
        theoryMarkdown: theory || null,
        tasks: tasks.filter((t) => t.prompt.trim().length > 0).map((t) => ({
          id: t.id,
          prompt: t.prompt,
          expectedAnswer: t.expectedAnswer,
          explanation: t.explanation,
          sourceLabel: t.sourceLabel,
          bankTaskId: t.bankTaskId ?? null,
        })),
        updatedAt: new Date().toISOString(),
      });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      alert("Не удалось сохранить изменения занятия.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактировать занятие</DialogTitle>
          <DialogDescription>
            Изменения сохраняются для вашего календаря и применяются ко всем экранам.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Название</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label>Тема</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label>Дата</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Слот</Label>
              <Select value={String(slot)} onValueChange={(v) => setSlot(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 · 09:00–10:00</SelectItem>
                  <SelectItem value="2">2 · 10:20–11:20</SelectItem>
                  <SelectItem value="3">3 · 11:40–12:40</SelectItem>
                  <SelectItem value="4">4 · 13:30–14:30</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Сложность</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Лёгкая</SelectItem>
                  <SelectItem value="adaptive">Адаптивная</SelectItem>
                  <SelectItem value="medium">Средняя</SelectItem>
                  <SelectItem value="hard">Сложная</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Статус</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Запланировано</SelectItem>
                  <SelectItem value="done">Выполнено</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Заметка преподавателя</Label>
            <Textarea value={teacherNote} onChange={(e) => setTeacherNote(e.target.value)} rows={2} maxLength={4000} />
          </div>

          <div>
            <Label>Теория (markdown)</Label>
            <Textarea value={theory} onChange={(e) => setTheory(e.target.value)} rows={3} maxLength={20000} placeholder="Можно оставить пустым — будет использована теория из ресурса." />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Задания ({tasks.length})</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" type="button" onClick={() => setBankOpen((v) => !v)}>
                  {bankOpen ? "Скрыть банк" : "Из банка заданий"}
                </Button>
                <Button size="sm" type="button" onClick={addEmpty}>+ Своё задание</Button>
              </div>
            </div>

            {bankOpen ? (
              <div className="rounded-md border border-border p-3 space-y-2 bg-muted/30">
                <div className="flex gap-2">
                  <Input
                    placeholder="Поиск в банке заданий…"
                    value={bankQuery}
                    onChange={(e) => setBankQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  />
                  <Button size="sm" type="button" onClick={runSearch} disabled={bankLoading}>
                    {bankLoading ? "Ищу…" : "Найти"}
                  </Button>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {bankResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нажмите «Найти», чтобы увидеть подходящие задания из банка.</p>
                  ) : (
                    bankResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => addFromBank(t)}
                        className="block w-full text-left rounded p-2 hover:bg-accent transition"
                      >
                        <div className="text-xs text-muted-foreground">{t.subjectName}{t.topicTitle ? ` · ${t.topicTitle}` : ""} · {t.difficulty}</div>
                        <div className="text-sm line-clamp-2">{t.prompt}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {tasks.map((t, i) => (
              <div key={t.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Задание {i + 1}{t.bankTaskId ? " · из банка" : ""}</div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" type="button" onClick={() => moveTask(t.id, -1)} disabled={i === 0}>↑</Button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => moveTask(t.id, 1)} disabled={i === tasks.length - 1}>↓</Button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => removeTask(t.id)}>Удалить</Button>
                  </div>
                </div>
                <Textarea
                  placeholder="Текст задания"
                  value={t.prompt}
                  onChange={(e) => updateTask(t.id, { prompt: e.target.value })}
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Правильный ответ"
                    value={t.expectedAnswer}
                    onChange={(e) => updateTask(t.id, { expectedAnswer: e.target.value })}
                  />
                  <Input
                    placeholder="Метка источника"
                    value={t.sourceLabel}
                    onChange={(e) => updateTask(t.id, { sourceLabel: e.target.value })}
                  />
                </div>
                <Textarea
                  placeholder="Объяснение / решение"
                  value={t.explanation}
                  onChange={(e) => updateTask(t.id, { explanation: e.target.value })}
                  rows={2}
                />
              </div>
            ))}

            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Заданий пока нет. Добавьте из банка или создайте своё.</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
