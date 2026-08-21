import { createFileRoute, redirect } from "@tanstack/react-router";

import { getMyAccessOptional } from "@/lib/role.functions";
import { destinationForAccess } from "@/lib/post-login-route";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  loader: async () => {
    // Routing is decided from DB state (roles + onboarding_completed), not local state.
    let dest = "/onboarding";
    try {
      const access = await getMyAccessOptional();
      dest = destinationForAccess(access);
    } catch {
      dest = "/onboarding";
    }
    throw redirect({ to: dest as never });
  },
  component: () => null,
});

