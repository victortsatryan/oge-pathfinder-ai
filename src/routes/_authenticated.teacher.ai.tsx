import { createFileRoute, Link, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/teacher/ai")({
  component: () => <Navigate to="/teacher/advisor" replace />,
});

// keep Link import to avoid unused warning in some setups
void Link;
