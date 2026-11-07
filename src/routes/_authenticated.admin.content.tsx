import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { amIContentAdmin } from "@/lib/pcs/pcs.functions";
import { Button } from "@/components/ui/button";
import { isDevOpenAccess } from "@/lib/admin-access";

export const Route = createFileRoute("/_authenticated/admin/content")({
  component: ContentLayout,
});

function ContentLayout() {
  const check = useServerFn(amIContentAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["pcs-admin"], queryFn: () => check() });
  const devOpen = isDevOpenAccess();

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Загрузка…</div>;
  if (!devOpen && !data?.isAdmin) {
    return (
      <div className="container max-w-2xl py-16 text-center space-y-3">
        <h1 className="text-3xl font-semibold">403 · Доступ запрещён</h1>
        <p className="text-sm text-muted-foreground">Pathy Studio доступна только администраторам.</p>
        <Button asChild variant="outline" size="sm"><Link to="/">На главную</Link></Button>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pathy Studio</h1>
          <p className="text-sm text-muted-foreground">Учебная программа, темы, опубликованные материалы и загрузка книг</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/admin/content">Обзор</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/content/upload">Загрузка источника</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/import">CSV / PCS импорт</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/content/materials">Материалы Pathy</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/content/topics">Управление темами</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/content/programs">Дерево программ</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/content/objectives">Результаты обучения</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/admin/content/history">Журнал CSV / PCS</Link></Button>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
