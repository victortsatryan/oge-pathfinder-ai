import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlus, ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listMyStudents } from "@/lib/students.functions";

export const Route = createFileRoute("/_authenticated/teacher/")({
  loader: async () => {
    const students = await listMyStudents();
    return { students };
  },
  component: TeacherHome,
});

function TeacherHome() {
  const { students } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Рабочий кабинет</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Выберите ученика, чтобы посмотреть карту слабых тем и рекомендации по следующему
          занятию.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Button asChild>
            <Link to="/teacher/students">
              <UserPlus className="h-4 w-4 mr-2" /> Добавить ученика
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/teacher/plans">
              <ClipboardList className="h-4 w-4 mr-2" /> Составить индивидуальный план
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Учеников</CardDescription>
            <CardTitle className="text-3xl">{students.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Ближайшие занятия</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Рекомендаций AI</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Мои ученики</CardTitle>
          <CardDescription>Быстрый доступ к профилям и слабым темам.</CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Пока ни одного ученика. Нажмите «Добавить ученика», чтобы начать.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {students.slice(0, 6).map((s: any) => (
                <li key={s.id}>
                  <Link
                    to="/teacher/students/$studentId"
                    params={{ studentId: s.id }}
                    className="block rounded-lg border p-4 hover:bg-accent transition-colors"
                  >
                    <div className="font-medium">
                      {s.first_name} {s.last_name ?? ""}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.grade ? `${s.grade} класс · ` : ""}
                      {(s.subjects ?? []).join(", ") || "Предметы не указаны"}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
