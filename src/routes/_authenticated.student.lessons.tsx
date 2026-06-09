import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/oge/stub-page";
export const Route = createFileRoute("/_authenticated/student/lessons")({
  component: () => (
    <StubPage
      title="Занятия"
      description="Список всех твоих занятий по плану подготовки."
    />
  ),
});
