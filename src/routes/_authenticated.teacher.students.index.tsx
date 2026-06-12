import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { demoStudents, type DemoStudent } from "@/lib/demo-data";

const SUBJECT_OPTIONS = [
  "Математика",
  "Русский язык",
  "Английский язык",
  "Биология",
  "Физика",
  "Химия",
  "История",
  "Обществознание",
  "География",
  "Информатика",
  "Литература",
];

export const Route = createFileRoute("/_authenticated/teacher/students/")({
  component: StudentsPage,
});

function StudentsPage() {
  const [students, setStudents] = useState<DemoStudent[]>(demoStudents);
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [grade, setGrade] = useState<number | "">(9);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setGrade(9);
    setSubjects([]);
    setNotes("");
    setError(null);
  };

  const toggleSubject = (s: string) =>
    setSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      setStudents((current) => [
        {
          id: crypto.randomUUID(),
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          grade: grade === "" ? null : Number(grade),
          subjects,
          notes: notes.trim() || null,
          created_at: now,
          updated_at: now,
        },
        ...current,
      ]);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить ученика");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить ученика?")) return;
    setStudents((current) => current.filter((student) => student.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ученики</h1>
          <p className="text-muted-foreground text-sm">
            Управляйте профилями и быстрым доступом к ним.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Добавить ученика
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый ученик</DialogTitle>
              <DialogDescription>Заполните карточку — её можно поменять позже.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fn">Имя</Label>
                  <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={80} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ln">Фамилия</Label>
                  <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={80} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gr">Класс</Label>
                <Input
                  id="gr"
                  type="number"
                  min={1}
                  max={11}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Предметы</Label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_OPTIONS.map((s) => {
                    const active = subjects.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSubject(s)}
                        className={
                          (active
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-background hover:bg-accent border-input") +
                          " border rounded-full px-3 py-1 text-sm transition-colors"
                        }
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Заметки</Label>
                <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="submit" disabled={saving || !firstName.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Сохранить
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Пока пусто</CardTitle>
            <CardDescription>
              Добавьте первого ученика, чтобы начать строить индивидуальные маршруты.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {students.map((s: any) => (
            <Card key={s.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">
                  {s.first_name} {s.last_name ?? ""}
                </CardTitle>
                <CardDescription>
                  {s.grade ? `${s.grade} класс` : "Класс не указан"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {(s.subjects ?? []).length === 0 ? (
                    <span className="text-xs text-muted-foreground">Предметы не указаны</span>
                  ) : (
                    (s.subjects as string[]).map((x) => (
                      <Badge key={x} variant="outline">
                        {x}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link
                      to="/teacher/students/$studentId"
                      params={{ studentId: s.id }}
                    >
                      Открыть профиль
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
