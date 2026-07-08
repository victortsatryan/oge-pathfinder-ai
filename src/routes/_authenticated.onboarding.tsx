import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

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
import { PathyLogo } from "@/components/oge/logo";
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
  const [hoveredRole, setHoveredRole] = useState<"student" | "teacher" | null>(null);
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
    <main
      className="min-h-screen relative"
      style={{ background: "var(--pf-paper)" }}
    >
      <div className="max-w-5xl mx-auto px-10 py-16 pf-rise">
        <div className="pf-section-eyebrow">
          <span className="pf-section-eyebrow__label">
            <PathyLogo size="sm" />
            <span className="ml-3">/ онбординг · шаг 01 из 02</span>
          </span>
          <span className="pf-section-eyebrow__label">роль</span>
        </div>

        <div className="mt-16">
          {/* Герой: Path + y как маленький флажок */}
          <header className="mb-16 max-w-3xl relative">
            <p
              className="text-[16px] font-light tracking-wide mb-3"
              style={{ color: "var(--pf-muted)" }}
            >
              Добро пожаловать в
            </p>
            <h1
              className="pf-h1 leading-[0.9]"
              style={{ fontSize: "clamp(64px, 9vw, 128px)" }}
            >
              <span style={{ color: "var(--pf-ink)" }}>Path</span>
              <span style={{ color: "var(--pf-mustard)" }}>y</span>
            </h1>
            {/* Красная линия-акцент под заголовком */}
            <span
              aria-hidden
              className="block mt-6"
              style={{
                width: 72,
                height: 2,
                background: "var(--pf-cinnabar)",
              }}
            />
            <p
              className="pf-lead mt-8"
              style={{ maxWidth: "56ch" }}
            >
              Pathy строит индивидуальный маршрут по любому предмету, отслеживает
              прогресс и помогает AI-ассистентом. Выберите роль, чтобы продолжить.
            </p>
          </header>

          <div className="grid gap-0">
            <RoleRow
              index="01"
              accent="var(--pf-mustard)"
              role="ученик"
              title="Я исследую территорию предмета"
              description="Диагностика, маршрут на сегодня, проблемные зоны, занятия и материалы — единая карта подготовки."
              action="Продолжить как ученик →"
              onClick={() => {
                setRole("student");
                setStep("student-form");
              }}
            />
            <RoleRow
              index="02"
              accent="var(--pf-cinnabar)"
              role="преподаватель"
              title="Я веду учеников по карте"
              description="Профили учеников, слабые темы, индивидуальные маршруты и рекомендации AI-навигатора — в одном пространстве."
              action={
                teacherMut.isPending && role === "teacher"
                  ? "Сохранение…"
                  : "Войти как преподаватель →"
              }
              disabled={teacherMut.isPending}
              onClick={() => {
                setRole("teacher");
                teacherMut.mutate();
              }}
            />
          </div>
        </div>
      </div>

      {/* Монограмма Pathy — правый нижний угол */}
      <Monogram />
    </main>
  );
}


function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: color }}
    />
  );
}

// Вертикальный «маршрут»: три узла + два индекс-маркера, синхронизированные
// с карточками ролей. Метафора — путь состоит из шагов.
function RouteGraph({ highlight }: { highlight: "student" | "teacher" | null }) {
  const studentActive = highlight === "student";
  const teacherActive = highlight === "teacher";

  return (
    <aside
      aria-hidden
      className="hidden lg:block relative"
      style={{ minHeight: 560 }}
    >
      {/* Осевая линия */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: 24,
          width: 1,
          background: "var(--pf-line-strong)",
        }}
      />

      {/* Верхний узел */}
      <Node top={0} label="диагностика" filled={false} />
      {/* Средний узел */}
      <Node top={140} label="маршрут" filled={false} />
      {/* Финальный квадрат — «маленькие победы» */}
      <SquareNode top={280} label="практика" />

      {/* Индекс 01 — рядом с карточкой ученика */}
      <IndexMarker
        top={410}
        label="01"
        color="var(--pf-mustard)"
        active={studentActive}
        shape="circle"
      />
      {/* Индекс 02 — рядом с карточкой преподавателя */}
      <IndexMarker
        top={510}
        label="02"
        color="var(--pf-cinnabar)"
        active={teacherActive}
        shape="line"
      />
    </aside>
  );
}

