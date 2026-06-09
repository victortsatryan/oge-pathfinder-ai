import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/oge/stub-page";
export const Route = createFileRoute("/_authenticated/teacher/assistant")({
  component: () => (
    <StubPage
      title="AI-помощник преподавателя"
      description="Генерация рекомендаций, объяснений и заданий под конкретного ученика."
    />
  ),
});
