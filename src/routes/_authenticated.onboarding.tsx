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

const EDUCATION_SYSTEMS: {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}[] = [
  { id: "ru_school", label: "Российская школа" },
  { id: "es_school", label: "Испанская школа", hint: "скоро появится", disabled: true },
  { id: "ib", label: "IB", hint: "скоро появится", disabled: true },
  { id: "a_level", label: "A-Level", hint: "скоро появится", disabled: true },
  { id: "other", label: "Другая программа", hint: "скоро появится", disabled: true },
];

const RU_GRADES = Array.from({ length: 11 }, (_, i) => {
  const n = i + 1;
  return {
    id: String(n),
    label: `${n} класс`,
    disabled: n !== 9 && n !== 11,
    hint: n !== 9 && n !== 11 ? "скоро появится" : undefined,
  };
});

// Fallback subject lists by grade (used when DB doesn't return matching subjects).
const FALLBACK_SUBJECTS: Record<string, { slug: string; name: string }[]> = {
  "9": [
    { slug: "russian", name: "Русский язык" },
    { slug: "mathematics", name: "Математика" },
    { slug: "english", name: "Английский язык" },
    { slug: "biology", name: "Биология" },
    { slug: "physics", name: "Физика" },
    { slug: "chemistry", name: "Химия" },
    { slug: "informatics", name: "Информатика" },
    { slug: "history", name: "История" },
    { slug: "social_studies", name: "Обществознание" },
    { slug: "geography", name: "География" },
    { slug: "literature", name: "Литература" },
  ],
  "11": [
    { slug: "russian", name: "Русский язык" },
    { slug: "mathematics", name: "Математика" },
    { slug: "english", name: "Английский язык" },
    { slug: "biology", name: "Биология" },
    { slug: "physics", name: "Физика" },
    { slug: "chemistry", name: "Химия" },
    { slug: "informatics", name: "Информатика" },
    { slug: "history", name: "История" },
    { slug: "social_studies", name: "Обществознание" },
    { slug: "geography", name: "География" },
    { slug: "literature", name: "Литература" },
  ],
};

const GOAL_OPTIONS_BASE = [
  { id: "school", label: "Подтянуть школьную программу" },
  { id: "gaps", label: "Закрыть пробелы" },
  { id: "confidence", label: "Стать увереннее в предмете" },
  { id: "grades", label: "Улучшить оценки" },
  { id: "university", label: "Подготовиться к поступлению" },
  { id: "hard_topics", label: "Разобраться в сложных темах" },
];

const ASSESSMENT_OPTIONS = [
  { id: "beginner", label: "Пока только начинаю", n: 1 },
  { id: "basic", label: "Есть базовые знания", n: 2 },
  { id: "mixed", label: "Где-то понимаю, где-то теряюсь", n: 3 },
  { id: "confident", label: "Чувствую себя уверенно", n: 4 },
  { id: "ready", label: "Почти готов к экзамену", n: 5 },
];

const BARRIER_OPTIONS = [
  { id: "gaps", label: "Не понимаю некоторые темы" },
  { id: "forget", label: "Быстро забываю" },
  { id: "system", label: "Не хватает системы" },
  { id: "rare", label: "Редко занимаюсь" },
  { id: "anxiety", label: "Волнуюсь перед проверками или экзаменами" },
  { id: "careless", label: "Ошибаюсь по невнимательности" },
  { id: "time", label: "Не хватает времени" },
  { id: "start", label: "Трудно начать" },
  { id: "direction", label: "Не знаю, что учить дальше" },
  { id: "boring", label: "Материал кажется скучным" },
];

const TIME_OPTIONS = [
  { id: "15-20", label: "15–20 минут в день" },
  { id: "30-40", label: "30–40 минут в день" },
  { id: "60", label: "Около часа в день" },
  { id: "60-120", label: "1–2 часа в день" },
  { id: "weekly", label: "Несколько раз в неделю" },
  { id: "unknown", label: "Пока не знаю" },
];

// -------------------- State --------------------

type Answers = {
  educationSystem: string | null;
  grade: string | null;
  subjects: string[]; // subject ids (uuid) OR fallback slug tokens
  goals: string[];
  goalOther: string;
  assessment: string | null;
  barriers: string[];
  barrierOther: string;
  time: string | null;
};

