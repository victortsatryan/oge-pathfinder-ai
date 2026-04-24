import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Brain,
  CalendarDays,
  ChartColumnBig,
  CheckCircle2,
  ChevronRight,
  LogOut,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type ScreenStyle = "editorial-light" | "dark-academic" | "clean-minimal";
type ViewMode = "dashboard" | "calendar" | "diagnostics" | "analytics";
type AuthMode = "sign-in" | "sign-up";

type PreferenceRow = {
  screen_style: ScreenStyle;
  onboarding_completed: boolean;
};

const styleOptions: Array<{
  id: ScreenStyle;
  label: string;
  caption: string;
}> = [
  {
    id: "editorial-light",
    label: "Editorial light",
    caption: "Воздух, крупная типографика, мягкая подача.",
  },
  {
    id: "dark-academic",
    label: "Dark academic",
    caption: "Более глубокий контраст и собранный учебный ритм.",
  },
  {
    id: "clean-minimal",
    label: "Clean minimal",
    caption: "Спокойный минимализм с фокусом на план и результат.",
  },
];

const upcomingLessons = [
  { subject: "Математика", time: "09:00–10:00", topic: "Квадратные уравнения", status: "Фокус дня" },
  { subject: "Русский", time: "10:20–11:20", topic: "Сжатое изложение", status: "Практика" },
  { subject: "Английский", time: "11:40–12:40", topic: "Word formation", status: "Повторение" },
  { subject: "Биология", time: "13:30–14:30", topic: "Клетка и ткани", status: "Теория + тест" },
];

const weeklyChecks = [
  "Суббота: короткая диагностика по пройденным темам",
  "AI пересчитывает сложность после каждой проверки",
  "Ошибки автоматически попадают в блок повторения",
];

const subjectStats = [
  { subject: "Математика", progress: "62%", focus: "Текстовые задачи и геометрия" },
  { subject: "Русский", progress: "71%", focus: "Аргументация и изложение" },
  { subject: "Английский", progress: "68%", focus: "Грамматика и аудирование" },
  { subject: "Биология", progress: "74%", focus: "Системы органов и генетика" },
];

const diagnostics = [
  { title: "Входная диагностика", meta: "4 предмета · формат ОГЭ", state: "Готово к запуску" },
  { title: "Недельная диагностика", meta: "Каждую субботу", state: "Автопроверка" },
];

function applyScreenStyle(style: ScreenStyle) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.screenStyle = style;
}

