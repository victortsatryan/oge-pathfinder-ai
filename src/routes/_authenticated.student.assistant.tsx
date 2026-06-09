import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/oge/stub-page";
export const Route = createFileRoute("/_authenticated/student/assistant")({
  component: () => (
    <StubPage
      title="AI-ассистент"
      description="Задавай вопросы по темам ОГЭ и получай объяснения с примерами."
    />
  ),
});
