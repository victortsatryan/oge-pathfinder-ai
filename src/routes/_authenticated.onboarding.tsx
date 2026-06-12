import { createFileRoute, Link } from "@tanstack/react-router";

import { ConstructivistIllo } from "@/components/oge/constructivist-illo";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-6xl mx-auto px-10 py-16">
        <div className="flex items-center gap-3 mb-16">
          <span className="pf-rail__logo-mark" aria-hidden style={{ background: "var(--pf-cinnabar)" }} />
          <span className="pf-crumb"><b>PATHFINDER</b></span>
        </div>

        <div className="grid lg:grid-cols-[1.3fr,1fr] gap-16 items-start mb-20">
          <div>
            <p className="pf-eyebrow mb-4">Шаг 01 · Роль</p>
            <h1 className="pf-h1 max-w-xl">Кто открывает карту знаний?</h1>
            <p className="pf-lead">
              Pathfinder — не курс и не тренажёр. Это инструмент навигации по предмету.
              Выберите режим, чтобы открыть карту с нужной точки.
            </p>
          </div>
          <ConstructivistIllo variant="today" className="w-full" />
        </div>

        <div className="pf-role-grid">
          <Link
            to="/student"
            className="pf-role-tile"
            onClick={() => window.localStorage.setItem("educaite-demo-role", "student")}
          >
            <p className="pf-eyebrow">01 · ученик</p>
            <h2 className="pf-h2">Я исследую территорию предмета</h2>
            <p className="text-[15px] leading-relaxed text-[color:var(--pf-muted)]">
              Диагностика, маршрут на сегодня, проблемные зоны, занятия и материалы — всё
              как единая карта подготовки.
            </p>
            <span className="pf-eyebrow mt-4" style={{ color: "var(--pf-cinnabar)" }}>
              Войти как ученик →
            </span>
          </Link>

          <Link
            to="/teacher"
            className="pf-role-tile"
            onClick={() => window.localStorage.setItem("educaite-demo-role", "teacher")}
          >
            <p className="pf-eyebrow">02 · преподаватель</p>
            <h2 className="pf-h2">Я веду учеников по карте</h2>
            <p className="text-[15px] leading-relaxed text-[color:var(--pf-muted)]">
              Профили учеников, слабые темы, индивидуальные маршруты и рекомендации
              AI-навигатора — в одном пространстве.
            </p>
            <span className="pf-eyebrow mt-4" style={{ color: "var(--pf-cinnabar)" }}>
              Войти как преподаватель →
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
