import { createFileRoute, redirect } from "@tanstack/react-router";

import { getMyAccess } from "@/lib/role.functions";
import { destinationForAccess } from "@/lib/post-login-route";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  loader: async () => {
    // Routing is decided from DB state (roles + onboarding_completed), not local state.
    try {
      const access = await getMyAccess();
      throw redirect({ to: destinationForAccess(access) as never });
    } catch (e) {
      if (e && typeof e === "object" && "to" in (e as Record<string, unknown>)) throw e;
      if (e && typeof e === "object" && (e as { isRedirect?: boolean }).isRedirect) throw e;
      throw redirect({ to: "/onboarding" });
    }
  },
  component: () => null,
});
