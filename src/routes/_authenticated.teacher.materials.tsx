import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/oge/stub-page";
export const Route = createFileRoute("/_authenticated/teacher/materials")({
  component: () => (
    <StubPage
      title="Материалы"
      description="Библиотека конспектов, видео и тренировочных заданий."
    />
  ),
});