const initial: Answers = {
  educationSystem: null,
  grade: null,
  subjects: [],
  goals: [],
  goalOther: "",
  assessment: null,
  barriers: [],
  barrierOther: "",
  time: null,
};

const TOTAL_STEPS = 9;

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

  const canNext = validateStep(step, answers);
  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () =>
    step === 1 ? setRole(null) : setStep((s) => Math.max(1, s - 1));

  return (
    <WizardChrome step={step} total={TOTAL_STEPS} onBack={back}>
      {step === 1 && <StepWelcome onNext={next} />}
      {step === 2 && (
        <StepEducationSystem
          answers={answers}
          setAnswers={setAnswers}
          onNext={next}
          canNext={canNext}
        />
      )}
      {step === 3 && (
        <StepGrade
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
        <StepGoals
          answers={answers}
          setAnswers={setAnswers}
          onNext={next}
          canNext={canNext}
        />
      )}
      {step === 6 && (
        <StepAssessment
          answers={answers}
          setAnswers={setAnswers}
          onNext={next}
          canNext={canNext}
        />
      )}
      {step === 7 && (
        <StepBarriers
          answers={answers}
          setAnswers={setAnswers}
          onNext={next}
          canNext={canNext}
        />
      )}
      {step === 8 && (
        <StepTime
          answers={answers}
          setAnswers={setAnswers}
          onNext={next}
          canNext={canNext}
        />
      )}
      {step === 9 && <StepSummary answers={answers} />}
    </WizardChrome>
  );
}

function validateStep(step: number, a: Answers): boolean {
  switch (step) {
    case 1:
      return true;
    case 2:
      return !!a.educationSystem;
    case 3:
      return !!a.grade;
    case 4:
      return a.subjects.length > 0;
    case 5:
      return a.goals.length > 0 || a.goalOther.trim().length > 0;
    case 6:
      return !!a.assessment;
    case 7:
      return true;
    case 8:
      return !!a.time;
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
        <div className="pf-section-eyebrow">
          <span className="pf-section-eyebrow__label inline-flex items-center gap-3">
            <PathyLogo size="sm" />
            <span>
              / онбординг · шаг {String(step).padStart(2, "0")} из{" "}
              {String(total).padStart(2, "0")}
            </span>
          </span>
          <button
            type="button"
            onClick={onBack}
            className="pf-section-eyebrow__label hover:text-[color:var(--pf-ink)] transition-colors"
          >
            ← назад
          </button>
        </div>

        <div className="mt-6 h-[2px] w-full" style={{ background: "var(--pf-line)" }}>
          <div
            className="h-full transition-[width] duration-500 ease-out"
            style={{ width: `${(step / total) * 100}%`, background: "var(--pf-mustard)" }}
          />
        </div>

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
          <h1
            className="pf-h1 leading-[0.95]"
            style={{ fontSize: "clamp(48px, 7vw, 88px)" }}
          >
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
        Добро пожаловать <br />в{" "}
        <span style={{ color: "var(--pf-mustard)" }}>Pathy</span>.
      </h1>
      <span
        aria-hidden
        className="block mt-6"
        style={{ width: 72, height: 2, background: "var(--pf-cinnabar)" }}
      />
      <p className="pf-lead mt-8" style={{ maxWidth: "52ch" }}>
        Несколько коротких вопросов помогут настроить обучение под вашу
        ситуацию. Займёт три-пять минут.
      </p>
      <div className="mt-12">
        <Button size="lg" onClick={onNext}>
          Начать →
        </Button>
      </div>
    </div>
  );
}

function StepEducationSystem({ answers, setAnswers, onNext, canNext }: StepProps) {
  return (
    <StepFrame
      eyebrow="программа"
      title={
        <>
          По какой программе <span style={{ color: "var(--pf-mustard)" }}>учитесь</span>?
        </>
      }
      lead="Это определит, какие классы и предметы показать дальше."
      onNext={onNext}
      canNext={canNext}
    >
      <div className="grid gap-2">
        {EDUCATION_SYSTEMS.map((p) => (
          <OptionRow
            key={p.id}
            selected={answers.educationSystem === p.id}
            label={p.label}
            sub={p.hint}
            disabled={p.disabled}
            onClick={() =>
              !p.disabled &&
              setAnswers({ ...answers, educationSystem: p.id, grade: null, subjects: [] })
            }
          />
        ))}
      </div>
    </StepFrame>
  );
}

