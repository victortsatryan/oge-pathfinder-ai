import { ErrorComponent, createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { OgeMvpApp } from "@/components/oge/oge-mvp-app";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildMvpState, ensureMvpSeed } from "@/lib/oge-mvp-data";

const loadMvpState = createServerFn({ method: "GET" }).handler(async () => {
  await ensureMvpSeed(supabaseAdmin);

  const [{ data: subjects, error: subjectsError }, { data: plans, error: plansError }, { data: lessons, error: lessonsError }, { data: diagnostics, error: diagnosticsError }, { data: recommendations, error: recommendationsError }] = await Promise.all([
    supabaseAdmin.from("subjects").select("*").order("sort_order"),
    supabaseAdmin.from("study_plans").select("*").order("created_at", { ascending: true }).limit(1),
    supabaseAdmin.from("lessons").select("*").order("lesson_date", { ascending: true }).order("slot_number", { ascending: true }),
    supabaseAdmin.from("diagnostic_sessions").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("ai_recommendations").select("*").order("created_at", { ascending: false }).limit(1),
  ]);

  if (subjectsError) throw new Error(`Не удалось загрузить предметы: ${subjectsError.message}`);
  if (plansError) throw new Error(`Не удалось загрузить план: ${plansError.message}`);
  if (lessonsError) throw new Error(`Не удалось загрузить уроки: ${lessonsError.message}`);
  if (diagnosticsError) throw new Error(`Не удалось загрузить диагностики: ${diagnosticsError.message}`);
  if (recommendationsError) {
    throw new Error(`Не удалось загрузить AI-рекомендации: ${recommendationsError.message}`);
  }

  const plan = plans?.[0];
  if (!plan) {
    throw new Error("План подготовки ещё не создан.");
  }

  return buildMvpState({
    subjects: subjects ?? [],
    plan,
    lessons: lessons ?? [],
    diagnostics: diagnostics ?? [],
    recommendations: recommendations ?? [],
  });
});

function IndexErrorComponent({ error }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-foreground">Не удалось загрузить MVP-данные</h1>
        <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => router.invalidate()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Повторить
          </button>
          <ErrorComponent error={error} />
        </div>
      </div>
    </div>
  );
}

function IndexNotFoundComponent() {
  return <div className="p-6 text-sm text-muted-foreground">Данные для MVP не найдены.</div>;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ОГЭ AI Coach — персональная подготовка" },
      {
        name: "description",
        content:
          "MVP-платформа для персонализированной подготовки к ОГЭ: диагностика, календарь, аналитика и AI-рекомендации.",
      },
      { property: "og:title", content: "ОГЭ AI Coach — персональная подготовка" },
      {
        property: "og:description",
        content:
          "Персональный план, ежедневные занятия, диагностика и адаптивные рекомендации для подготовки к ОГЭ.",
      },
    ],
  }),
  loader: () => loadMvpState(),
  staleTime: 30_000,
  pendingComponent: () => <div className="p-6 text-sm text-muted-foreground">Загружаем учебный план…</div>,
  errorComponent: IndexErrorComponent,
  notFoundComponent: IndexNotFoundComponent,
  component: Index,
});

function Index() {
  const data = Route.useLoaderData();

  return <OgeMvpApp data={data} />;
}
