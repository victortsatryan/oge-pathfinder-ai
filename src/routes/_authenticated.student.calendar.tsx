import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/oge/page-header";
import { ConstructivistIllo } from "@/components/oge/constructivist-illo";

export const Route = createFileRoute("/_authenticated/student/calendar")({
  component: CalendarRoute,
});

type Stop = {
  time: string;
  subject: string;
  topic: string;
  tone: "cinnabar" | "ultra" | "forest" | "mustard" | "ink";
  status: "done" | "current" | "ahead";
};

const TODAY: Stop[] = [
  { time: "09:00", subject: "Русский язык", topic: "Пунктуация в сложном предложении", tone: "mustard", status: "done" },
  { time: "11:00", subject: "Математика", topic: "Квадратные уравнения", tone: "cinnabar", status: "current" },
  { time: "14:00", subject: "Английский язык", topic: "Past Perfect", tone: "ultra", status: "ahead" },
  { time: "16:00", subject: "Биология", topic: "Клетка и её строение", tone: "forest", status: "ahead" },
];

const WEEK = ["Пн 27", "Вт 28", "Ср 29", "Чт 30", "Пт 31", "Сб 1", "Вс 2"];

function CalendarRoute() {
  return (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>Маршрут</b> · неделя 24</div>
        <div className="flex items-center gap-1">
          {WEEK.map((d, i) => (
            <div
              key={d}
              className="text-[12px] font-mono px-3 py-1.5 rounded"
              style={{
                background: i === 1 ? "var(--pf-ink)" : "transparent",
                color: i === 1 ? "var(--pf-paper)" : "var(--pf-muted)",
              }}
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      <PageHeader
        title="Календарь"
        lead="Твой маршрут подготовки. Каждый день — точка на пути. Пройденное закрашивается."
      />

      <div className="grid lg:grid-cols-[1.4fr,1fr] gap-12 items-start">
        <div className="pf-route">
          {TODAY.map((s) => (
            <div key={s.time} className="pf-route__row">
              <div className="pf-route__time">{s.time}</div>
              <div>
                <div className="pf-route__subject">
                  <span className={`pf-dot pf-dot--${s.tone}`} />{s.subject}
                </div>
                <div className="pf-route__title">{s.topic}</div>
                <div className="mt-3">
                  <div className="pf-bar">
                    <div
                      className={`pf-bar__fill pf-bar__fill--${s.tone}`}
                      style={{ width: s.status === "done" ? "100%" : s.status === "current" ? "45%" : "0%" }}
                    />
                  </div>
                  <div className="mt-1.5 text-[11px] font-mono text-[color:var(--pf-muted)] uppercase tracking-wider">
                    {s.status === "done" ? "пройдено" : s.status === "current" ? "в работе" : "впереди"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <ConstructivistIllo variant="calendar" className="w-full" />
      </div>
    </>
  );
}
