import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAccessMode } from "@/lib/admin-access";

export const Route = createFileRoute("/dev/navigation")({
  component: DevNavigation,
});

type RouteRow = {
  publicUrl: string;
  internalId: string;
  role: "public" | "authenticated" | "student" | "teacher" | "admin";
  protectedInProd: boolean;
  devAccess: boolean;
};

const SECTIONS: { title: string; rows: RouteRow[] }[] = [
  {
    title: "Auth",
    rows: [
      { publicUrl: "/auth", internalId: "/auth", role: "public", protectedInProd: false, devAccess: true },
      { publicUrl: "/onboarding", internalId: "/_authenticated/onboarding", role: "authenticated", protectedInProd: true, devAccess: true },
      { publicUrl: "/profile", internalId: "/_authenticated/profile", role: "authenticated", protectedInProd: true, devAccess: true },
    ],
  },
  {
    title: "Student",
    rows: [
      { publicUrl: "/student", internalId: "/_authenticated/student", role: "student", protectedInProd: true, devAccess: true },
      { publicUrl: "/student/subjects", internalId: "/_authenticated/student/subjects", role: "student", protectedInProd: true, devAccess: true },
      { publicUrl: "/student/diagnostic", internalId: "/_authenticated/student/diagnostic", role: "student", protectedInProd: true, devAccess: true },
      { publicUrl: "/student/path", internalId: "/_authenticated/student/path", role: "student", protectedInProd: true, devAccess: true },
      { publicUrl: "/student/calendar", internalId: "/_authenticated/student/calendar", role: "student", protectedInProd: true, devAccess: true },
      { publicUrl: "/student/lessons", internalId: "/_authenticated/student/lessons", role: "student", protectedInProd: true, devAccess: true },
      { publicUrl: "/student/analytics", internalId: "/_authenticated/student/analytics", role: "student", protectedInProd: true, devAccess: true },
      { publicUrl: "/student/assistant", internalId: "/_authenticated/student/assistant", role: "student", protectedInProd: true, devAccess: true },
    ],
  },
  {
    title: "Teacher",
    rows: [
      { publicUrl: "/teacher", internalId: "/_authenticated/teacher", role: "teacher", protectedInProd: true, devAccess: true },
      { publicUrl: "/teacher/students", internalId: "/_authenticated/teacher/students", role: "teacher", protectedInProd: true, devAccess: true },
      { publicUrl: "/teacher/lessons", internalId: "/_authenticated/teacher/lessons", role: "teacher", protectedInProd: true, devAccess: true },
      { publicUrl: "/teacher/analytics", internalId: "/_authenticated/teacher/analytics", role: "teacher", protectedInProd: true, devAccess: true },
      { publicUrl: "/teacher/ai", internalId: "/_authenticated/teacher/ai", role: "teacher", protectedInProd: true, devAccess: true },
      { publicUrl: "/teacher/profile", internalId: "/_authenticated/teacher/profile", role: "teacher", protectedInProd: true, devAccess: true },
    ],
  },
  {
    title: "Admin · Pathy Studio",
    rows: [
      { publicUrl: "/admin", internalId: "/_authenticated/admin", role: "admin", protectedInProd: true, devAccess: true },
      { publicUrl: "/admin/content", internalId: "/_authenticated/admin/content", role: "admin", protectedInProd: true, devAccess: true },
      { publicUrl: "/admin/content/import", internalId: "/_authenticated/admin/content/import", role: "admin", protectedInProd: true, devAccess: true },
      { publicUrl: "/admin/content/programs", internalId: "/_authenticated/admin/content/programs", role: "admin", protectedInProd: true, devAccess: true },
      { publicUrl: "/admin/content/objectives", internalId: "/_authenticated/admin/content/objectives", role: "admin", protectedInProd: true, devAccess: true },
      { publicUrl: "/admin/content/history", internalId: "/_authenticated/admin/content/history", role: "admin", protectedInProd: true, devAccess: true },
      { publicUrl: "/admin/routes", internalId: "/_authenticated/admin/routes", role: "admin", protectedInProd: true, devAccess: true },
    ],
  },
];