function StepGrade({ answers, setAnswers, onNext, canNext }: StepProps) {
  const grades = answers.educationSystem === "ru_school" ? RU_GRADES : [];
  return (
    <StepFrame
      eyebrow="класс"
      title={
        <>
          В каком вы <span style={{ color: "var(--pf-mustard)" }}>классе</span>?
        </>
      }
      lead="Пока доступны 9 и 11 классы. Остальные скоро появятся."
      onNext={onNext}
      canNext={canNext}
    >
      {grades.length === 0 ? (
        <p className="text-sm text-[color:var(--pf-muted)]">
          Для выбранной программы классы пока не добавлены.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {grades.map((g) => (
            <OptionRow
              key={g.id}
              selected={answers.grade === g.id}
              label={g.label}
              sub={g.hint}
              disabled={g.disabled}
              onClick={() =>
                !g.disabled && setAnswers({ ...answers, grade: g.id, subjects: [] })
              }
            />
          ))}
        </div>
      )}
    </StepFrame>
  );
}

function StepSubjects({ answers, setAnswers, onNext, canNext }: StepProps) {
  const listFn = useServerFn(listSubjects);
  const subjectsQ = useQuery({
    queryKey: ["onboarding-subjects"],
    queryFn: async () => {
      const res = await listFn();
      return Array.isArray(res) ? res : [];
    },
  });

  // Match DB subjects to grade via exam_type (OGE/EGE); fallback to grade list.
  const items = useMemo(() => {
    const all = Array.isArray(subjectsQ.data) ? (subjectsQ.data as any[]) : [];
    const grade = answers.grade;
    const examWanted = grade === "9" ? "OGE" : grade === "11" ? "EGE" : null;

    let matched: { id: string; name: string; sub?: string }[] = [];
    if (examWanted) {
      matched = all
        .filter((s) => (s?.exam_type ?? "").toString().toUpperCase() === examWanted)
        .map((s) => ({ id: s.id, name: s.name, sub: s.description ?? undefined }));
    }

    if (matched.length === 0 && grade && FALLBACK_SUBJECTS[grade]) {
      // Try to map fallback slugs to real DB subjects; if not found, use slug token.
      matched = FALLBACK_SUBJECTS[grade].map((f) => {
        const dbMatch = all.find(
          (s) => (s?.slug ?? "") === f.slug || (s?.name ?? "") === f.name,
        );
        return dbMatch
          ? { id: dbMatch.id, name: dbMatch.name }
          : { id: `slug:${f.slug}`, name: f.name };
      });
    }

    return matched;
  }, [subjectsQ.data, answers.grade]);

  const toggle = (id: string) => {
    const cur = Array.isArray(answers.subjects) ? answers.subjects : [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
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
      ) : subjectsQ.isError ? (
        <p className="text-sm text-[color:var(--pf-muted)]">
          Не удалось загрузить предметы. Попробуйте ещё раз.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[color:var(--pf-muted)]">
          Для этого класса предметы пока не добавлены.
        </p>
      ) : (
        <div className="grid gap-2">
          {items.map((s) => (
            <OptionRow
              key={s.id}
              selected={answers.subjects.includes(s.id)}
              label={s.name}
              sub={s.sub}
              onClick={() => toggle(s.id)}
            />
          ))}
        </div>
      )}
    </StepFrame>
  );
}

