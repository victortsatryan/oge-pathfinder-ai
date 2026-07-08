import { createFileRoute, redirect } from "@tanstack/react-router";

// Профиль ученика переехал в /student/profile, чтобы жить внутри рельса ученика.
export const Route = createFileRoute("/_authenticated/profile")({
  beforeLoad: () => {
    throw redirect({ to: "/student/profile" });
  },
  component: () => null,
});
