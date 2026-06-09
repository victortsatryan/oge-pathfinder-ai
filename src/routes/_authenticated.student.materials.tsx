import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/oge/stub-page";
export const Route = createFileRoute("/_authenticated/student/materials")({
  component: () => (
    <StubPage
      title="Материалы"
      description="Конспекты, видео и тренировочные подборки по темам ОГЭ."
    />
  ),
});
