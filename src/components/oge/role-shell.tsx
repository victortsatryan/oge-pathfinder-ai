import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { signOut } from "@/hooks/use-auth";
import { PathyLogo } from "@/components/oge/logo";

export type NavItem = {
  label: string;
  to: string;
  icon?: ReactNode;
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
  const isTeacher = accent === "Преподаватель";

  return (
    <div className="pf-shell">
      <aside className="pf-rail">
        <Link
          to="/"
          className="pf-rail__logo"
          style={{ textDecoration: "none" }}
        >
          <PathyLogo size="sm" />
        </Link>

        <div className="flex flex-col gap-1 flex-1">
          <div className="pf-rail__section">
            {isTeacher ? "Кабинет / преподаватель" : "Маршрут / ученик"}
          </div>
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
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-3">
          <Link to="/profile" className="pf-rail__user">
            <span className="pf-rail__user-avatar">
              {isTeacher ? "ПР" : "УЧ"}
            </span>
            <span className="pf-rail__user-meta">
              <b>{isTeacher ? "Преподаватель" : "Иван"}</b>
              <span>{isTeacher ? "кабинет" : "9 класс"}</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={async () => {
              try {
                window.localStorage.removeItem("educaite-demo-role");
              } catch {
                /* noop */
              }
              await signOut();
              window.location.href = "/auth";
            }}
            className="pf-rail__section text-left hover:text-[color:var(--pf-ink)] transition-colors"
            style={{ padding: "8px 10px 0", cursor: "pointer" }}
          >
            → выйти
          </button>
        </div>
      </aside>

      <main className="pf-main">
        <Outlet />
      </main>
    </div>
  );
}
