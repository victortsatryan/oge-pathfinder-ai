import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, StickyNote } from "lucide-react";

import {
  getTeacherStudentDetail,
  createTeacherNote,
} from "@/lib/teacher.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdvisorPanel } from "@/components/oge/advisor-panel";

export const Route = createFileRoute("/_authenticated/teacher/students/$studentId")({
  component: StudentDetail,
});

function StudentDetail() {
  const { studentId } = Route.useParams();
  const qc = useQueryClient();
  const detailFn = useServerFn(getTeacherStudentDetail);
  const noteFn = useServerFn(createTeacherNote);

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

  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<string>("observation");

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>;
  if (error || !data) return <div className="p-6 text-sm text-red-600">Нет доступа или ученик не найден.</div>;

  const d = data as any;
  const upcoming = (d.lessons ?? []).filter((l: any) => l.status !== "completed");
  const activePath = (d.paths ?? []).find((p: any) => p.status === "active") ?? d.paths?.[0];

  return (
    <div className="space-y-5">
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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="progress">Прогресс</TabsTrigger>
          <TabsTrigger value="mistakes">Ошибки</TabsTrigger>
          <TabsTrigger value="path">Маршрут</TabsTrigger>
          <TabsTrigger value="calendar">Календарь</TabsTrigger>
          <TabsTrigger value="lessons">Занятия</TabsTrigger>
          <TabsTrigger value="notes">Заметки</TabsTrigger>
          <TabsTrigger value="advisor">Советник</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="pf-block p-5 space-y-2 text-sm">
              <Info label="Цель" v={d.profile?.learning_goal ?? "—"} />
              <Info label="Экзамен" v={d.profile?.target_exam ?? "—"} />
              <Info label="Класс" v={d.profile?.grade ?? "—"} />
              <Info label="Предметы" v={(d.subjects ?? []).map((s: any) => s.subject?.name).filter(Boolean).join(", ") || "—"} />
              <Info label="Слабых тем" v={String((d.progress ?? []).filter((p: any) => (p.mastery_score ?? 0) < 50).length)} />
              <Info label="Ошибок" v={String(d.mistakes.length)} />
              <Info label="Ближайшее занятие" v={upcoming[0] ? `${upcoming[0].lesson_date} · ${upcoming[0].title}` : "—"} />
              <Info label="Активный маршрут" v={activePath?.title ?? "—"} />
            </div>
            <div className="pf-block p-5 space-y-2">
              <div className="pf-eyebrow">Свежие ошибки</div>
              {d.mistakes.slice(0, 5).map((m: any) => (
                <div key={m.id} className="text-sm border-b pb-1.5">
                  <div className="font-medium">{m.mistake_type ?? "ошибка"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()} · {m.source ?? "—"}</div>
                </div>
              ))}
              {d.mistakes.length === 0 && <div className="text-sm text-muted-foreground">Ошибки пока не зафиксированы.</div>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="progress">
          <div className="pf-block p-5 space-y-3">
            {d.progress.length === 0 && <div className="text-sm text-muted-foreground">Данных о прогрессе пока нет.</div>}
            {d.progress.map((p: any) => (
              <div key={p.topic_id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{p.topic?.title ?? "—"}</span>
                  <span className="flex gap-2 items-center">
                    <Badge variant="outline">{p.status}</Badge>
                    <span className="text-muted-foreground text-xs">{p.mastery_score ?? 0}%</span>
                  </span>
                </div>
                <Progress value={p.mastery_score ?? 0} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="mistakes">
          <div className="pf-block p-5">
            {d.mistakes.length === 0 && <div className="text-sm text-muted-foreground">Ошибки пока не зафиксированы.</div>}
            <ul className="space-y-2 text-sm">
              {d.mistakes.map((m: any) => (
                <li key={m.id} className="border-b pb-2">
                  <div className="font-medium">{m.mistake_type ?? "ошибка"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()} · источник: {m.source ?? "—"}
                  </div>
                  {m.mistake_description && <div className="text-xs mt-1">{m.mistake_description}</div>}
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="path">
          <div className="pf-block p-5">
            {d.paths.length === 0 && <div className="text-sm text-muted-foreground">Маршрут ученика ещё не сформирован.</div>}
            <ul className="space-y-2 text-sm">
              {d.paths.map((p: any) => (
                <li key={p.id} className="flex justify-between border-b pb-2">
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{p.description ?? p.goal ?? "—"}</div>
                  </div>
                  <Badge variant="outline">{p.status} · {p.generated_by}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="pf-block p-5">
            {d.lessons.length === 0 && <div className="text-sm text-muted-foreground">Событий календаря пока нет.</div>}
            <ul className="space-y-2 text-sm">
              {d.lessons.map((l: any) => (
                <li key={l.id} className="flex justify-between border-b pb-2">
                  <span>{l.title}</span>
                  <span className="text-muted-foreground">{l.lesson_date} · {l.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="lessons">
          <div className="pf-block p-5">
            {d.lessons.length === 0 && <div className="text-sm text-muted-foreground">Занятий пока нет.</div>}
            <ul className="space-y-2 text-sm">
              {d.lessons.map((l: any) => (
                <li key={l.id} className="flex justify-between border-b pb-2">
                  <Link to="/lesson/$lessonId" params={{ lessonId: l.id }} className="hover:underline">
                    {l.title}
                  </Link>
                  <span className="text-muted-foreground">{l.lesson_date} · {l.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <div className="pf-block p-5 space-y-3">
            <div className="flex gap-2">
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="observation">Наблюдение</SelectItem>
                  <SelectItem value="lesson">По занятию</SelectItem>
                  <SelectItem value="diagnostic">По диагностике</SelectItem>
                  <SelectItem value="recommendation">Рекомендация</SelectItem>
                  <SelectItem value="parent_note">Родителю</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Заметка по ученику…"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!noteText.trim() || noteMut.isPending}
                onClick={() => {
                  noteMut.mutate({ content: noteText.trim(), note_type: noteType });
                  setNoteText("");
                }}
              >
                <StickyNote className="h-4 w-4 mr-1" /> Сохранить
              </Button>
            </div>
            <ul className="space-y-3 text-sm">
              {d.notes.length === 0 && <li className="text-muted-foreground">Заметок пока нет.</li>}
              {d.notes.map((n: any) => (
                <li key={n.id} className="border-b pb-2">
                  <div className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()} · {n.note_type}</div>
                  <div>{n.content}</div>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="advisor">
          <AdvisorPanel studentProfileId={studentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{v}</span>
    </div>
  );
}
