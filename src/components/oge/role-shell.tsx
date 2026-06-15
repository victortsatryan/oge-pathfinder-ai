import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  Compass,
  Map as MapIcon,
  CalendarRange,
  Library,
  Activity,
  Sparkles,
  Users,
  ClipboardList,
  Stethoscope,
  BarChart3,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  to: string;
  icon?: ReactNode;
};

// Predefined icon map for default nav items
const ICONS: Record<string, ReactNode> = {
  "/student": <Compass className="h-[18px] w-[18px]" />,
  "/student/diagnostic": <Stethoscope className="h-[18px] w-[18px]" />,
  "/student/lessons": <MapIcon className="h-[18px] w-[18px]" />,
  "/student/calendar": <CalendarRange className="h-[18px] w-[18px]" />,
  "/student/materials": <Library className="h-[18px] w-[18px]" />,
  "/student/progress": <Activity className="h-[18px] w-[18px]" />,
  "/student/assistant": <Sparkles className="h-[18px] w-[18px]" />,
  "/teacher": <Compass className="h-[18px] w-[18px]" />,
  "/teacher/students": <Users className="h-[18px] w-[18px]" />,
  "/teacher/diagnostic": <Stethoscope className="h-[18px] w-[18px]" />,
  "/teacher/plans": <ClipboardList className="h-[18px] w-[18px]" />,
  "/teacher/materials": <Library className="h-[18px] w-[18px]" />,
  "/teacher/analytics": <BarChart3 className="h-[18px] w-[18px]" />,
  "/teacher/assistant": <Sparkles className="h-[18px] w-[18px]" />,
};

export function RoleShell({
  items,
  accent,
}: {
  title: string;
  items: NavItem[];
  accent?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="pf-shell">
      <aside className="pf-rail">
        <Link to="/" className="pf-rail__logo">
          <span className="pf-rail__logo-mark" aria-hidden />
          <span>Pathy.ai</span>
        </Link>

        <nav className="pf-rail__nav" aria-label="Основная навигация">
          {items.map((it) => {
            const active =
              pathname === it.to ||
              (it.to !== "/" && pathname.startsWith(it.to + "/"));
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn("pf-rail__item", active && "is-active")}
              >
                <span className="pf-rail__icon" aria-hidden>
                  {it.icon ?? ICONS[it.to] ?? <Compass className="h-[18px] w-[18px]" />}
                </span>
                <span>{it.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link to="/profile" className="pf-rail__user">
          <span className="pf-rail__user-avatar">
            {accent === "Преподаватель" ? "ПР" : "УЧ"}
          </span>
          <span className="pf-rail__user-meta">
            <b>{accent === "Преподаватель" ? "Преподаватель" : "Иван"}</b>
            <span>{accent === "Преподаватель" ? "Кабинет" : "9 класс"}</span>
          </span>
        </Link>
      </aside>

      <main className="pf-main">
        <Outlet />
      </main>
    </div>
  );
}
