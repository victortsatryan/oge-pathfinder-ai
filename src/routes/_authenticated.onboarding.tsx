import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserMenu } from "@/components/oge/user-menu";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        <div className="flex justify-end mb-6"><UserMenu /></div>
        <header className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Как вы будете использовать сервис?
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Выберите роль, чтобы мы настроили интерфейс и рекомендации под вашу задачу.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="flex flex-col">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                <GraduationCap className="h-5 w-5" />
              </div>
              <CardTitle>Ученик</CardTitle>
              <CardDescription>
                Проходи диагностику, получай индивидуальный план подготовки, занимайся по
                календарю и отслеживай прогресс.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button
                className="w-full"
                asChild
              >
                <a href="/student" onClick={() => window.localStorage.setItem("educaite-demo-role", "student")}>
                  Продолжить как ученик
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                <Users className="h-5 w-5" />
              </div>
              <CardTitle>Преподаватель</CardTitle>
              <CardDescription>
                Создавай профили учеников, анализируй слабые темы, подбирай материалы и
                выстраивай индивидуальные маршруты подготовки.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button
                className="w-full"
                variant="secondary"
                asChild
              >
                <a href="/teacher" onClick={() => window.localStorage.setItem("educaite-demo-role", "teacher")}>
                  Продолжить как преподаватель
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
