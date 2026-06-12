import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  loader: async () => {
    throw redirect({ to: "/onboarding" });
  },
  component: () => null,
});
