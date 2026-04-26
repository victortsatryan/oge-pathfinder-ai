import { createFileRoute } from "@tanstack/react-router";

import { OgeMvpApp } from "@/components/oge/oge-mvp-app";
import { applyLocalOverridesToState } from "@/lib/oge-mvp-data";
import { loadMvpState } from "@/lib/oge-mvp.functions";
import { loadLocalLessonOverrides } from "@/lib/oge-lesson-overrides";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ОГЭ AI Coach — календарь подготовки" },
      {
        name: "description",
        content:
          "Календарь подготовки к ОГЭ на весь период: дневная сетка, недельный режим, статусы занятий и связанные материалы.",
      },
      { property: "og:title", content: "ОГЭ AI Coach — календарь подготовки" },
      {
        property: "og:description",
        content: "Учебный план по дням, неделям и предметам с карточками занятий, материалами и результатами.",
      },
    ],
  }),
  loader: async () => {
    const base = await loadMvpState();
    return applyLocalOverridesToState(base, loadLocalLessonOverrides());
  },
  staleTime: 30_000,
  pendingComponent: () => <div className="p-6 text-sm text-muted-foreground">Загружаем календарь обучения…</div>,
  component: Index,
});

function Index() {
  const data = Route.useLoaderData();

  return <OgeMvpApp data={data} />;
}

