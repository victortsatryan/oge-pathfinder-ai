import { createFileRoute, Link } from "@tanstack/react-router";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Link to="/admin/content">
        <Card className="hover:border-primary transition">
          <CardHeader><CardTitle>Pathy Studio</CardTitle><CardDescription>PCS JSON и программа</CardDescription></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Импорт образовательного контента, дерево программы, карточки Learning Objectives.</CardContent>
        </Card>
      </Link>

      <Link to="/admin/import">
        <Card className="hover:border-primary transition">
          <CardHeader><CardTitle>Импорт</CardTitle><CardDescription>Загрузить CSV / JSON</CardDescription></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Массовая загрузка материалов с проверкой дублей.</CardContent>
        </Card>
      </Link>
      <Link to="/admin/new">
        <Card className="hover:border-primary transition">
          <CardHeader><CardTitle>Новый материал</CardTitle><CardDescription>Создать вручную</CardDescription></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Форма со всеми полями материала и привязкой к теме.</CardContent>
        </Card>
      </Link>
      <Link to="/admin/sources">
        <Card className="hover:border-primary transition">
          <CardHeader><CardTitle>Источники</CardTitle><CardDescription>Каталог источников</CardDescription></CardHeader>
          <CardContent className="text-sm text-muted-foreground">ФИПИ, Решу ОГЭ, РЭШ, InternetUrok и др.</CardContent>
        </Card>
      </Link>
    </div>
  );
}
