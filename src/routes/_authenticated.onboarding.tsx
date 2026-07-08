import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { setMyRole } from "@/lib/role.functions";
import { PathyLogo } from "@/components/oge/logo";
import {
  listSubjects,
  completeStudentOnboarding,
} from "@/lib/student-profile.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

// -------------------- Static option sets --------------------

const GOAL_OPTIONS = [
  { id: "oge", label: "Подготовиться к ОГЭ" },
  { id: "ege", label: "Подготовиться к ЕГЭ" },
  { id: "school", label: "Подтянуть школьную программу" },
  { id: "gaps", label: "Восполнить пробелы" },
  { id: "confidence", label: "Стать увереннее в предмете" },
  { id: "university", label: "Подготовиться к поступлению" },
];

const PROGRAM_OPTIONS = [
  { id: "OGE", label: "9 класс · ОГЭ", hint: "экзамен в 9 классе" },
  { id: "EGE", label: "11 класс · ЕГЭ", hint: "экзамен в 11 классе" },
  {
    id: "other",
    label: "Вне школьной программы",
    hint: "скоро — олимпиады, вуз, международные программы",
    disabled: true,
  },
];

const ASSESSMENT_OPTIONS = [
  { id: "beginner", label: "Пока только начинаю", n: 1 },
  { id: "basic", label: "Есть базовые знания", n: 2 },
  { id: "confident", label: "Чувствую себя уверенно", n: 3 },
  { id: "ready", label: "Почти готов к экзамену", n: 4 },
];

const BARRIER_OPTIONS = [
  { id: "gaps", label: "Не понимаю некоторые темы" },
  { id: "forget", label: "Быстро забываю" },
  { id: "system", label: "Не хватает системы" },
  { id: "rare", label: "Редко занимаюсь" },
  { id: "anxiety", label: "Волнуюсь перед экзаменами" },
  { id: "careless", label: "Ошибаюсь по невнимательности" },
  { id: "time", label: "Не хватает времени" },
  { id: "start", label: "Трудно заставить себя начать" },
  { id: "direction", label: "Не знаю, что учить дальше" },
];

const TIME_OPTIONS = [
  { id: "15-20", label: "15–20 минут" },
  { id: "30-40", label: "30–40 минут" },
  { id: "60", label: "около часа" },
  { id: "60-120", label: "1–2 часа" },
  { id: "variable", label: "по-разному" },
];

// -------------------- State --------------------

type Answers = {
  goals: string[];
  goalOther: string;
  program: string | null;
  subjects: Set<string>;
  assessment: string | null;
  barriers: string[];
  barrierOther: string;
  time: string | null;
};

const initial: Answers = {
  goals: [],
  goalOther: "",
  program: null,
  subjects: new Set(),
  assessment: null,
  barriers: [],
  barrierOther: "",
  time: null,
};

const TOTAL_STEPS = 8;

