import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ConstructivistIllo } from "@/components/oge/constructivist-illo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { setMyRole } from "@/lib/role.functions";
import {
  listSubjects,
  completeStudentOnboarding,
} from "@/lib/student-profile.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

type Step = "role" | "student-form";

function OnboardingPage() {
  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<"student" | "teacher" | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const setRoleFn = useServerFn(setMyRole);
  const teacherMut = useMutation({
    mutationFn: () => setRoleFn({ data: { role: "teacher" } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-role"] });
      navigate({ to: "/teacher" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось сохранить роль"),
  });

  if (step === "student-form") {
    return <StudentOnboardingForm onBack={() => setStep("role")} />;
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-6xl mx-auto px-10 py-16">
        <div className="flex items-center gap-3 mb-16">
          <span
            className="pf-rail__logo-mark"
            aria-hidden
            style={{ background: "var(--pf-cinnabar)" }}
          />
          <span className="pf-crumb">
            <b>Pathy</b>
          </span>
        </div>

        <div className="grid lg:grid-cols-[1.3fr,1fr] gap-16 items-start mb-20">
          <div>
            <p className="pf-eyebrow mb-4">Шаг 01 · Роль</p>
            <h1 className="pf-h1 max-w-xl">Добро пожаловать в Pathy</h1>
            <p className="pf-lead">
              Pathy — персональная образовательная платформа. Она строит
              индивидуальный маршрут по любому предмету, отслеживает прогресс и
              помогает AI-ассистентом. Выберите режим, чтобы продолжить.
            </p>
          </div>
          <ConstructivistIllo variant="today" className="w-full" />
        </div>

        <div className="pf-role-grid">
          <button
            type="button"
            className="pf-role-tile text-left"
            onClick={() => {
              setRole("student");
              setStep("student-form");
            }}
          >
            <p className="pf-eyebrow">01 · ученик</p>
            <h2 className="pf-h2">Я исследую территорию предмета</h2>
            <p className="text-[15px] leading-relaxed text-[color:var(--pf-muted)]">
              Диагностика, маршрут на сегодня, проблемные зоны, занятия и
              материалы — всё как единая карта подготовки.
            </p>
            <span
              className="pf-eyebrow mt-4"
              style={{ color: "var(--pf-cinnabar)" }}
            >
              Продолжить как ученик →
            </span>
          </button>

          <button
            type="button"
            className="pf-role-tile text-left"
            disabled={teacherMut.isPending}
            onClick={() => {
              setRole("teacher");
              teacherMut.mutate();
            }}
          >
            <p className="pf-eyebrow">02 · преподаватель</p>
            <h2 className="pf-h2">Я веду учеников по карте</h2>
            <p className="text-[15px] leading-relaxed text-[color:var(--pf-muted)]">
              Профили учеников, слабые темы, индивидуальные маршруты и
              рекомендации AI-навигатора — в одном пространстве.
            </p>
            <span
              className="pf-eyebrow mt-4"
              style={{ color: "var(--pf-cinnabar)" }}
            >
              {teacherMut.isPending && role === "teacher"
                ? "Сохранение…"
                : "Войти как преподаватель →"}
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}

function StudentOnboardingForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listSubjectsFn = useServerFn(listSubjects);
  const completeFn = useServerFn(completeStudentOnboarding);

  const subjectsQ = useQuery({
    queryKey: ["onboarding-subjects"],
    queryFn: () => listSubjectsFn(),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetExam, setTargetExam] = useState<string>("oge");
  const [targetScore, setTargetScore] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [goal, setGoal] = useState("");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (selected.size === 0) throw new Error("Выберите хотя бы один предмет");
      return completeFn({
        data: {
          subjects: Array.from(selected).map((subject_id) => ({
            subject_id,
            program_id: null,
          })),
          target_exam: targetExam || null,
          target_score: targetScore.trim() || null,
          target_date: targetDate || null,
          learning_goal: goal.trim() || null,
        },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-role"] });
      await qc.invalidateQueries({ queryKey: ["my-student-subjects"] });
      toast.success("Профиль создан. Пройдите диагностику.");
      navigate({ to: "/student/diagnostic" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось завершить онбординг"),
  });

  const subjects = (subjectsQ.data ?? []) as Array<{
    id: string;
    name: string;
    description?: string | null;
    exam_type?: string | null;
  }>;

  return (
    <main className="min-h-screen" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-3xl mx-auto px-10 py-16">
        <div className="flex items-center gap-3 mb-12">
          <span
            className="pf-rail__logo-mark"
            aria-hidden
            style={{ background: "var(--pf-cinnabar)" }}
          />
          <span className="pf-crumb">
            <b>Pathy</b> · ученик
          </span>
        </div>

        <p className="pf-eyebrow mb-4">Шаг 02 · Предметы и цель</p>
        <h1 className="pf-h1 mb-4">Соберём ваш учебный профиль</h1>
        <p className="pf-lead mb-10">
          Отметьте предметы, по которым готовитесь, и укажите цель. Pathy создаст
          стартовый маршрут и предложит диагностику.
        </p>

        <section className="pf-block mb-6">
          <p className="pf-eyebrow mb-3">предметы</p>
          {subjectsQ.isLoading ? (
            <p className="text-sm text-[color:var(--pf-muted)]">Загрузка…</p>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-[color:var(--pf-muted)]">
              Каталог предметов пуст.
            </p>
          ) : (
            <div className="grid gap-2">
              {subjects.map((s) => {
                const checked = selected.has(s.id);
                return (
                  <Label
                    key={s.id}
                    className="flex items-start gap-3 py-2 cursor-pointer font-normal"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(s.id)}
                    />
                    <span>
                      <span className="font-medium">{s.name}</span>
                      {s.exam_type ? (
                        <span className="ml-2 text-[11px] font-mono uppercase text-[color:var(--pf-muted)]">
                          {s.exam_type}
                        </span>
                      ) : null}
                      {s.description ? (
                        <span className="block text-[13px] text-[color:var(--pf-muted)]">
                          {s.description}
                        </span>
                      ) : null}
                    </span>
                  </Label>
                );
              })}
            </div>
          )}
        </section>

        <section className="pf-block mb-6">
          <p className="pf-eyebrow mb-3">цель</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] uppercase tracking-wider">
                Экзамен
              </Label>
              <Select value={targetExam} onValueChange={setTargetExam}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oge">ОГЭ</SelectItem>
                  <SelectItem value="ege">ЕГЭ</SelectItem>
                  <SelectItem value="school">Школьная программа</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px] uppercase tracking-wider">
                Желаемый балл
              </Label>
              <Input
                value={targetScore}
                onChange={(e) => setTargetScore(e.target.value)}
                placeholder="например, 5 или 90"
              />
            </div>
            <div>
              <Label className="text-[12px] uppercase tracking-wider">
                Дата экзамена
              </Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[12px] uppercase tracking-wider">
                Цель обучения
              </Label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="коротко, своими словами"
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack} disabled={submit.isPending}>
            ← Назад
          </Button>
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || selected.size === 0}
          >
            {submit.isPending ? "Сохранение…" : "Завершить онбординг →"}
          </Button>
        </div>
      </div>
    </main>
  );
}
