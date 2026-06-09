import { createFileRoute } from "@tanstack/react-router";

import { OgeMvpApp } from "@/components/oge/oge-mvp-app";
import { applyLocalOverridesToState } from "@/lib/oge-mvp-data";
import { loadMvpState } from "@/lib/oge-mvp.functions";
import { loadLocalLessonOverrides } from "@/lib/oge-lesson-overrides";

export const Route = createFileRoute("/_authenticated/student/calendar")({
  loader: async () => {
    const base = await loadMvpState();
    return applyLocalOverridesToState(base, loadLocalLessonOverrides());
  },
  staleTime: 30_000,
  pendingComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Загружаем календарь обучения…</div>
  ),
  component: () => {
    const data = Route.useLoaderData();
    return <OgeMvpApp data={data} />;
  },
});