// -------------------- Page --------------------

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<"student" | "teacher" | null>(null);
  const [answers, setAnswers] = useState<Answers>(initial);

  const setRoleFn = useServerFn(setMyRole);
  const teacherMut = useMutation({
    mutationFn: () => setRoleFn({ data: { role: "teacher" } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-role"] });
      navigate({ to: "/teacher" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось сохранить роль"),
  });

  // Role picker screen (before student wizard)
  if (role === null) {
    return (
      <RolePicker
        onStudent={() => setRole("student")}
        onTeacher={() => {
          setRole("teacher");
          teacherMut.mutate();
        }}
        teacherPending={teacherMut.isPending}
      />
    );
  }

  if (role === "teacher") {
    return <FullscreenNote text="Переносим вас в кабинет преподавателя…" />;
  }

  // -------- Student wizard --------
  const canNext = validateStep(step, answers);

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => (step === 1 ? setRole(null) : setStep((s) => Math.max(1, s - 1)));

  return (
    <WizardChrome step={step} total={TOTAL_STEPS} onBack={back}>
      {step === 1 && <StepWelcome onNext={next} />}
      {step === 2 && (
        <StepGoals
          answers={answers}
          setAnswers={setAnswers}
          onNext={next}
          canNext={canNext}
        />
      )}
      {step === 3 && (
        <StepProgram
          answers={answers}
          setAnswers={setAnswers}
          onNext={next}
          canNext={canNext}
        />
      )}
      {step === 4 && (
        <StepSubjects
          answers={answers}
          setAnswers={setAnswers}
          onNext={next}
          canNext={canNext}
        />
      )}
      {step === 5 && (
        <StepAssessment
          answers={answers}
          setAnswers={setAnswers}
          onNext={next}
          canNext={canNext}
        />
      )}
      {step === 6 && (
        <StepBarriers
          answers={answers}
          setAnswers={setAnswers}
          onNext={next}
          canNext={canNext}
        />
      )}
      {step === 7 && (
        <StepTime
          answers={answers}
          setAnswers={setAnswers}
          onNext={next}
          canNext={canNext}
        />
      )}
      {step === 8 && <StepSummary answers={answers} />}
    </WizardChrome>
  );
}

function validateStep(step: number, a: Answers): boolean {
  switch (step) {
    case 1:
      return true;
    case 2:
      return a.goals.length > 0 || a.goalOther.trim().length > 0;
    case 3:
      return !!a.program;
    case 4:
      return a.subjects.size > 0;
    case 5:
      return true;
    case 6:
      return true;
    case 7:
      return true;
    default:
      return true;
  }
}

// -------------------- Chrome --------------------

function WizardChrome({
  step,
  total,
  onBack,
  children,
}: {
  step: number;
  total: number;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen relative" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10 sm:py-14 pf-rise">
        {/* Header */}
        <div className="pf-section-eyebrow">
          <span className="pf-section-eyebrow__label inline-flex items-center gap-3">
            <PathyLogo size="sm" />
            <span>/ онбординг · шаг {String(step).padStart(2, "0")} из {String(total).padStart(2, "0")}</span>
          </span>
          <button
            type="button"
            onClick={onBack}
            className="pf-section-eyebrow__label hover:text-[color:var(--pf-ink)] transition-colors"
          >
            ← назад
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-[2px] w-full" style={{ background: "var(--pf-line)" }}>
          <div
            className="h-full transition-[width] duration-500 ease-out"
            style={{ width: `${(step / total) * 100}%`, background: "var(--pf-mustard)" }}
          />
        </div>

        {/* Content */}
        <div className="mt-14">{children}</div>
      </div>
      <Monogram />
    </main>
  );
}

// -------------------- Role picker --------------------

function RolePicker({
  onStudent,
  onTeacher,
  teacherPending,
}: {
  onStudent: () => void;
  onTeacher: () => void;
  teacherPending: boolean;
}) {
  return (
    <main className="min-h-screen relative" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-14 pf-rise">
        <div className="pf-section-eyebrow">
          <span className="pf-section-eyebrow__label inline-flex items-center gap-3">
            <PathyLogo size="sm" />
            <span>/ роль</span>
          </span>
        </div>

        <header className="mt-16 mb-14">
          <p className="pf-eyebrow mb-3">С чего начнём</p>
          <h1 className="pf-h1 leading-[0.95]" style={{ fontSize: "clamp(48px, 7vw, 88px)" }}>
            Кто вы <span style={{ color: "var(--pf-mustard)" }}>сегодня</span>?
          </h1>
          <span
            aria-hidden
            className="block mt-6"
            style={{ width: 72, height: 2, background: "var(--pf-cinnabar)" }}
          />
        </header>

        <div>
          <RoleRow
            index="01"
            accent="var(--pf-mustard)"
            role="ученик"
            title="Я исследую территорию предмета"
            description="Настроим цели, посмотрим на пробелы и построим маршрут подготовки."
            action="Продолжить как ученик →"
            onClick={onStudent}
          />
          <RoleRow
            index="02"
            accent="var(--pf-cinnabar)"
            role="преподаватель"
            title="Я веду учеников по карте"
            description="Профили учеников, слабые темы, индивидуальные маршруты."
            action={teacherPending ? "Сохранение…" : "Войти как преподаватель →"}
            disabled={teacherPending}
            onClick={onTeacher}
          />
        </div>
      </div>
      <Monogram />
    </main>
  );
}

// -------------------- Steps --------------------

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <p className="pf-eyebrow mb-4">знакомство</p>
      <h1
        className="pf-h1 leading-[0.95]"
        style={{ fontSize: "clamp(44px, 6.5vw, 84px)" }}
      >
        Добро пожаловать <br />в <span style={{ color: "var(--pf-mustard)" }}>Pathy</span>.
      </h1>
      <span
        aria-hidden
        className="block mt-6"
        style={{ width: 72, height: 2, background: "var(--pf-cinnabar)" }}
      />
      <p className="pf-lead mt-8" style={{ maxWidth: "52ch" }}>
        Давайте познакомимся. Несколько коротких вопросов помогут сделать обучение более
        подходящим именно для вас — займёт три-пять минут.
      </p>
      <div className="mt-12">
        <Button size="lg" onClick={onNext}>
          Начать →
        </Button>
      </div>
    </div>
  );
}

function StepGoals({
  answers,
  setAnswers,
  onNext,
  canNext,
}: StepProps) {
  const toggle = (id: string) =>
    setAnswers((a) => ({
      ...a,
      goals: a.goals.includes(id) ? a.goals.filter((g) => g !== id) : [...a.goals, id],
    }));

  return (
    <StepFrame
      eyebrow="цель"
      title={
        <>
          Что сейчас <span style={{ color: "var(--pf-mustard)" }}>важно</span>?
        </>
      }
      lead="Можно выбрать несколько вариантов."
      onNext={onNext}
      canNext={canNext}
    >
      <div className="grid gap-2">
        {GOAL_OPTIONS.map((o) => (
          <OptionRow
            key={o.id}
            selected={answers.goals.includes(o.id)}
            label={o.label}
            onClick={() => toggle(o.id)}
          />
        ))}
        <div className="pt-2">
          <p className="pf-eyebrow mb-2">Другое</p>
          <Input
            value={answers.goalOther}
            onChange={(e) => setAnswers({ ...answers, goalOther: e.target.value })}
            placeholder="Опишите своими словами (по желанию)"
            className="pf-input-line"
          />
        </div>
      </div>
    </StepFrame>
  );
}

function StepProgram({
  answers,
  setAnswers,
  onNext,
  canNext,
}: StepProps) {
  return (
    <StepFrame
      eyebrow="программа"
      title={
        <>
          По какой программе <span style={{ color: "var(--pf-mustard)" }}>готовитесь</span>?
        </>
      }
      lead="Это определит, какие предметы показать дальше."
      onNext={onNext}
      canNext={canNext}
    >
      <div className="grid gap-2">
        {PROGRAM_OPTIONS.map((p) => (
          <OptionRow
            key={p.id}
            selected={answers.program === p.id}
            label={p.label}
            sub={p.hint}
            disabled={p.disabled}
            onClick={() => !p.disabled && setAnswers({ ...answers, program: p.id, subjects: new Set() })}
          />
        ))}
      </div>
    </StepFrame>
  );
}

function StepSubjects({
  answers,
  setAnswers,
  onNext,
  canNext,
}: StepProps) {
  const listFn = useServerFn(listSubjects);
  const subjectsQ = useQuery({
    queryKey: ["onboarding-subjects"],
    queryFn: () => listFn(),
  });

  const filtered = useMemo(() => {
    const all = (subjectsQ.data ?? []) as any[];
    if (!answers.program) return all;
    // Match subjects.exam_type to selected program; if none exist, fall back to all
    const forProgram = all.filter(
      (s) => (s.exam_type ?? "").toUpperCase() === answers.program,
    );
    return forProgram.length > 0 ? forProgram : all;
  }, [subjectsQ.data, answers.program]);

  const toggle = (id: string) => {
    const next = new Set(answers.subjects);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAnswers({ ...answers, subjects: next });
  };

  return (
    <StepFrame
      eyebrow="предметы"
      title={
        <>
          Какие предметы сейчас <span style={{ color: "var(--pf-mustard)" }}>важны</span>?
        </>
      }
      lead="Отметьте всё, чем занимаетесь. Можно выбрать несколько."
      onNext={onNext}
      canNext={canNext}
    >
      {subjectsQ.isLoading ? (
        <p className="text-sm text-[color:var(--pf-muted)]">Загрузка…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[color:var(--pf-muted)]">
          Для выбранной программы пока нет предметов. Мы добавим их позже.
        </p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((s: any) => (
            <OptionRow
              key={s.id}
              selected={answers.subjects.has(s.id)}
              label={s.name}
              sub={s.description ?? undefined}
              onClick={() => toggle(s.id)}
            />
          ))}
        </div>
      )}
    </StepFrame>
  );
}

