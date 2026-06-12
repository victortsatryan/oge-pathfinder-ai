import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { demoStudents } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/teacher/students/$studentId")({
  loader: async ({ params }) => {
    const student = demoStudents.find((item) => item.id === params.studentId);
    if (!student) throw notFound();
    return student;
  },
  component: StudentProfile,
  notFoundComponent: () => (
    <div className="text-sm text-muted-foreground">Ученик не найден.</div>
  ),
});

// Mock data — будет заменено реальными данными из диагностики и плана
const MOCK_WEAK_TOPICS = [
  { subject: "Математика", topic: "Дроби и проценты", level: 35, status: "Требует внимания" },
  { subject: "Русский язык", topic: "Пунктуация в СПП", level: 50, status: "В работе" },
  { subject: "Биология", topic: "Строение клетки", level: 60, status: "В работе" },
];

const MOCK_PLAN = [
  { date: "Завтра, 10:00", topic: "Дроби: повторение основ", materials: "Конспект + 10 задач" },
  { date: "Пятница, 16:00", topic: "Пунктуация в СПП", materials: "Видео + диктант" },
];

const MOCK_AI = [
  "Дать дополнительный блок на проценты после следующего занятия",
  "Повторить определения видов придаточных",
  "Добавить визуальные схемы по строению клетки",
];

function StudentProfile() {
  const s = Route.useLoaderData() as any;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/teacher/students">
          <ArrowLeft className="h-4 w-4 mr-1" /> К списку учеников
        </Link>
      </Button>

      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {s.first_name} {s.last_name ?? ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          {s.grade ? `${s.grade} класс` : "Класс не указан"}
          {s.subjects?.length ? ` · ${s.subjects.join(", ")}` : ""}
        </p>
        {s.notes ? <p className="text-sm mt-2 max-w-2xl">{s.notes}</p> : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Карта слабых тем</CardTitle>
            <CardDescription>На основе диагностики (демо-данные)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {MOCK_WEAK_TOPICS.map((t) => (
              <div key={t.topic} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{t.topic}</div>
                    <div className="text-xs text-muted-foreground">{t.subject}</div>
                  </div>
                  <Badge variant="outline">{t.status}</Badge>
                </div>
                <Progress value={t.level} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>План занятий</CardTitle>
            <CardDescription>Ближайшие встречи и материалы</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {MOCK_PLAN.map((p) => (
                <li key={p.date} className="rounded-lg border p-3">
                  <div className="text-sm text-muted-foreground">{p.date}</div>
                  <div className="font-medium">{p.topic}</div>
                  <div className="text-xs text-muted-foreground mt-1">{p.materials}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Рекомендации AI</CardTitle>
            <CardDescription>Что усилить и какие материалы добавить</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {MOCK_AI.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>История результатов</CardTitle>
            <CardDescription>Диагностика и проверки</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Пока пусто. История появится после первых занятий и проверочных тестов.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
