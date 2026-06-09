import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/oge/user-menu";

export type NavItem = {
  label: string;
  to: string;
  icon?: ReactNode;
};

export function RoleShell({
  title,
  items,
  accent,
}: {
  title: string;
  items: NavItem[];
  accent?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="font-semibold tracking-tight truncate">
              educaite
            </Link>
            {accent ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {accent}
              </span>
            ) : null}
          </div>
          <UserMenu />
        </div>
        <nav className="max-w-7xl mx-auto px-2 overflow-x-auto">
          <ul className="flex gap-1 py-2 text-sm">
            {items.map((it) => {
              const active =
                pathname === it.to ||
                (it.to !== "/" && pathname.startsWith(it.to + "/"));
              return (
                <li key={it.to}>
                  <Link
                    to={it.to}
                    className={cn(
                      "px-3 py-1.5 rounded-md whitespace-nowrap transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
      <div className="sr-only">{title}</div>
    </div>
  );
}
