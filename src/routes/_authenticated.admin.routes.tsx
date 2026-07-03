import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessMode } from "@/lib/admin-access";

export const Route = createFileRoute("/_authenticated/admin/routes")({
  component: RoutesDiagnostic,
});

type Row = {
  url: string;
  id: string;
  parent: string;
  requiredRole: "public" | "authenticated" | "admin";
  status: "active" | "dev-only";
  hasComponent: boolean;
};

function classify(id: string, url: string): Pick<Row, "requiredRole" | "status"> {
  const isAdmin = id.includes("/admin");
  const isAuth = id.includes("_authenticated");
  const isDiag = url.includes("/admin/routes");
  return {
    requiredRole: isAdmin ? "admin" : isAuth ? "authenticated" : "public",
    status: isDiag ? "dev-only" : "active",
  };
}

function RoutesDiagnostic() {
  const router = useRouter();
  const mode = getAccessMode();

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    const routes = router.routesById as Record<string, any>;
    for (const id of Object.keys(routes)) {
      const r = routes[id];
      const url: string = r.fullPath ?? r.path ?? id;
      const parent: string = r.parentRoute?.id ?? "—";
      const { requiredRole, status } = classify(id, url || "");
      list.push({
        url: url || "/",
        id,
        parent,
        requiredRole,
        status,
        hasComponent: Boolean(r.options?.component),
      });
    }
    list.sort((a, b) => a.url.localeCompare(b.url));
    return list;
  }, [router]);

  const roleBadge = (r: Row["requiredRole"]) =>
    r === "admin" ? "🛡 admin" : r === "authenticated" ? "🔒 auth" : "🌐 public";

  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          mode === "dev-open"
            ? "border-amber-500/40 bg-amber-500/10"
            : "border-emerald-500/40 bg-emerald-500/10"
        }`}
      >
        <b>Режим доступа:</b>{" "}
        {mode === "dev-open"
          ? "dev / preview — /admin открыт без проверки роли"
          : "production — /admin требует роль admin"}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Диагностика маршрутов ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">URL</th>
                <th className="py-2 pr-3">Route ID</th>
                <th className="py-2 pr-3">Parent</th>
                <th className="py-2 pr-3">Required role</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Component</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="py-1 pr-3 font-mono">{r.url}</td>
                  <td className="py-1 pr-3 font-mono text-muted-foreground">{r.id}</td>
                  <td className="py-1 pr-3 font-mono text-muted-foreground">{r.parent}</td>
                  <td className="py-1 pr-3">{roleBadge(r.requiredRole)}</td>
                  <td className="py-1 pr-3">
                    {r.status === "dev-only" ? (
                      <span className="text-amber-600">⚙ dev-only</span>
                    ) : (
                      <span className="text-emerald-600">✅ active</span>
                    )}
                  </td>
                  <td className="py-1 pr-3">{r.hasComponent ? "✅" : "⚠️"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
