import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/oge/page-header";
import { ConstructivistIllo } from "@/components/oge/constructivist-illo";

const SIGNALS = [
  {
    topic: "Квадратные уравнения",
    message:
      "В теме квадратных уравнений обнаружены пробелы по применению дискриминанта. Рекомендуется повторить формулы и решить 6 задач уровня 2.",
  },
  {
    topic: "Пунктуация в сложном предложении",
    message:
      "Выявлены ошибки в постановке запятых перед союзом «что». Рекомендуется разобрать 4 случая и пройти короткий тест.",
  },
  {
    topic: "Клетка и её строение",
    message:
      "Уровень освоения темы — низкий. Рекомендуется начать с схемы строения клетки и пройти диагностику по органоидам.",
  },
];

export const Route = createFileRoute("/_authenticated/student/assistant")({
  component: () => (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>AI-навигатор</b> · анализ маршрута</div>
        <div className="pf-crumb">обновлено 12 минут назад</div>
      </div>

      <div className="grid lg:grid-cols-[1.4fr,1fr] gap-12 items-start mb-12">
        <PageHeader
          title="AI-навигатор"
          lead="Интеллектуальный навигатор по карте знаний. Анализирует диагностику и прогресс, указывает на пробелы и предлагает следующий шаг."
        />
        <ConstructivistIllo variant="ai" className="w-full" />
      </div>

      <div className="grid gap-5">
        {SIGNALS.map((s) => (
          <div key={s.topic} className="pf-ai-block">
            <div className="text-[12px] uppercase tracking-wider mb-2 text-[color:var(--pf-muted)]" style={{ fontFamily: "var(--font-mono)" }}>
              сигнал · {s.topic}
            </div>
            {s.message}
          </div>
        ))}
      </div>
    </>
  ),
});
