import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Sparkles, StickyNote, ListChecks } from "lucide-react";

import {
  getTeacherStudentDetail,
  createTeacherNote,
  createAssignment,
  analyseStudent,
} from "@/lib/teacher.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/teacher/students/$studentId")({
  component: StudentDetail,
});

function StudentDetail() {
  const { studentId } = Route.useParams();
  const qc = useQueryClient();
  const detailFn = useServerFn(getTeacherStudentDetail);
  const noteFn = useServerFn(createTeacherNote);
  const assignFn = useServerFn(createAssignment);
  const aiFn = useServerFn(analyseStudent);

  const { data, isLoading, error } = useQuery({
    queryKey: ["teacher", "student", studentId],
    queryFn: () => detailFn({ data: { student_profile_id: studentId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["teacher", "student", studentId] });

  const noteMut = useMutation({
    mutationFn: (vars: { content: string; note_type: any }) =>
      noteFn({ data: { student_profile_id: studentId, ...vars } }),
    onSuccess: invalidate,
  });
  const assignMut = useMutation({
    mutationFn: (vars: { title: string; comment?: string }) =>
      assignFn({ data: { student_profile_id: studentId, ...vars } }),
    onSuccess: invalidate,
  });
  const aiMut = useMutation({
    mutationFn: () => aiFn({ data: { student_profile_id: studentId } }),
    onSuccess: invalidate,
  });

  const [noteText, setNoteText] = useState("");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignComment, setAssignComment] = useState("");

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  if (error || !data) return <div className="p-6 text-sm text-red-600">Нет доступа или ученик не найден.</div>;

  const d = data as any;
  const aiOutput = (d.notes ?? []).length ? null : null; // placeholder
  const aiLast = aiMut.data?.output ?? null;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/teacher/students"><ArrowLeft className="h-4 w-4 mr-1" /> К списку</Link>
      </Button>

      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {d.profile?.display_name ?? "Без имени"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {d.profile?.grade ? `${d.profile.grade} · ` : ""}
          {d.profile?.learning_goal ?? "Цель не указана"}
          {d.profile?.target_exam ? ` · ${d.profile.target_exam}` : ""}
        </p>
      </header>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="pf-block p-5">
          <h2 className="font-medium mb-3">Прогресс по темам</h2>
          {d.progress.length === 0 && <div className="text-sm text-muted-foreground">Нет данных.</div>}
          <div className="space-y-3">
            {d.progress.slice(0, 8).map((p: any) => (
              <div key={p.topic_id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{p.topic?.title ?? "—"}</span>
                  <Badge variant="outline">{p.status}</Badge>
                </div>
                <Progress value={p.mastery_score ?? 0} />
              </div>
            ))}
          </div>
        </section>

        <section className="pf-block p-5">
          <h2 className="font-medium mb-3">Типичные ошибки</h2>
          {d.mistakes.length === 0 && <div className="text-sm text-muted-foreground">Пока нет.</div>}
          <ul className="space-y-2 text-sm">
            {d.mistakes.slice(0, 8).map((m: any) => (
              <li key={m.id} className="border-b pb-2">
                <div className="font-medium">{m.mistake_type ?? "ошибка"}</div>
                <div className="text-muted-foreground text-xs">{new Date(m.created_at).toLocaleDateString()}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="pf-block p-5">
          <h2 className="font-medium mb-3">Учебные маршруты</h2>
          {d.paths.length === 0 && <div className="text-sm text-muted-foreground">Маршрутов нет.</div>}
          <ul className="space-y-2 text-sm">
            {d.paths.map((p: any) => (
              <li key={p.id} className="flex justify-between border-b pb-2">
                <span>{p.title}</span>
                <Badge variant="outline">{p.status} · {p.generated_by}</Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="pf-block p-5">
          <h2 className="font-medium mb-3">Ближайшие занятия</h2>
          {d.lessons.length === 0 && <div className="text-sm text-muted-foreground">Нет.</div>}
          <ul className="space-y-2 text-sm">
            {d.lessons.slice(0, 8).map((l: any) => (
              <li key={l.id} className="flex justify-between border-b pb-2">
                <span>{l.title}</span>
                <span className="text-muted-foreground">{l.lesson_date} · {l.status}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="pf-block p-5 lg:col-span-2">
          <h2 className="font-medium mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI-помощник</h2>
          <Button size="sm" onClick={() => aiMut.mutate()} disabled={aiMut.isPending}>
            Проанализировать ученика
          </Button>
          {aiLast && (
            <div className="mt-4 space-y-2 text-sm">
              <div>Средний прогресс: <b>{(aiLast as any).avg_mastery}%</b></div>
              <div><b>Что тормозит:</b> {(aiLast as any).blockers}</div>
              <div>
                <b>Слабые темы:</b>
                <ul className="list-disc pl-5">
                  {((aiLast as any).weak_topics ?? []).map((w: any, i: number) => (
                    <li key={i}>{w.title} — {w.mastery}%</li>
                  ))}
                </ul>
              </div>
              <div>
                <b>Что делать:</b>
                <ul className="list-disc pl-5">
                  {((aiLast as any).next_actions ?? []).map((a: string, i: number) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            </div>
          )}
        </section>

        <section className="pf-block p-5">
          <h2 className="font-medium mb-3 flex items-center gap-2"><StickyNote className="h-4 w-4" /> Заметки преподавателя</h2>
          <Textarea
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Наблюдение, рекомендация…"
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              disabled={!noteText.trim() || noteMut.isPending}
              onClick={() => {
                noteMut.mutate({ content: noteText.trim(), note_type: "observation" });
                setNoteText("");
              }}
            >
              Сохранить
            </Button>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {d.notes.map((n: any) => (
              <li key={n.id} className="border-b pb-2">
                <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()} · {n.note_type}</div>
                <div>{n.content}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="pf-block p-5">
          <h2 className="font-medium mb-3 flex items-center gap-2"><ListChecks className="h-4 w-4" /> Назначения</h2>
          <div className="space-y-2">
            <Input
              placeholder="Заголовок (например: повторить дроби)"
              value={assignTitle}
              onChange={(e) => setAssignTitle(e.target.value)}
            />
            <Textarea
              rows={2}
              placeholder="Комментарий"
              value={assignComment}
              onChange={(e) => setAssignComment(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!assignTitle.trim() || assignMut.isPending}
                onClick={() => {
                  assignMut.mutate({ title: assignTitle.trim(), comment: assignComment.trim() || undefined });
                  setAssignTitle(""); setAssignComment("");
                }}
              >
                Назначить
              </Button>
            </div>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {d.assignments.map((a: any) => (
              <li key={a.id} className="border-b pb-2">
                <div className="font-medium">{a.title}</div>
                <div className="text-xs text-muted-foreground">{a.status} · {new Date(a.created_at).toLocaleDateString()}</div>
                {a.comment && <div className="text-xs mt-1">{a.comment}</div>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
