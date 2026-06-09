import { createFileRoute, redirect } from "@tanstack/react-router";

import { getMyRole } from "@/lib/role.functions";

export const Route = createFileRoute("/_authenticated/")({
  loader: async () => {
    const { role, onboarding_completed } = await getMyRole();
    if (!role || !onboarding_completed) {
      throw redirect({ to: "/onboarding" });
    }
    throw redirect({ to: role === "teacher" ? "/teacher" : "/student" });
  },
  component: () => null,
});
