import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Stethoscope, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { demoProgress } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/student/")({
  component: StudentHome,
});

function StudentHome() {
  const progress = demoProgress;
  const accuracy =
    progress.totalAttempts > 0
      ? Math.round((progress.totalCorrect / progress.totalAttempts) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Привет! Готовимся к ОГЭ
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Сегодня у тебя несколько занятий. Начнём с темы, которая сильнее всего влияет на
          результат ОГЭ.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Button asChild>
            <Link to="/student/diagnostic">
              <Stethoscope className="h-4 w-4 mr-2" /> Пройти диагностику
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/student/calendar">
              <CalendarDays className="h-4 w-4 mr-2" /> Открыть план на сегодня
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Всего попыток</CardDescription>
            <CardTitle className="text-3xl">{progress.totalAttempts}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Доля верных ответов</CardDescription>
            <CardTitle className="text-3xl">{accuracy}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Предметов в работе</CardDescription>
            <CardTitle className="text-3xl">{progress.bySubject.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Прогресс по предметам</CardTitle>
          <CardDescription>На основе пройденных занятий и попыток</CardDescription>
        </CardHeader>
        <CardContent>
          {progress.bySubject.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Пока нет данных — пройди диагностику, чтобы построить план.
            </p>
          ) : (
            <ul className="space-y-4">
              {progress.bySubject.map((row: any) => (
                <li key={row.subjectId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{row.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {row.completedLessons}/{row.totalLessons} занятий ·{" "}
                      {row.accuracyPercent}% верных
                    </span>
                  </div>
                  <Progress value={row.progressPercent} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI-рекомендация
          </CardTitle>
          <CardDescription>
            Подсказки появятся после первой диагностики и нескольких занятий.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