function StepAssessment({
  answers,
  setAnswers,
  onNext,
  canNext,
}: StepProps) {
  return (
    <StepFrame
      eyebrow="самооценка"
      title={
        <>
          Как оцениваете свою <span style={{ color: "var(--pf-mustard)" }}>подготовку</span>?
        </>
      }
      lead="Не школьная оценка — субъективное ощущение."
      onNext={onNext}
      canNext={canNext}
    >
      <div className="grid gap-2">
        {ASSESSMENT_OPTIONS.map((o) => (
          <OptionRow
            key={o.id}
            index={String(o.n).padStart(2, "0")}
            selected={answers.assessment === o.id}
            label={o.label}
            onClick={() => setAnswers({ ...answers, assessment: o.id })}
          />
        ))}
      </div>
    </StepFrame>
  );
}

function StepBarriers({
  answers,
  setAnswers,
  onNext,
  canNext,
}: StepProps) {
  const toggle = (id: string) =>
    setAnswers((a) => ({
      ...a,
      barriers: a.barriers.includes(id) ? a.barriers.filter((b) => b !== id) : [...a.barriers, id],
    }));

  return (
    <StepFrame
      eyebrow="барьеры"
      title={
        <>
          Что обычно <span style={{ color: "var(--pf-mustard)" }}>мешает</span>?
        </>
      }
      lead="Можно выбрать несколько. Пропустите, если ничего не подходит."
      onNext={onNext}
      canNext={canNext}
    >
      <div className="grid gap-2">
        {BARRIER_OPTIONS.map((o) => (
          <OptionRow
            key={o.id}
            selected={answers.barriers.includes(o.id)}
            label={o.label}
            onClick={() => toggle(o.id)}
          />
        ))}
        <div className="pt-2">
          <p className="pf-eyebrow mb-2">Другое</p>
          <Input
            value={answers.barrierOther}
            onChange={(e) => setAnswers({ ...answers, barrierOther: e.target.value })}
            placeholder="Опишите своими словами (по желанию)"
            className="pf-input-line"
          />
        </div>
      </div>
    </StepFrame>
  );
}