function Node({
  top,
  label,
  filled,
}: {
  top: number;
  label: string;
  filled: boolean;
}) {
  return (
    <div className="absolute flex items-center gap-4" style={{ top, left: 0 }}>
      <span
        aria-hidden
        className="h-3 w-3 rounded-full"
        style={{
          background: filled ? "var(--pf-ink)" : "var(--pf-paper)",
          border: "1px solid var(--pf-line-strong)",
          marginLeft: 18,
        }}
      />
      <span
        className="font-mono text-[10px] uppercase tracking-[0.22em]"
        style={{ color: "var(--pf-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

function SquareNode({ top, label }: { top: number; label: string }) {
  return (
    <div className="absolute flex items-center gap-4" style={{ top, left: 0 }}>
      <span
        aria-hidden
        className="h-3 w-3"
        style={{
          background: "var(--pf-mustard)",
          marginLeft: 18,
        }}
      />
      <span
        className="font-mono text-[10px] uppercase tracking-[0.22em]"
        style={{ color: "var(--pf-ink)" }}
      >
        {label}
      </span>
    </div>
  );
}

function IndexMarker({
  top,
  label,
  color,
  active,
  shape,
}: {
  top: number;
  label: string;
  color: string;
  active: boolean;
  shape: "circle" | "line";
}) {
  return (
    <div
      className="absolute flex items-center gap-4 transition-colors duration-200"
      style={{ top, left: 0 }}
    >
      {shape === "circle" ? (
        <span
          aria-hidden
          className="rounded-full transition-all duration-300"
          style={{
            width: active ? 28 : 20,
            height: active ? 28 : 20,
            background: active ? color : "var(--pf-paper)",
            border: `1.5px solid ${color}`,
            marginLeft: active ? 10 : 14,
          }}
        />
      ) : (
        <span
          aria-hidden
          className="transition-all duration-300"
          style={{
            width: active ? 28 : 20,
            height: 2,
            background: color,
            marginLeft: active ? 10 : 14,
          }}
        />
      )}
      <span
        className="font-mono text-[13px] tracking-widest transition-colors duration-200"
        style={{ color: active ? "var(--pf-ink)" : "var(--pf-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

function RoleRow({
  index,
  accent,
  role,
  title,
  description,
  action,
  onClick,
  onHover,
  onLeave,
  disabled,
}: {
  index: string;
  accent: string;
  role: string;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => {
        setHover(true);
        onHover();
      }}
      onMouseLeave={() => {
        setHover(false);
        onLeave();
      }}
      onFocus={() => {
        setHover(true);
        onHover();
      }}
      onBlur={() => {
        setHover(false);
        onLeave();
      }}
      disabled={disabled}
      className="group relative text-left grid gap-3 py-8 border-t border-[color:var(--pf-line-strong)] last:border-b transition-colors px-2 -mx-2 disabled:opacity-60"
    >
      {/* Тонкая горизонтальная линия, «выезжающая» при hover */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-px transition-[width] duration-[400ms] ease-out"
        style={{
          width: hover ? "100%" : "0%",
          background: accent,
        }}
      />

      <div className="flex items-baseline gap-6">
        <span
          className="font-mono text-[12px] tracking-[0.2em] transition-colors duration-200"
          style={{
            minWidth: 40,
            color: hover ? accent : "var(--pf-ink)",
          }}
        >
          {index}
        </span>
        <span className="pf-section-eyebrow__label">/ {role}</span>
      </div>
      <h2 className="pf-h2 pl-[64px]" style={{ maxWidth: "28ch" }}>
        {title}
      </h2>
      <p
        className="pl-[64px] text-[15px] leading-relaxed"
        style={{ color: "var(--pf-muted)", maxWidth: "58ch" }}
      >
        {description}
      </p>
      <span
        className="pl-[64px] pf-eyebrow mt-2 transition-colors duration-200"
        style={{ color: hover ? accent : "var(--pf-mustard)" }}
      >
        {action}
      </span>
    </button>
  );
}

// Монограмма Pathy — тот же знак, что на /auth и в рельсе
function Monogram() {
  return (
    <div
      aria-hidden
      className="hidden md:block fixed bottom-8 right-8 pointer-events-none"
      style={{ width: 40, height: 40 }}
    >
      <div className="relative w-full h-full">
        <span
          className="absolute inset-0"
          style={{ background: "var(--pf-ink)" }}
        />
        <span
          className="absolute rounded-full"
          style={{
            width: 24,
            height: 24,
            background: "var(--pf-mustard)",
            top: -6,
            right: -6,
          }}
        />
        <span
          className="absolute"
          style={{
            width: 28,
            height: 1.5,
            background: "var(--pf-cinnabar)",
            bottom: 6,
            left: -8,
            transform: "rotate(-45deg)",
            transformOrigin: "left center",
          }}
        />
      </div>
    </div>
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
    <main className="min-h-screen relative" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-3xl mx-auto px-10 py-16 pf-rise">
        <div className="pf-section-eyebrow">
          <span className="pf-section-eyebrow__label">
            <b>Pathy</b> / онбординг · шаг 02 из 02
          </span>
          <span className="pf-section-eyebrow__label">ученик</span>
        </div>

        <header className="mt-10 mb-10 max-w-2xl">
          <p className="pf-eyebrow mb-3">предметы и цель</p>
          <h1 className="pf-h1" style={{ maxWidth: "18ch" }}>
            Соберём ваш <span style={{ color: "var(--pf-mustard)" }}>учебный профиль</span>
          </h1>
          <p className="pf-lead mt-4">
            Отметьте предметы, по которым готовитесь, и укажите цель. Pathy создаст
            стартовый маршрут и предложит диагностику.
          </p>
        </header>

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
      <Monogram />
    </main>
  );
}
