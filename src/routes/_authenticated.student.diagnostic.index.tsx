import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/oge/page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  listAvailableDiagnostics,
  startDiagnosticSession,
  listMyDiagnosticHistory,
} from "@/lib/diagnostic.functions";
import { listSubjects } from "@/lib/student-profile.functions";

export const Route = createFileRoute("/_authenticated/student/diagnostic")({
  component: DiagnosticHub,
});

const TYPE_LABEL: Record<string, string> = {
  entry: "входная",
  weekly: "недельная",
  weekly_subject: "недельная по предмету",
  external: "внешняя",
  custom: "по теме",
};

function DiagnosticHub() {
  const navigate = useNavigate();
  const [subjectId, setSubjectId] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const getTests = useServerFn(listAvailableDiagnostics);
  const getSubjects = useServerFn(listSubjects);
  const getHistory = useServerFn(listMyDiagnosticHistory);
  const startFn = useServerFn(startDiagnosticSession);

  const subjects = useQuery({
    queryKey: ["subjects-catalog"],
    queryFn: () => getSubjects(),
  });
  const tests = useQuery({
    queryKey: ["diagnostic-tests", subjectId, type],
    queryFn: () =>
      getTests({
        data: {
          subject_id: subjectId !== "all" ? subjectId : undefined,
          diagnostic_type: type !== "all" ? type : undefined,
        },
      }),
  });
  const history = useQuery({
    queryKey: ["diagnostic-history"],
    queryFn: () => getHistory(),
  });

  const startMut = useMutation({
    mutationFn: (data: { diagnostic_test_id: string }) => startFn({ data }),
    onSuccess: (res: any) => {
      navigate({
        to: "/student/diagnostic/$sessionId",
        params: { sessionId: res.session_id },
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось начать"),
  });

  return (
    <main className="min-h-screen" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-5xl mx-auto px-10 py-10">
        <div className="pf-topbar">
          <Link to="/student" className="pf-crumb hover:text-[color:var(--pf-ink)]">
            <ArrowLeft className="h-3 w-3 inline mr-1" /> к маршруту
          </Link>
          <div className="pf-crumb"><b>диагностика</b> · карта пробелов</div>
        </div>

        <PageHeader
          crumb={<>инструмент навигации</>}
          title="Диагностика"
          lead="Короткие тесты, чтобы определить уровень и слабые темы. Результаты сразу обновляют карту знаний."
        />

        <section className="pf-block mt-8 mb-8">
          <p className="pf-eyebrow mb-4">фильтры</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="pf-eyebrow mb-2 block">предмет</label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все предметы</SelectItem>
                  {(subjects.data ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="pf-eyebrow mb-2 block">тип</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value="entry">Входная</SelectItem>
                  <SelectItem value="weekly">Недельная</SelectItem>
                  <SelectItem value="custom">По теме</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="pf-block mb-8">
          <p className="pf-eyebrow mb-2">доступные диагностики</p>
          <h2 className="pf-h2 mb-6">Выберите тест</h2>

          {tests.isLoading ? (
            <p className="text-sm text-[color:var(--pf-muted)]">Загрузка…</p>
          ) : (tests.data ?? []).length === 0 ? (
            <p className="text-sm text-[color:var(--pf-muted)]">
              По заданным фильтрам диагностик пока нет.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {(tests.data as any[]).map((t) => (
                <div key={t.id} className="pf-role-tile">
                  <p className="pf-eyebrow">
                    {TYPE_LABEL[t.diagnostic_type] ?? t.diagnostic_type}
                    {t.subject?.name ? ` · ${t.subject.name}` : ""}
                    {t.program?.title ? ` · ${t.program.title}` : ""}
                  </p>
                  <h3 className="pf-h2">{t.title}</h3>
                  {t.description && (
                    <p className="text-[14px] text-[color:var(--pf-muted)] mt-1">
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-4">
                    <span className="font-mono text-[12px] text-[color:var(--pf-muted)]">
                      {t.duration_minutes ? `≈ ${t.duration_minutes} мин` : ""}
                    </span>
                    <Button
                      onClick={() => startMut.mutate({ diagnostic_test_id: t.id })}
                      disabled={startMut.isPending}
                    >
                      Начать
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="pf-block">
          <p className="pf-eyebrow mb-2">журнал</p>
          <h2 className="pf-h2 mb-6">История попыток</h2>
          {(history.data ?? []).length === 0 ? (
            <p className="text-sm text-[color:var(--pf-muted)]">
              Пока попыток нет. После прохождения диагностики результаты появятся здесь.
            </p>
          ) : (
            <ul className="grid gap-2">
              {(history.data as any[]).map((h) => (
                <li
                  key={h.id}
                  className="grid grid-cols-[1fr,90px,140px] gap-4 py-2 border-b border-[color:var(--pf-divider)] items-center"
                >
                  <div>
                    <div className="font-medium">
                      {h.diagnostic_test?.title ?? "Диагностика"}
                    </div>
                    <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--pf-muted)]">
                      {h.subject?.name ?? ""} · {TYPE_LABEL[h.diagnostic_type] ?? h.diagnostic_type} · {h.status}
                    </div>
                  </div>
                  <div className="font-mono text-[13px] text-right">
                    {h.status === "completed" ? `${h.score_percent ?? 0}%` : "—"}
                  </div>
                  <div className="text-right">
                    <Link
                      to="/student/diagnostic/$sessionId"
                      params={{ sessionId: h.id }}
                      className="text-[12px] font-mono underline underline-offset-4"
                    >
                      {h.status === "completed" ? "результат" : "продолжить"} →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
