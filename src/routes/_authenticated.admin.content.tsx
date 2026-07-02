import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { amIContentAdmin } from "@/lib/pcs/pcs.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/content")({
  component: ContentLayout,
});

function ContentLayout() {
  const navigate = useNavigate();
  const check = useServerFn(amIContentAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["pcs-admin"], queryFn: () => check() });

  useEffect(() => {
    if (!isLoading && data && !data.isAdmin) navigate({ to: "/" });
  }, [data, isLoading, navigate]);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Загрузка…</div>;
  if (!data?.isAdmin) return <div className="p-8 text-sm">Доступ только для администраторов.</div>;

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pathy Studio</h1>
          <p className="text-sm text-muted-foreground">Управление образовательным контентом (PCS v1)</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/admin/content">Dashboard</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/content/import">Импорт</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/content/programs">Программы</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/content/objectives">Learning Objectives</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/content/history">История импортов</Link></Button>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