function StepGoals({ answers, setAnswers, onNext, canNext }: StepProps) {
  const options = useMemo(() => {
    const list = [...GOAL_OPTIONS_BASE];
    if (answers.grade === "9") list.unshift({ id: "oge", label: "Подготовиться к ОГЭ" });
    if (answers.grade === "11") list.unshift({ id: "ege", label: "Подготовиться к ЕГЭ" });
    return list;
  }, [answers.grade]);

  const toggle = (id: string) => {
    const cur = Array.isArray(answers.goals) ? answers.goals : [];
    const next = cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id];
    setAnswers({ ...answers, goals: next });
  };

  return (
    <StepFrame
      eyebrow="цель"
      title={
        <>
          Что для вас сейчас <span style={{ color: "var(--pf-mustard)" }}>главное</span>?
        </>
      }
      lead="Можно выбрать несколько вариантов."
      onNext={onNext}
      canNext={canNext}
    >
      <div className="grid gap-2">
        {options.map((o) => (
          <OptionRow
            key={o.id}
            selected={(answers.goals ?? []).includes(o.id)}
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

function StepAssessment({ answers, setAnswers, onNext, canNext }: StepProps) {
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

function StepBarriers({ answers, setAnswers, onNext, canNext }: StepProps) {
  const toggle = (id: string) => {
    const cur = Array.isArray(answers.barriers) ? answers.barriers : [];
    const next = cur.includes(id) ? cur.filter((b) => b !== id) : [...cur, id];
    setAnswers({ ...answers, barriers: next });
  };

  return (
    <StepFrame
      eyebrow="барьеры"
      title={
        <>
          Что чаще всего <span style={{ color: "var(--pf-mustard)" }}>мешает</span>?
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
            selected={(answers.barriers ?? []).includes(o.id)}
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

function StepTime({ answers, setAnswers, onNext, canNext }: StepProps) {
  return (
    <StepFrame
      eyebrow="ритм"
      title={
        <>
          Сколько времени готовы <span style={{ color: "var(--pf-mustard)" }}>уделять</span>?
        </>
      }
      lead="Реалистично, а не идеально."
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
    queryFn: async () => {
      const res = await listFn();
      return Array.isArray(res) ? res : [];
    },
  });

  // Resolve subject names — from DB when uuid, from fallback slug otherwise.
  const { subjectNames, dbSubjectIds } = useMemo(() => {
    const all = Array.isArray(subjectsQ.data) ? (subjectsQ.data as any[]) : [];
    const selected = Array.isArray(answers.subjects) ? answers.subjects : [];
    const fallback = answers.grade ? FALLBACK_SUBJECTS[answers.grade] ?? [] : [];
    const names: string[] = [];
    const dbIds: string[] = [];
    for (const id of selected) {
      if (id.startsWith("slug:")) {
        const slug = id.slice(5);
        const f = fallback.find((x) => x.slug === slug);
        if (f) names.push(f.name);
      } else {
        const s = all.find((x) => x.id === id);
        if (s) {
          names.push(s.name);
          dbIds.push(s.id);
        }
      }
    }
    return { subjectNames: names, dbSubjectIds: dbIds };
  }, [subjectsQ.data, answers.subjects, answers.grade]);

  const summaryParagraphs = useMemo(
    () => buildSummary(answers, subjectNames),
    [answers, subjectNames],
  );

  const goalLabels = useMemo(() => {
    const options = [
      { id: "oge", label: "Подготовиться к ОГЭ" },
      { id: "ege", label: "Подготовиться к ЕГЭ" },
      ...GOAL_OPTIONS_BASE,
    ];
    return (answers.goals ?? []).map(
      (id) => options.find((g) => g.id === id)?.label ?? id,
    );
  }, [answers.goals]);

  const targetExam =
    (answers.goals ?? []).includes("oge")
      ? "OGE"
      : (answers.goals ?? []).includes("ege")
        ? "EGE"
        : null;

  const submit = useMutation({
    mutationFn: async () => {
      const barriersCombined = (answers.barriers ?? []).map(
        (id) => BARRIER_OPTIONS.find((b) => b.id === id)?.label ?? id,
      );
      const summaryText = summaryParagraphs.join("\n\n");

      if (dbSubjectIds.length === 0) {
        throw new Error(
          "Выбранные предметы пока не заведены в системе. Пожалуйста, выберите хотя бы один доступный предмет.",
        );
      }

      return completeFn({
        data: {
          subjects: dbSubjectIds.map((subject_id) => ({
            subject_id,
            program_id: null,
          })),
          education_system: answers.educationSystem,
          grade: answers.grade,
          target_program: answers.grade
            ? `ru_school_grade_${answers.grade}`
            : null,
          target_exam: targetExam,
          learning_goals: goalLabels,
          learning_goal: goalLabels.join("; ") || null,
          custom_learning_goal: answers.goalOther.trim() || null,
          self_assessment: answers.assessment,
          learning_barriers: barriersCombined,
          custom_learning_barrier: answers.barrierOther.trim() || null,
          available_time: answers.time,
          onboarding_summary: summaryText,
        },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-role"] });
      await qc.invalidateQueries({ queryKey: ["my-student-subjects"] });
      toast.success("Профиль создан");
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Не удалось завершить онбординг"),
  });

  const goDiagnostic = async () => {
    if (!submit.isSuccess) await submit.mutateAsync();
    navigate({ to: "/student/diagnostic" });
  };
  const goDashboard = async () => {
    if (!submit.isSuccess) await submit.mutateAsync();
    navigate({ to: "/student" });
  };

  return (
    <div>
      <p className="pf-eyebrow mb-4">первая сводка</p>
      <h1
        className="pf-h1"
        style={{ fontSize: "clamp(36px, 5vw, 60px)", maxWidth: "20ch" }}
      >
        Остался последний <span style={{ color: "var(--pf-mustard)" }}>шаг</span>
      </h1>
      <span
        aria-hidden
        className="block mt-6"
        style={{ width: 72, height: 2, background: "var(--pf-cinnabar)" }}
      />

      <div className="mt-10 space-y-6">
        {summaryParagraphs.map((paragraph, i) => (
          <p
            key={i}
            className="text-[17px] leading-relaxed"
            style={{ color: "var(--pf-ink)", maxWidth: "58ch" }}
          >
            {paragraph}
          </p>
        ))}
      </div>

      <p
        className="mt-10 text-[15px] leading-relaxed"
        style={{ color: "var(--pf-muted)", maxWidth: "58ch" }}
      >
        Мы уже понимаем вашу цель и условия обучения. Теперь нужно определить
        стартовый уровень знаний — после этого Pathy сможет построить
        персональный маршрут.
      </p>

      <div className="mt-12 grid gap-3 sm:flex sm:items-center sm:gap-6">
        <Button size="lg" onClick={goDiagnostic} disabled={submit.isPending}>
          {submit.isPending ? "Сохраняем…" : "Начать диагностику →"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={goDashboard}
          disabled={submit.isPending}
        >
          Перейти в кабинет
        </Button>
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
      <h1
        className="pf-h1"
        style={{ fontSize: "clamp(32px, 4.5vw, 52px)", maxWidth: "22ch" }}
      >
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
        <span
          className="text-[15px] font-medium"
          style={{ color: "var(--pf-ink)" }}
        >
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
  const goals = Array.isArray(a.goals) ? a.goals : [];
  const barriers = Array.isArray(a.barriers) ? a.barriers : [];

  const goalMap: Record<string, string> = {
    oge: "подготовка к ОГЭ",
    ege: "подготовка к ЕГЭ",
    school: "укрепление школьной программы",
    gaps: "закрытие пробелов",
    confidence: "уверенность в предмете",
    grades: "улучшение оценок",
    university: "подготовка к поступлению",
    hard_topics: "разбор сложных тем",
  };
  const goalPhrases = goals.map((g) => goalMap[g]).filter(Boolean);

  const subjectsSentence = joinRu(subjectNames);

  if (goalPhrases.length > 0) {
    const primary = goalPhrases.slice(0, 2).join(" и ");
    paragraphs.push(
      subjectsSentence
        ? `Сейчас ваша главная цель — ${primary}. Вы выбрали ${subjectsSentence}.`
        : `Сейчас ваша главная цель — ${primary}.`,
    );
  } else if (subjectsSentence) {
    paragraphs.push(`Вы выбрали ${subjectsSentence}.`);
  }

  const assessmentPhrase = (() => {
    switch (a.assessment) {
      case "beginner":
        return "вы только начинаете погружение в материал";
      case "basic":
        return "у вас уже есть базовые знания, на которые можно опереться";
      case "mixed":
        return "в одних темах вы уверены, в других теряетесь";
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
    anxiety: "снизить тревогу перед проверками",
    careless: "уменьшить количество ошибок по невнимательности",
    time: "рационально распорядиться временем",
    start: "легче начинать занятия",
    direction: "понимать, что учить следующим шагом",
    boring: "сделать материал понятнее и живее",
  };
  const barrierNeeds = barriers
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

  const timeLabel = TIME_OPTIONS.find((t) => t.id === a.time)?.label;
  if (timeLabel) {
    paragraphs.push(
      `Комфортный ритм — ${timeLabel.toLowerCase()}. Следующий шаг — определить стартовый уровень знаний.`,
    );
  } else {
    paragraphs.push(
      "Следующий шаг — определить стартовый уровень знаний. После этого Pathy сможет предложить маршрут.",
    );
  }

  return paragraphs;
}

function joinRu(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  const head = items.slice(0, -1).join(", ");
  return `${head} и ${items[items.length - 1]}`;
}
