import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Users, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserMenu } from "@/components/oge/user-menu";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const [submitting, setSubmitting] = useState<"student" | "teacher" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (role: "student" | "teacher") => {
    setSubmitting(role);
    setError(null);
    window.localStorage.setItem("educaite-demo-role", role);
    window.location.href = role === "teacher" ? "/teacher" : "/student";
  };

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
                onClick={() => choose("student")}
                disabled={submitting !== null}
              >
                {submitting === "student" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Продолжить как ученик
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
                onClick={() => choose("teacher")}
                disabled={submitting !== null}
              >
                {submitting === "teacher" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Продолжить как преподаватель
              </Button>
            </CardContent>
          </Card>
        </div>

        {error ? <p className="text-sm text-destructive text-center mt-6">{error}</p> : null}
      </div>
    </main>
  );
}
