import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/oge/page-header";
import { ConstructivistIllo } from "@/components/oge/constructivist-illo";
import { demoProfile } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const TERRITORIES = [
  { name: "Математика", explored: 60, weak: ["Квадратные уравнения", "Проценты"] },
  { name: "Русский язык", explored: 50, weak: ["Пунктуация в СПП"] },
  { name: "Биология", explored: 43, weak: ["Клетка", "Митоз"] },
];

function ProfilePage() {
  const profile = demoProfile;
  return (
    <main className="min-h-screen" style={{ background: "var(--pf-paper)" }}>
      <div className="max-w-6xl mx-auto px-10 py-10">
        <div className="pf-topbar">
          <Link to="/student" className="pf-crumb hover:text-[color:var(--pf-ink)]">
            <ArrowLeft className="h-3 w-3 inline mr-1" /> к маршруту
          </Link>
          <div className="pf-crumb"><b>Профиль</b> · карта территории</div>
        </div>

        <div className="grid lg:grid-cols-[1.3fr,1fr] gap-12 items-start mb-12">
          <PageHeader
            crumb={<>исследователь · {profile.grade} класс</>}
            title={`${profile.first_name} ${profile.last_name ?? ""}`}
            lead="Карта освоенной территории по предметам подготовки. Без процентов везде — только зоны: освоено, в исследовании, проблемные."
          />
          <ConstructivistIllo variant="profile" className="w-full" />
        </div>

        <div className="grid gap-6">
          {TERRITORIES.map((t) => (
            <div key={t.name} className="pf-block">
              <div className="grid grid-cols-[1fr,auto] items-baseline gap-4 mb-5">
                <div>
                  <p className="pf-eyebrow mb-2">территория</p>
                  <h2 className="pf-h2">{t.name}</h2>
                </div>
                <div className="font-mono text-[13px] text-[color:var(--pf-muted)]">
                  {t.explored}% освоено
                </div>
              </div>

              <div className="pf-bar mb-6">
                <div className="pf-bar__fill" style={{ width: `${t.explored}%` }} />
              </div>

              <div className="grid sm:grid-cols-3 gap-6">
                <div>
                  <p className="pf-eyebrow mb-2">освоено</p>
                  <p className="text-[14px] leading-relaxed">Базовые понятия, типовые задачи уровня 1.</p>
                </div>
                <div>
                  <p className="pf-eyebrow mb-2">в исследовании</p>
                  <p className="text-[14px] leading-relaxed">Задачи второй части, нестандартные формулировки.</p>
                </div>
                <div>
                  <p className="pf-eyebrow mb-2">проблемные зоны</p>
                  <ul className="text-[14px] leading-relaxed">
                    {t.weak.map((w) => (
                      <li key={w}><span className="pf-dot pf-dot--cinnabar" />{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