export function OgeMvpApp() {
  const [selectedStyle, setSelectedStyle] = useState<ScreenStyle>("clean-minimal");
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [activeView, setActiveView] = useState<ViewMode>("dashboard");

  useEffect(() => {
    applyScreenStyle(selectedStyle);
  }, [selectedStyle]);

  useEffect(() => {
    let mounted = true;

    const syncPreferences = async (currentUserId: string, fallbackStyle: ScreenStyle) => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("screen_style, onboarding_completed")
        .eq("user_id", currentUserId)
        .maybeSingle<PreferenceRow>();

      if (error) {
        setStatusMessage("Не удалось загрузить настройки аккаунта.");
        return;
      }

      if (data?.screen_style) {
        if (!mounted) return;
        setSelectedStyle(data.screen_style);
        applyScreenStyle(data.screen_style);
        return;
      }

      await supabase.from("user_preferences").upsert(
        {
          user_id: currentUserId,
          screen_style: fallbackStyle,
          onboarding_completed: true,
        },
        { onConflict: "user_id" },
      );
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const currentUserId = data.session?.user?.id ?? null;
      setUserId(currentUserId);
      if (currentUserId) {
        await syncPreferences(currentUserId, selectedStyle);
      }
      setIsAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      const currentUserId = session?.user?.id ?? null;
      setUserId(currentUserId);
      setIsAuthLoading(false);
      if (currentUserId) {
        void syncPreferences(currentUserId, selectedStyle);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const recommendation = useMemo(() => {
    return selectedStyle === "clean-minimal"
      ? "Чистый интерфейс уменьшает отвлечение и держит фокус на ежедневном плане."
      : selectedStyle === "dark-academic"
        ? "Контрастный режим полезен для длинных вечерних сессий и плотной аналитики."
        : "Editorial light хорошо подходит для чтения теории и длинных текстовых блоков.";
  }, [selectedStyle]);

  const persistPreference = async (style: ScreenStyle) => {
    if (!userId) return;

    const { error } = await supabase.from("user_preferences").upsert(
      {
        user_id: userId,
        screen_style: style,
        onboarding_completed: true,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      setStatusMessage("Не удалось сохранить тему аккаунта.");
      return;
    }

    setStatusMessage("Тема сохранена для вашего аккаунта.");
  };

  const handleEmailAuth = async () => {
    setIsSubmitting(true);
    setStatusMessage("");

    const action =
      authMode === "sign-in"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });

    const { data, error } = await action;
    setIsSubmitting(false);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    if (authMode === "sign-up" && !data.session) {
      setStatusMessage("Проверьте почту и подтвердите аккаунт, затем войдите — тема уже выбрана.");
      return;
    }

    if (data.user) {
      await persistPreference(selectedStyle);
    }
  };

  const handleGoogleAuth = async () => {
    setStatusMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    if (error) {
      setStatusMessage(error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setStatusMessage("Вы вышли из аккаунта.");
  };

  const handleStyleSelect = async (style: ScreenStyle) => {
    setSelectedStyle(style);
    applyScreenStyle(style);
    if (userId) {
      await persistPreference(style);
    }
  };

  if (isAuthLoading) {
    return (
      <main className="app-shell">
        <div className="page-grid">
          <section className="panel panel-hero">
            <p className="eyebrow">OGЭ AI Coach</p>
            <h1 className="display-title">Подготавливаем персональный маршрут к ОГЭ.</h1>
            <p className="lead-copy">Загружаем тему интерфейса и настройки аккаунта.</p>
          </section>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="app-shell">
        <div className="page-grid two-column-layout">
          <section className="panel panel-hero">
            <div className="hero-stack">
              <p className="eyebrow">Стартовая настройка</p>
              <h1 className="display-title">Выберите стиль экрана перед началом подготовки.</h1>
              <p className="lead-copy">
                Вы выбрали <strong>clean minimal</strong>. После входа тема сохранится в аккаунте и будет
                применяться автоматически.
              </p>
            </div>

            <div className="selection-grid">
              {styleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={option.id === selectedStyle ? "selection-card is-active" : "selection-card"}
                  onClick={() => void handleStyleSelect(option.id)}
                >
                  <span className="selection-card__title">{option.label}</span>
                  <span className="selection-card__caption">{option.caption}</span>
                </button>
              ))}
            </div>

            <div className="info-strip">
              <Sparkles className="h-4 w-4" />
              <span>{recommendation}</span>
            </div>

            <div className="subject-grid">
              {subjectStats.map((item) => (
                <article key={item.subject} className="subject-tile">
                  <span className="subject-tile__name">{item.subject}</span>
                  <strong className="subject-tile__value">{item.progress}</strong>
                  <span className="subject-tile__meta">{item.focus}</span>
                </article>
              ))}
            </div>
          </section>

          <Card className="panel auth-panel">
            <CardHeader>
              <CardTitle>{authMode === "sign-in" ? "Вход в аккаунт" : "Создать аккаунт"}</CardTitle>
              <CardDescription>
                Тема интерфейса, ежедневный план и аналитика будут закреплены за вашим аккаунтом.
              </CardDescription>
            </CardHeader>
            <CardContent className="auth-stack">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button onClick={() => void handleEmailAuth()} disabled={isSubmitting || !email || !password}>
                {authMode === "sign-in" ? "Войти" : "Создать аккаунт"}
              </Button>
              <Button variant="outline" onClick={() => void handleGoogleAuth()}>
                Войти через Google
              </Button>
              <button
                type="button"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setAuthMode((prev) => (prev === "sign-in" ? "sign-up" : "sign-in"))}
              >
                {authMode === "sign-in" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
              </button>
              {statusMessage ? <p className="text-sm text-muted-foreground">{statusMessage}</p> : null}
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="page-grid app-layout">
        <section className="panel panel-hero">
          <div className="hero-topline">
            <div>
              <p className="eyebrow">OGЭ AI Coach · Clean minimal</p>
              <h1 className="display-title">Персональная подготовка к ОГЭ по 4 предметам.</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => void handleSignOut()}>
              <LogOut className="h-4 w-4" />
              Выйти
            </Button>
          </div>

          <div className="tab-row" role="tablist" aria-label="Разделы приложения">
            {[
              ["dashboard", "Dashboard", Brain],
              ["calendar", "Календарь", CalendarDays],
              ["diagnostics", "Диагностика", BookOpen],
              ["analytics", "Аналитика", ChartColumnBig],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                className={activeView === id ? "tab-chip is-active" : "tab-chip"}
                onClick={() => setActiveView(id as ViewMode)}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="selection-grid compact-grid">
            {styleOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={option.id === selectedStyle ? "selection-card is-active" : "selection-card"}
                onClick={() => void handleStyleSelect(option.id)}
              >
                <span className="selection-card__title">{option.label}</span>
                <span className="selection-card__caption">{option.caption}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="stats-grid">
          <article className="panel stat-block">
            <span className="stat-label">Период</span>
            <strong className="stat-value">27 апр — 30 мая</strong>
            <span className="stat-meta">Пн–Сб, 4 занятия в день</span>
          </article>
          <article className="panel stat-block">
            <span className="stat-label">Сегодня</span>
            <strong className="stat-value">4 слота</strong>
            <span className="stat-meta">1 предмет = 1 час</span>
          </article>
          <article className="panel stat-block">
            <span className="stat-label">AI-фокус</span>
            <strong className="stat-value">Геометрия + изложение</strong>
            <span className="stat-meta">Приоритет следующей недели</span>
          </article>
        </section>

        <section className="content-grid">
          <Card className="panel content-panel">
            <CardHeader>
              <CardTitle>
                {activeView === "dashboard"
                  ? "Ближайшие занятия"
                  : activeView === "calendar"
                    ? "Календарь подготовки"
                    : activeView === "diagnostics"
                      ? "Диагностика"
                      : "Аналитика ошибок"}
              </CardTitle>
              <CardDescription>
                {activeView === "dashboard"
                  ? "AI учитывает ошибки, слабые темы и перестраивает ежедневный план."
                  : activeView === "calendar"
                    ? "Каждый учебный день содержит по одному занятию на предмет."
                    : activeView === "diagnostics"
                      ? "Входная и еженедельная диагностика в формате ОГЭ с автопроверкой."
                      : "Собираем проблемные темы, динамику и рекомендации после каждого занятия."}
              </CardDescription>
            </CardHeader>
            <CardContent className="content-stack">
              {activeView === "dashboard" &&
                upcomingLessons.map((lesson) => (
                  <article key={lesson.subject} className="list-row">
                    <div>
                      <div className="list-row__title">{lesson.subject}</div>
                      <div className="list-row__meta">
                        {lesson.time} · {lesson.topic}
                      </div>
                    </div>
                    <span className="list-badge">{lesson.status}</span>
                  </article>
                ))}

              {activeView === "calendar" &&
                ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"].map((day) => (
                  <article key={day} className="list-row list-row--calendar">
                    <div>
                      <div className="list-row__title">{day}</div>
                      <div className="list-row__meta">4 занятия · математика, русский, английский, биология</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </article>
                ))}

              {activeView === "diagnostics" &&
                diagnostics.map((item) => (
                  <article key={item.title} className="list-row">
                    <div>
                      <div className="list-row__title">{item.title}</div>
                      <div className="list-row__meta">{item.meta}</div>
                    </div>
                    <span className="list-badge">{item.state}</span>
                  </article>
                ))}

              {activeView === "analytics" &&
                subjectStats.map((item) => (
                  <article key={item.subject} className="list-row">
                    <div>
                      <div className="list-row__title">{item.subject}</div>
                      <div className="list-row__meta">Слабое место: {item.focus}</div>
                    </div>
                    <span className="list-badge">{item.progress}</span>
                  </article>
                ))}
            </CardContent>
          </Card>

          <aside className="rail-stack">
            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Рекомендации AI</CardTitle>
                <CardDescription>После каждой практики система уточняет план.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                {weeklyChecks.map((item) => (
                  <div key={item} className="check-row">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="panel rail-panel">
              <CardHeader>
                <CardTitle>Слабые темы недели</CardTitle>
                <CardDescription>То, что будет усиливаться в следующих слотах.</CardDescription>
              </CardHeader>
              <CardContent className="content-stack">
                <div className="focus-pill">Математика · Геометрия</div>
                <div className="focus-pill">Русский · Изложение</div>
                <div className="focus-pill">Английский · Grammar</div>
                <div className="focus-pill">Биология · Генетика</div>
              </CardContent>
            </Card>
          </aside>
        </section>

        {statusMessage ? <p className="status-line">{statusMessage}</p> : null}
      </div>
    </main>
  );
}
