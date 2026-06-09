import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/oge/stub-page";
export const Route = createFileRoute("/_authenticated/teacher/diagnostic")({
  component: () => (
    <StubPage
      title="Диагностика"
      description="Назначайте диагностические сессии и анализируйте результаты учеников."
    />
  ),
});
