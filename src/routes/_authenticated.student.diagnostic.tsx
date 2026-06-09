import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/oge/stub-page";
export const Route = createFileRoute("/_authenticated/student/diagnostic")({
  component: () => (
    <StubPage
      title="Диагностика"
      description="Адаптивные мини-тесты для определения слабых тем и стартового уровня."
    />
  ),
});
