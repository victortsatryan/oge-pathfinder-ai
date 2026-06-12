import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/oge/page-header";
import { ConstructivistIllo } from "@/components/oge/constructivist-illo";

export const Route = createFileRoute("/_authenticated/student/")({
  component: StudentHome,
});

const TODAY_LESSON = {
  time: "11:00",
  subject: "Математика",
  topic: "Квадратные уравнения",
  tag: "важная тема",
};

const PROBLEM_ZONES = [
  { subject: "Математика", topic: "Квадратные уравнения", level: "низкий", tone: "cinnabar" as const },
  { subject: "Русский язык", topic: "Пунктуация в сложном предложении", level: "средний", tone: "mustard" as const },
  { subject: "Биология", topic: "Клетка и её строение", level: "низкий", tone: "cinnabar" as const },
];

const NEXT_STEPS = [
  { n: "01", title: "Завершить диагностику по биологии", meta: "≈ 15 минут" },
  { n: "02", title: "Повторить формулы дискриминанта", meta: "Математика · 6 задач уровня 2" },
  { n: "03", title: "Конспект: виды придаточных предложений", meta: "Русский язык" },
];

function StudentHome() {
  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb">
          <b>Сегодня</b> · {new Date().toLocaleDateString("ru", { day: "numeric", month: "long", weekday: "long" })}
        </div>
        <div className="pf-crumb">маршрут № 14 / диагностика 42%</div>
      </div>

      <div className="grid lg:grid-cols-[1.3fr,1fr] gap-12 items-start mb-16">
        <div>
          <PageHeader
            title="Сегодня"
            lead="Твой маршрут на сегодня построен на основе диагностики и текущего прогресса. Начни с ближайшей точки."
          />

          <div className="pf-block mb-6">
            <p className="pf-eyebrow mb-4">Ближайшее занятие</p>
            <div className="grid grid-cols-[80px,1fr,auto] gap-6 items-center">
              <div className="pf-h2" style={{ fontFamily: "var(--font-mono)" }}>{TODAY_LESSON.time}</div>
              <div>
                <div className="text-[13px] text-[color:var(--pf-muted)] mb-1">{TODAY_LESSON.subject}</div>
                <div className="text-[20px] font-medium leading-tight">{TODAY_LESSON.topic}</div>
                <div className="mt-2 text-[13px]"><span className="pf-dot pf-dot--cinnabar" />{TODAY_LESSON.tag}</div>
              </div>
              <Link to="/student/lessons" className="pf-btn">
                Начать занятие <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="pf-block">
            <div className="flex items-baseline justify-between mb-5">
              <p className="pf-eyebrow">Проблемные зоны</p>
              <Link to="/student/progress" className="pf-crumb hover:text-[color:var(--pf-ink)]">все темы →</Link>
            </div>
            <div className="grid sm:grid-cols-3 gap-px bg-[color:var(--pf-line-strong)] border border-[color:var(--pf-line-strong)] rounded">
              {PROBLEM_ZONES.map((z) => (
                <div key={z.topic} className="bg-[color:var(--pf-paper)] p-5">
                  <div className="text-[13px] text-[color:var(--pf-muted)] mb-2">{z.subject}</div>
                  <div className="text-[15px] font-medium mb-3 leading-snug">{z.topic}</div>
                  <div className="text-[12px]">
                    <span className={`pf-dot pf-dot--${z.tone}`} />{z.level} уровень
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ConstructivistIllo variant="today" className="w-full" />
      </div>

      <section className="grid lg:grid-cols-[1fr,1fr] gap-10">
        <div>
          <p className="pf-eyebrow mb-4">Следующие шаги</p>
          <div className="pf-block">
            {NEXT_STEPS.map((s, i) => (
              <div
                key={s.n}
                className="grid grid-cols-[40px,1fr,auto] gap-4 items-center py-4"
                style={{ borderTop: i === 0 ? 0 : "1px solid var(--pf-line-strong)" }}
              >
                <div className="font-mono text-[12px] text-[color:var(--pf-muted)]">{s.n}</div>
                <div>
                  <div className="text-[15px] font-medium">{s.title}</div>
                  <div className="text-[12px] text-[color:var(--pf-muted)] mt-1">{s.meta}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-[color:var(--pf-muted)]" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="pf-eyebrow mb-4">AI-навигатор</p>
          <div className="pf-ai-block">
            В теме <b>«Квадратные уравнения»</b> обнаружены пробелы по работе с дискриминантом.
            Рекомендуется повторить формулы и решить 6 задач уровня 2 до конца недели.
            <div className="mt-5">
              <Link to="/student/assistant" className="pf-btn pf-btn--ghost">
                Открыть навигатор <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