function StepTime({
  answers,
  setAnswers,
  onNext,
  canNext,
}: StepProps) {
  return (
    <StepFrame
      eyebrow="ритм"
      title={
        <>
          Сколько времени готовы <span style={{ color: "var(--pf-mustard)" }}>уделять</span>?
        </>
      }
      lead="В день. Это нужно для расчёта маршрута."
      onNext={onNext}
      canNext={canNext}
    >
      <div className="grid gap-2">
        {TIME_OPTIONS.map((o) => (
          <OptionRow
            key={o.id}
            selected={answers.time === o.id}
            label={o.label}
            onClick={() => setAnswers({ ...answers, time: o.id })}
          />
        ))}
      </div>
    </StepFrame>
  );
}

function StepSummary({ answers }: { answers: Answers }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listSubjects);
  const completeFn = useServerFn(completeStudentOnboarding);

  const subjectsQ = useQuery({
    queryKey: ["onboarding-subjects"],
    queryFn: () => listFn(),
  });

  const subjectNames = useMemo(() => {
    const all = (subjectsQ.data ?? []) as any[];
    return all
      .filter((s) => answers.subjects.has(s.id))
      .map((s) => s.name as string);
  }, [subjectsQ.data, answers.subjects]);

  const summary = useMemo(
    () => buildSummary(answers, subjectNames),
    [answers, subjectNames],
  );

  const submit = useMutation({
    mutationFn: async () => {
      const goalsCombined = [
        ...answers.goals.map((id) => GOAL_OPTIONS.find((g) => g.id === id)?.label ?? id),
        ...(answers.goalOther.trim() ? [answers.goalOther.trim()] : []),
      ];
      const barriersCombined = [
        ...answers.barriers.map(
          (id) => BARRIER_OPTIONS.find((b) => b.id === id)?.label ?? id,
        ),
        ...(answers.barrierOther.trim() ? [answers.barrierOther.trim()] : []),
      ];
      return completeFn({
        data: {
          subjects: Array.from(answers.subjects).map((subject_id) => ({
            subject_id,
            program_id: null,
          })),
          target_program: answers.program,
          target_exam: answers.program?.toLowerCase() ?? null,
          learning_goals: goalsCombined,
          learning_goal: goalsCombined.join("; ") || null,
          self_assessment: answers.assessment,
          learning_barriers: barriersCombined,
          available_time: answers.time,
        },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-role"] });
      await qc.invalidateQueries({ queryKey: ["my-student-subjects"] });
      toast.success("Профиль создан");
      navigate({ to: "/student/diagnostic" });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Не удалось завершить онбординг"),
  });

  return (
    <div>
      <p className="pf-eyebrow mb-4">первая сводка</p>
      <h1 className="pf-h1" style={{ fontSize: "clamp(36px, 5vw, 60px)", maxWidth: "20ch" }}>
        Остался последний <span style={{ color: "var(--pf-mustard)" }}>шаг</span>
      </h1>
      <span
        aria-hidden
        className="block mt-6"
        style={{ width: 72, height: 2, background: "var(--pf-cinnabar)" }}
      />

      <div className="mt-10 space-y-6">
        {summary.map((paragraph, i) => (
          <p
            key={i}
            className="text-[17px] leading-relaxed"
            style={{ color: "var(--pf-ink)", maxWidth: "58ch" }}
          >
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-14 grid gap-3 sm:flex sm:items-center sm:gap-6">
        <Button
          size="lg"
          onClick={() => submit.mutate()}
          disabled={submit.isPending}
        >
          {submit.isPending ? "Сохраняем…" : "Начать диагностику →"}
        </Button>
        <p className="text-[13px]" style={{ color: "var(--pf-muted)", maxWidth: "42ch" }}>
          Диагностика займёт около 10 минут и определит стартовую точку маршрута.
        </p>
      </div>
    </div>
  );
}

// -------------------- Presentational bits --------------------

type StepProps = {
  answers: Answers;
  setAnswers: React.Dispatch<React.SetStateAction<Answers>>;
  onNext: () => void;
  canNext: boolean;
};

function StepFrame({
  eyebrow,
  title,
  lead,
  children,
  onNext,
  canNext,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
  children: React.ReactNode;
  onNext: () => void;
  canNext: boolean;
}) {
  return (
    <div>
      <p className="pf-eyebrow mb-3">{eyebrow}</p>
      <h1 className="pf-h1" style={{ fontSize: "clamp(32px, 4.5vw, 52px)", maxWidth: "22ch" }}>
        {title}
      </h1>
      <span
        aria-hidden
        className="block mt-4"
        style={{ width: 56, height: 2, background: "var(--pf-cinnabar)" }}
      />
      {lead ? <p className="pf-lead mt-6">{lead}</p> : null}

      <div className="mt-10">{children}</div>

      <div className="mt-12 flex items-center justify-between">
        <span className="pf-eyebrow" style={{ color: "var(--pf-muted)" }}>
          {canNext ? "готово — можно продолжать" : "выберите вариант"}
        </span>
        <Button size="lg" onClick={onNext} disabled={!canNext}>
          Дальше →
        </Button>
      </div>
    </div>
  );
}

function OptionRow({
  index,
  selected,
  label,
  sub,
  disabled,
  onClick,
}: {
  index?: string;
  selected: boolean;
  label: string;
  sub?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative w-full text-left grid grid-cols-[auto,1fr,auto] items-center gap-4 py-4 px-4 -mx-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        borderTop: "1px solid var(--pf-line)",
        background: selected
          ? "color-mix(in oklab, var(--pf-mustard) 12%, transparent)"
          : "transparent",
      }}
    >
      <span
        aria-hidden
        className="inline-block h-3 w-3"
        style={{
          background: selected ? "var(--pf-mustard)" : "transparent",
          border: `1.5px solid ${selected ? "var(--pf-mustard)" : "var(--pf-line-strong)"}`,
        }}
      />
      <span>
        {index ? (
          <span
            className="font-mono text-[11px] tracking-[0.2em] mr-3"
            style={{ color: "var(--pf-muted)" }}
          >
            {index}
          </span>
        ) : null}
        <span className="text-[15px] font-medium" style={{ color: "var(--pf-ink)" }}>
          {label}
        </span>
        {sub ? (
          <span
            className="block mt-1 text-[13px]"
            style={{ color: "var(--pf-muted)" }}
          >
            {sub}
          </span>
        ) : null}
      </span>
      <span
        className="font-mono text-[11px] uppercase tracking-widest"
        style={{ color: selected ? "var(--pf-mustard)" : "var(--pf-muted)" }}
      >
        {selected ? "выбрано" : "→"}
      </span>
    </button>
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
  disabled,
}: {
  index: string;
  accent: string;
  role: string;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      disabled={disabled}
      className="group relative text-left grid gap-3 py-8 border-t border-[color:var(--pf-line-strong)] last:border-b transition-colors px-2 -mx-2 disabled:opacity-60 w-full"
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-px transition-[width] duration-[400ms] ease-out"
        style={{ width: hover ? "100%" : "0%", background: accent }}
      />
      <div className="flex items-baseline gap-6">
        <span
          className="font-mono text-[12px] tracking-[0.2em]"
          style={{ minWidth: 40, color: hover ? accent : "var(--pf-ink)" }}
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
        className="pl-[64px] pf-eyebrow mt-2"
        style={{ color: hover ? accent : "var(--pf-mustard)" }}
      >
        {action}
      </span>
    </button>
  );
}

function FullscreenNote({ text }: { text: string }) {
  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--pf-paper)" }}
    >
      <p className="pf-lead">{text}</p>
    </main>
  );
}

function Monogram() {
  return (
    <div
      aria-hidden
      className="hidden md:block fixed bottom-8 right-8 pointer-events-none"
      style={{ width: 40, height: 40 }}
    >
      <div className="relative w-full h-full">
        <span className="absolute inset-0" style={{ background: "var(--pf-ink)" }} />
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

// -------------------- Algorithmic summary --------------------

function buildSummary(a: Answers, subjectNames: string[]): string[] {
  const paragraphs: string[] = [];

  const programLabel =
    a.program === "OGE"
      ? "к ОГЭ (9 класс)"
      : a.program === "EGE"
        ? "к ЕГЭ (11 класс)"
        : "к обучению";

  const subjectsSentence = joinRu(subjectNames);
  const goalLabels = a.goals
    .map((id) => GOAL_OPTIONS.find((g) => g.id === id)?.label ?? "")
    .filter(Boolean);
  const primaryGoal = goalLabels[0]?.toLowerCase() ?? null;

  // Paragraph 1 — цель + предметы
  if (subjectsSentence) {
    paragraphs.push(
      primaryGoal
        ? `Сейчас ваша главная цель — ${primaryGoal.replace(/^подготовиться\s+/i, "подготовка ")}${
            subjectsSentence ? ` по предметам: ${subjectsSentence}.` : "."
          }`
        : `Вы готовитесь ${programLabel}. Выбранные предметы: ${subjectsSentence}.`,
    );
  } else {
    paragraphs.push(`Вы готовитесь ${programLabel}.`);
  }

  // Paragraph 2 — самооценка + барьеры
  const assessmentPhrase = (() => {
    switch (a.assessment) {
      case "beginner":
        return "вы только начинаете погружение в материал";
      case "basic":
        return "у вас уже есть базовые знания, на которые можно опереться";
      case "confident":
        return "вы уверенно чувствуете себя в материале";
      case "ready":
        return "вы уже близки к экзаменационному уровню";
      default:
        return null;
    }
  })();

  const barrierMap: Record<string, string> = {
    gaps: "закрыть пробелы в темах",
    forget: "закрепить материал, чтобы он не забывался",
    system: "получить понятную систему подготовки",
    rare: "выстроить регулярность занятий",
    anxiety: "снизить тревогу перед экзаменом",
    careless: "уменьшить количество ошибок по невнимательности",
    time: "рационально распорядиться временем",
    start: "легче начинать занятия",
    direction: "понимать, что учить следующим шагом",
  };
  const barrierNeeds = a.barriers
    .map((id) => barrierMap[id])
    .filter(Boolean)
    .slice(0, 3);

  if (assessmentPhrase && barrierNeeds.length > 0) {
    paragraphs.push(
      `По вашим ответам видно, что ${assessmentPhrase}, и сейчас важнее всего ${joinRu(
        barrierNeeds,
      )}.`,
    );
  } else if (assessmentPhrase) {
    paragraphs.push(`По вашим ответам видно, что ${assessmentPhrase}.`);
  } else if (barrierNeeds.length > 0) {
    paragraphs.push(
      `По вашим ответам видно, что сейчас важнее всего ${joinRu(barrierNeeds)}.`,
    );
  }

  // Paragraph 3 — время + переход к диагностике
  const timeLabel = TIME_OPTIONS.find((t) => t.id === a.time)?.label;
  if (timeLabel) {
    paragraphs.push(
      `Комфортный ритм — ${timeLabel} в день. Это хороший момент, чтобы определить вашу стартовую точку.`,
    );
  } else {
    paragraphs.push("Это хороший момент, чтобы определить вашу стартовую точку.");
  }

  paragraphs.push(
    "После диагностики Pathy построит персональный маршрут: последовательность тем, занятия и материалы под ваши цели.",
  );

  return paragraphs;
}

function joinRu(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  const head = items.slice(0, -1).join(", ");
  return `${head} и ${items[items.length - 1]}`;
}
