import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  loader: async () => {
    const role =
      typeof window !== "undefined" ? window.localStorage.getItem("educaite-demo-role") : null;
    if (role === "student") throw redirect({ to: "/student" });
    if (role === "teacher") throw redirect({ to: "/teacher" });
    throw redirect({ to: "/onboarding" });
  },
  component: () => null,
});
