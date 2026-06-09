import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/oge/stub-page";
export const Route = createFileRoute("/_authenticated/teacher/plans")({
  component: () => (
    <StubPage
      title="Индивидуальные планы"
      description="Конструктор маршрутов подготовки: темы, материалы, проверки."
    />
  ),
});
