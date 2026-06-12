import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "@/components/oge/user-menu";
import { demoProfile, demoProgress } from "@/lib/demo-data";

const SUBJECT_OPTIONS = [
  "Математика",
  "Русский язык",
  "Английский язык",
  "Биология",
  "Физика",
  "Химия",
  "История",
  "Обществознание",
  "География",
  "Информатика",
  "Литература",
];

const GRADE_OPTIONS = [5, 6, 7, 8, 9, 10, 11];

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const profile = demoProfile;
  const progress = demoProgress;
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [grade, setGrade] = useState<number | "">(profile.grade ?? "");
  const [program, setProgram] = useState(profile.program ?? "");
  const [subjects, setSubjects] = useState<string[]>(profile.subjects ?? []);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [savedAt]);

  const toggleSubject = (subject: string) => {
    setSubjects((current) =>
      current.includes(subject) ? current.filter((s) => s !== subject) : [...current, subject],
    );
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      window.localStorage.setItem(
        "educaite-demo-profile",
        JSON.stringify({ firstName, lastName, grade, program, subjects }),
      );
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить профиль");
    } finally {
      setSaving(false);
    }
  };

  const totalAccuracy = useMemo(() => {
    if (progress.totalAttempts === 0) return 0;
    return Math.round((progress.totalCorrect / progress.totalAttempts) * 100);
  }, [progress]);

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1" /> К календарю
            </Link>
          </Button>
          <UserMenu />
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Мой профиль</h1>
          <p className="text-muted-foreground mt-1">Заполните анкету и следите за своим прогрессом по предметам.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Анкета</CardTitle>
              <CardDescription>Эти данные используются для персонализации программы.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">Имя</Label>
                    <Input
                      id="first_name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      maxLength={80}
                      placeholder="Анна"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name">Фамилия</Label>
                    <Input
                      id="last_name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      maxLength={80}
                      placeholder="Петрова"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Класс</Label>
                  <div className="flex flex-wrap gap-2">
                    {GRADE_OPTIONS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGrade(g)}
                        className={
                          (grade === g
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-accent border-input") +
                          " border rounded-md px-3 py-1.5 text-sm transition-colors"
                        }
                      >
                        {g} класс
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="program">Программа подготовки</Label>
                  <Textarea
                    id="program"
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    maxLength={200}
                    placeholder="Например: ОГЭ 2026, профильная математика, английский B1+"
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Предметы</Label>
                  <p className="text-xs text-muted-foreground">Выберите предметы, по которым готовитесь.</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SUBJECT_OPTIONS.map((subject) => {
                      const active = subjects.includes(subject);
                      return (
                        <button
                          key={subject}
                          type="button"
                          onClick={() => toggleSubject(subject)}
                          className={
                            (active
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-background hover:bg-accent border-input") +
                            " border rounded-full px-3 py-1.5 text-sm transition-colors"
                          }
                          aria-pressed={active}
                        >
                          {subject}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Сохранить
                  </Button>
                  {savedAt ? (
                    <span className="text-sm text-muted-foreground">Сохранено</span>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Прогресс</CardTitle>
              <CardDescription>Сводка по предметам на основе ваших попыток и занятий.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border p-4 bg-muted/30">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Всего попыток</span>
                  <span className="text-2xl font-semibold">{progress.totalAttempts}</span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-sm text-muted-foreground">Доля верных</span>
                  <span className="text-2xl font-semibold">{totalAccuracy}%</span>
                </div>
              </div>

              {progress.bySubject.length === 0 ? (
                <p className="text-sm text-muted-foreground">Пока нет данных. Начните с диагностики или занятий.</p>
              ) : (
                <ul className="space-y-4">
                  {progress.bySubject.map((row: any) => (
                    <li key={row.subjectId} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{row.name}</span>
                        <Badge variant="outline">
                          {row.completedLessons}/{row.totalLessons} занятий
                        </Badge>
                      </div>
                      <Progress value={row.progressPercent} />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Выполнено: {row.progressPercent}%</span>
                        <span>
                          Верных: {row.correct}/{row.attempts} ({row.accuracyPercent}%)
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
