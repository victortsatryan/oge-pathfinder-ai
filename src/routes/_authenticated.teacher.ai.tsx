import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles } from "lucide-react";

import { listMyTeacherStudents, analyseStudent } from "@/lib/teacher.functions";
import { PageHeader } from "@/components/oge/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/teacher/ai")({
  component: TeacherAiPage,
});

const SCENARIOS = [
  { key: "progress", label: "Проанализировать прогресс" },
  { key: "next", label: "Предложить следующее занятие" },
  { key: "mistakes", label: "Объяснить типичные ошибки" },
  { key: "report", label: "Сформировать краткий отчёт" },
];

function TeacherAiPage() {
  const listFn = useServerFn(listMyTeacherStudents);
  const aiFn = useServerFn(analyseStudent);
  const { data } = useQuery({ queryKey: ["teacher", "students"], queryFn: () => listFn() });
  const [studentId, setStudentId] = useState<string>("");
  const [scenario, setScenario] = useState<string>("progress");

  const students = (data?.students ?? []) as any[];

  const run = useMutation({
    mutationFn: () => aiFn({ data: { student_profile_id: studentId } }),
  });

  const result = run.data as any;

  return (
    <>
      <PageHeader title="AI-помощник преподавателя" lead="Готовый интерфейс для анализа учеников. Часть сценариев работает по правилам, полноценный AI подключается позже." />

      <div className="pf-block p-5 space-y-4 max-w-2xl">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Выберите ученика</div>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue placeholder="— ученик —" /></SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.student?.id} value={s.student?.id ?? ""}>
                  {s.student?.display_name ?? "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-2">Сценарий</div>
          <div className="grid grid-cols-2 gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.key}
                onClick={() => setScenario(s.key)}
                className={`pf-chip ${scenario === s.key ? "is-active" : ""}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <Button disabled={!studentId || run.isPending} onClick={() => run.mutate()}>
          <Sparkles className="h-4 w-4 mr-1" /> Запустить
        </Button>

        {run.isPending && <div className="text-sm text-muted-foreground">Анализ…</div>}
        {result && (
          <div className="mt-4 space-y-2 text-sm border-t pt-4">
            <div>Средний прогресс: <b>{result.avg_mastery}%</b></div>
            <div><b>Что тормозит:</b> {result.blockers}</div>
            {result.weak_topics?.length > 0 && (
              <div>
                <b>Слабые темы:</b>
                <ul className="list-disc pl-5">
                  {result.weak_topics.map((w: any, i: number) => (
                    <li key={i}>{w.title} — {w.mastery}%</li>
                  ))}
                </ul>
              </div>
            )}
            {result.next_actions?.length > 0 && (
              <div>
                <b>Что делать:</b>
                <ul className="list-disc pl-5">
                  {result.next_actions.map((a: string, i: number) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
