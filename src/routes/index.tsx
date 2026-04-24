import { createFileRoute } from "@tanstack/react-router";

import { OgeMvpApp } from "@/components/oge/oge-mvp-app";

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
  component: Index,
});

function Index() {
  return <OgeMvpApp />;
}
