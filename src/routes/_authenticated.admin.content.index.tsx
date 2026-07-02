import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { pcsDashboardCounts } from "@/lib/pcs/pcs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/content/")({
  component: Dashboard,
});

const LABELS: Record<string, string> = {
  subject_programs: "Программ",
  subjects: "Предметов",
  sections: "Разделов",
  topics: "Тем",
  learning_objectives: "Learning Objectives",
  materials: "Материалов",
  task_patterns: "Task Patterns",
  content_imports: "Импортов",
};

function Dashboard() {
  const fn = useServerFn(pcsDashboardCounts);
  const { data, isLoading } = useQuery({ queryKey: ["pcs-counts"], queryFn: () => fn() });

  if (isLoading) return <div className="text-sm text-muted-foreground">Загрузка…</div>;
  const counts = data?.counts ?? {};

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(LABELS).map(([k, label]) => (
          <Card key={k}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-semibold">{counts[k] ?? 0}</div></CardContent>
          </Card>
        ))}
      </div>
      {data?.lastImport && (
        <Card>
          <CardHeader><CardTitle>Последний импорт</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><b>Файл:</b> {data.lastImport.filename ?? "—"}</div>
            <div><b>Дата:</b> {new Date(data.lastImport.imported_at).toLocaleString("ru-RU")}</div>
            <div><b>Статус:</b> {data.lastImport.status}</div>
            <div><b>Создано / обновлено / ошибок:</b> {data.lastImport.rows_created} / {data.lastImport.rows_updated} / {data.lastImport.rows_failed}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
