import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/oge/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { demoStudents, type DemoStudent } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/teacher/students/")({
  component: StudentsPage,
});

function StudentsPage() {
  const [students, setStudents] = useState<DemoStudent[]>(demoStudents);
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [grade, setGrade] = useState<number | "">(9);
  const [notes, setNotes] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    setStudents((cur) => [
      {
        id: crypto.randomUUID(),
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        grade: grade === "" ? null : Number(grade),
        subjects: [],
        notes: notes.trim() || null,
        created_at: now,
        updated_at: now,
      },
      ...cur,
    ]);
    setFirstName(""); setLastName(""); setNotes(""); setOpen(false);
  };

  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>Ученики</b> · {students.length}</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="pf-btn"><Plus className="h-4 w-4" /> Добавить ученика</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый ученик</DialogTitle>
              <DialogDescription>Заполните карточку — её можно изменить позже.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fn">Имя</Label>
                  <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ln">Фамилия</Label>
                  <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gr">Класс</Label>
                <Input id="gr" type="number" min={1} max={11} value={grade}
                  onChange={(e) => setGrade(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nt">Заметки</Label>
                <Textarea id="nt" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <button type="submit" className="pf-btn">Сохранить</button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <PageHeader
        title="Мои ученики"
        lead="Реестр исследователей: общий прогресс и быстрые переходы к индивидуальным маршрутам."
      />

      <div className="pf-block">
        {students.map((s) => (
          <Link
            key={s.id}
            to="/teacher/students/$studentId"
            params={{ studentId: s.id }}
            className="pf-student-row"
          >
            <span className="pf-student-row__avatar">
              {s.first_name[0]}{s.last_name?.[0] ?? ""}
            </span>
            <div>
              <div className="pf-student-row__name">{s.first_name} {s.last_name ?? ""}</div>
              <div className="pf-student-row__sub">
                {s.grade ? `${s.grade} класс` : "Класс не указан"}
                {s.subjects.length ? ` · ${s.subjects.join(", ")}` : ""}
              </div>
            </div>
            <div className="pf-chip">маршрут активен</div>
            <span className="pf-crumb">→</span>
          </Link>
        ))}
      </div>
    </>
  );
}
