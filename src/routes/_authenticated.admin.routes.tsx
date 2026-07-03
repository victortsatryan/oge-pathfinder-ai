import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/routes")({
  component: RoutesDiagnostic,
});

type Row = {
  url: string;
  id: string;
  parent: string;
  protected: boolean;
  hasComponent: boolean;
};

function RoutesDiagnostic() {
  const router = useRouter();

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    const routes = router.routesById as Record<string, any>;
    for (const id of Object.keys(routes)) {
      const r = routes[id];
      const url: string = r.fullPath ?? r.path ?? id;
      const parent: string = r.parentRoute?.id ?? "—";
      list.push({
        url: url || "/",
        id,
        parent,
        protected: id.includes("_authenticated"),
        hasComponent: Boolean(r.options?.component),
      });
    }
    list.sort((a, b) => a.url.localeCompare(b.url));
    return list;
  }, [router]);

  return (
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
              <th className="py-2 pr-3">Protected</th>
              <th className="py-2 pr-3">Component</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/40">
                <td className="py-1 pr-3 font-mono">{r.url}</td>
                <td className="py-1 pr-3 font-mono text-muted-foreground">{r.id}</td>
                <td className="py-1 pr-3 font-mono text-muted-foreground">{r.parent}</td>
                <td className="py-1 pr-3">{r.protected ? "🔒 yes" : "— no"}</td>
                <td className="py-1 pr-3">{r.hasComponent ? "✅" : "⚠️"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
