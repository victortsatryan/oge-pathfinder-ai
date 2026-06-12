import { createFileRoute, redirect } from "@tanstack/react-router";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async () => {
    throw redirect({ to: "/onboarding" });
  },
  component: () => null,
});
