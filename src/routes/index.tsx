import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { OgeMvpApp } from "@/components/oge/oge-mvp-app";
import { loadDefaultMvpState } from "@/lib/oge-mvp-data";

const loadMvpState = createServerFn({ method: "GET" }).handler(async () => {
  return loadDefaultMvpState();
});

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
  component: Index,
});

function Index() {
  const data = Route.useLoaderData();

  return <OgeMvpApp data={data} />;
}
