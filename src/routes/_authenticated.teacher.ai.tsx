import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/teacher/ai")({
  component: () => <Navigate to="/teacher/advisor" replace />,
});
