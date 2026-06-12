import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/oge/page-header";

type Kind = "статья" | "видео" | "правило" | "схема" | "справка";

const MATERIALS: { kind: Kind; subject: string; title: string }[] = [
  { kind: "правило", subject: "Математика", title: "Дискриминант: три случая решения" },
  { kind: "видео",   subject: "Математика", title: "Разбор: неполные квадратные уравнения" },
  { kind: "схема",   subject: "Биология",   title: "Строение клетки эукариот" },
  { kind: "статья",  subject: "Русский",    title: "Пунктуация в сложноподчинённом" },
  { kind: "справка", subject: "Английский", title: "Таблица: Perfect tenses" },
  { kind: "схема",   subject: "Математика", title: "Разложение на множители" },
  { kind: "видео",   subject: "Русский",    title: "Виды придаточных за 8 минут" },
  { kind: "статья",  subject: "Биология",   title: "Митоз и мейоз: краткое сравнение" },
];

export const Route = createFileRoute("/_authenticated/student/materials")({
  component: () => (
    <>
      <div className="pf-topbar">
        <div className="pf-crumb"><b>Архив</b> · материалы</div>
        <div className="pf-crumb">{MATERIALS.length} единиц</div>
      </div>

      <PageHeader
        title="Материалы"
        lead="Библиотека статей, правил, схем и видео. Каждая единица — справка из исследовательского архива."
      />

      <div className="pf-library">
        {MATERIALS.map((m) => (
          <div key={m.title} className="pf-library__item">
            <div className="pf-library__kind">{m.kind} · {m.subject}</div>
            <div className="pf-library__title">{m.title}</div>
            <div className="flex gap-2 mt-2">
              <span className="pf-chip">ОГЭ</span>
              <span className="pf-chip">{m.subject}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  ),
});