const DEV_ROLE_KEY = "educaite-demo-role";

function DevNavigation() {
  const router = useRouter();
  const mode = getAccessMode();
  const devOpen = mode === "dev-open";

  const [devRole, setDevRole] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDevRole(window.localStorage.getItem(DEV_ROLE_KEY));
    }
  }, []);

  const registeredIds = useMemo(() => {
    const ids = new Set<string>();
    const routes = (router.routesById ?? {}) as Record<string, any>;
    for (const id of Object.keys(routes)) ids.add(id);
    return ids;
  }, [router]);

  const setRole = (role: "student" | "teacher" | "admin" | null) => {
    if (typeof window === "undefined") return;
    if (role === null) window.localStorage.removeItem(DEV_ROLE_KEY);
    else window.localStorage.setItem(DEV_ROLE_KEY, role);
    setDevRole(role);
  };

  const roleBadge = (r: RouteRow["role"]) => {
    switch (r) {
      case "admin": return "🛡 admin";
      case "teacher": return "👩‍🏫 teacher";
      case "student": return "🎓 student";
      case "authenticated": return "🔒 auth";
      default: return "🌐 public";
    }
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dev Navigation</h1>
        <p className="text-sm text-muted-foreground">
          Реальные публичные URL приложения. Не используйте Lovable route selector — там показаны внутренние route IDs (<code>/_authenticated/...</code>), они не являются пользовательскими URL.
        </p>
      </div>

      <div className={`rounded-lg border px-4 py-3 text-sm ${devOpen ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/40 bg-emerald-500/10"}`}>
        <b>Режим доступа:</b>{" "}
        {devOpen ? "🟡 dev / preview — админка и dev-переключатель открыты" : "🟢 production — маршруты защищены ролями"}
        <div className="mt-1 text-xs text-muted-foreground">
          Dev role используется только в preview/development и не действует в production.
          В production доступ определяется исключительно Supabase session и таблицей <code>user_roles</code>.
        </div>
      </div>

      {devOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Тестировать как</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 items-center">
            {(["student", "teacher", "admin"] as const).map((r) => (
              <Button key={r} size="sm" variant={devRole === r ? "default" : "outline"} onClick={() => setRole(r)}>
                {r}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setRole(null)}>сброс</Button>
            <span className="text-xs text-muted-foreground ml-2">
              Текущая dev-роль: <b>{devRole ?? "—"}</b> · влияет только на dev/preview навигацию.
            </span>
          </CardContent>
        </Card>
      )}

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Public URL</th>
                  <th className="py-2 pr-3">Internal Route ID</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Protected</th>
                  <th className="py-2 pr-3">Dev Access</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((r) => {
                  const registered = registeredIds.has(r.internalId);
                  return (
                    <tr key={r.publicUrl} className="border-b border-border/40">
                      <td className="py-1 pr-3 font-mono">
                        <a href={r.publicUrl} className="text-primary hover:underline">{r.publicUrl}</a>
                      </td>
                      <td className="py-1 pr-3 font-mono text-muted-foreground">{r.internalId}</td>
                      <td className="py-1 pr-3">{roleBadge(r.role)}</td>
                      <td className="py-1 pr-3">{r.protectedInProd ? "🔒 prod" : "—"}</td>
                      <td className="py-1 pr-3">{r.devAccess ? "✅" : "—"}</td>
                      <td className="py-1 pr-3">
                        {registered ? <span className="text-emerald-600">✅ OK</span> : <span className="text-red-600">❌ missing</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      <div className="text-xs text-muted-foreground">
        Совет: если случайно откроете <code>/_authenticated/...</code> — редирект отправит вас на соответствующий публичный URL.
        Диагностика зарегистрированных маршрутов: <Link to="/admin/routes" className="underline">/admin/routes</Link>.
      </div>
    </div>
  );
}
