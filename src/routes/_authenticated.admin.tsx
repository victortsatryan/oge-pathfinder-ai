import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut } from "lucide-react";

import { amIAdmin } from "@/lib/admin-materials.functions";
import { isDevOpenAccess, getAccessMode } from "@/lib/admin-access";
import { useAuth, signOut } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV = [
  { label: "Studio", to: "/admin/content" },
  { label: "Импорт", to: "/admin/import" },
  { label: "Материал", to: "/admin/new" },
  { label: "Источники", to: "/admin/sources" },
  { label: "Diagnostics", to: "/admin/routes" },
  { label: "Dev nav", to: "/dev/navigation" },
] as const;

function AdminLayout() {
  const check = useServerFn(amIAdmin);
  const { data, isLoading } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => check(),
  });
  const { user } = useAuth();
  const devOpen = isDevOpenAccess();
  const mode = getAccessMode();

  if (isLoading)
    return (
      <div className="pf-reader-wide py-16 text-sm" style={{ color: "var(--pf-muted)" }}>
        Загрузка…
      </div>
    );

  const isAdmin = Boolean(data?.isAdmin);
  if (!devOpen && !isAdmin) {
    return (
      <div className="pf-reader py-24 text-center space-y-6 pf-rise">
        <p className="pf-eyebrow">403</p>
        <h1 className="pf-h1">Доступ запрещён</h1>
        <p className="pf-lead mx-auto">
          Раздел доступен только пользователям с ролью <code>admin</code>.
        </p>
        <Link to="/" className="pf-btn pf-btn--ghost inline-flex">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="pf-reader-wide pf-rise" style={{ paddingBlock: "40px 80px" }}>
      <div className="pf-section-eyebrow">
        <span className="pf-section-eyebrow__label">
          <b>Админ-панель</b> / Pathy
        </span>
        <span className="pf-section-eyebrow__label">
          {mode === "dev-open" ? "dev · открытый доступ" : "production · admin"}
        </span>
      </div>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="pf-eyebrow mb-3">содержимое платформы</p>
          <h1 className="pf-h1">Редакция</h1>
        </div>
        <button
          onClick={async () => {
            try {
              window.localStorage.removeItem("educaite-demo-role");
            } catch {
              /* noop */
            }
            await signOut();
            window.location.href = "/auth";
          }}
          className="pf-btn pf-btn--ghost"
        >
          <LogOut className="h-4 w-4" /> Выйти
        </button>
      </header>

      {/* Навигация — mono-полоса */}
      <nav
        className="flex flex-wrap gap-x-8 gap-y-2 mb-6 pb-3"
        style={{ borderBottom: "1px solid var(--pf-line-strong)" }}
      >
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="font-mono text-[11px] uppercase tracking-widest hover:text-[color:var(--pf-ink)]"
            style={{ color: "var(--pf-muted)" }}
            activeProps={{ style: { color: "var(--pf-ink)" } }}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      {/* Режим доступа — узкая полоса, не карточка */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-10 font-mono text-[11px] uppercase tracking-widest"
        style={{
          borderLeft: `2px solid ${
            mode === "dev-open" ? "var(--pf-mustard)" : "var(--pf-forest)"
          }`,
          background: "color-mix(in oklab, var(--pf-line) 30%, var(--pf-paper))",
          color: "var(--pf-muted)",
        }}
      >
        <span>
          режим: {mode === "dev-open" ? "dev / preview" : "production"}
        </span>
        <span>
          user: {user?.email ?? "—"} · role: {isAdmin ? "admin" : "guest"}
        </span>
      </div>

      <Outlet />
    </div>
  );
}
