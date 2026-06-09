import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/oge/stub-page";
export const Route = createFileRoute("/_authenticated/teacher/analytics")({
  component: () => (
    <StubPage
      title="Аналитика"
      description="Динамика прогресса, частые ошибки, эффективность занятий."
    />
  ),
});
