import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { amIAdmin } from "@/lib/admin-materials.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const check = useServerFn(amIAdmin);
  const { data, isLoading } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => check(),
  });

  useEffect(() => {
    if (!isLoading && data && !data.isAdmin) {
      navigate({ to: "/" });
    }
  }, [data, isLoading, navigate]);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Загрузка…</div>;
  if (!data?.isAdmin) return <div className="p-8 text-sm">Доступ только для администраторов.</div>;

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Админ-панель</h1>
          <p className="text-sm text-muted-foreground">Управление контентом Pathy.ai</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/admin/import">Импорт материалов</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/new">Новый материал</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/sources">Источники</Link></Button>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
