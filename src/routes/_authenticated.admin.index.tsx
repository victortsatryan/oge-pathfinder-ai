import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import { SectionEyebrow } from "@/components/oge/section-eyebrow";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

const CARDS = [
  {
    to: "/admin/content" as const,
    num: "01",
    title: "Pathy Studio",
    desc: "PCS JSON, дерево программы, карточки Learning Objectives.",
  },
  {
    to: "/admin/import" as const,
    num: "02",
    title: "Импорт",
    desc: "Массовая загрузка материалов из CSV / JSON с проверкой дублей.",
  },
  {
    to: "/admin/new" as const,
    num: "03",
    title: "Новый материал",
    desc: "Форма со всеми полями материала и привязкой к теме.",
  },
  {
    to: "/admin/sources" as const,
    num: "04",
    title: "Источники",
    desc: "Каталог источников — ФИПИ, Решу ОГЭ, РЭШ, InternetUrok и др.",
  },
];

function AdminHome() {
  return (
    <section>
      <SectionEyebrow section="Разделы" sub="управление контентом" mark="mustard" />

      <ul
        className="grid gap-0"
        style={{ borderTop: "1px solid var(--pf-line-strong)" }}
      >
        {CARDS.map((c) => (
          <li key={c.to} style={{ borderBottom: "1px solid var(--pf-line-strong)" }}>
            <Link
              to={c.to}
              className="grid grid-cols-[80px,1fr,auto] gap-6 items-baseline py-8 hover:bg-[color:color-mix(in_oklab,var(--pf-line)_25%,transparent)] transition-colors px-2"
            >
              <span
                className="font-mono text-[13px] uppercase tracking-widest"
                style={{ color: "var(--pf-muted)" }}
              >
                {c.num}
              </span>
              <div>
                <div className="text-[22px] font-medium leading-tight">
                  {c.title}
                </div>
                <div
                  className="mt-2 text-[14px] leading-relaxed"
                  style={{ color: "var(--pf-muted)" }}
                >
                  {c.desc}
                </div>
              </div>
              <ArrowUpRight
                className="h-5 w-5"
                style={{ color: "var(--pf-muted)" }}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
