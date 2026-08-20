import type { UserRole } from "@/lib/role.functions";

export type AccessSnapshot = {
  primaryRole: UserRole | null;
  roles: UserRole[];
  onboardingCompleted: boolean;
};

/**
 * Single source of truth for post-login routing.
 * Decisions are based on DB data only (roles + profiles.onboarding_completed).
 */
export function destinationForAccess(access: AccessSnapshot): string {
  if (access.roles.includes("admin")) return "/admin/content";
  if (access.primaryRole === "teacher") return "/teacher";
  if (access.primaryRole === "student") {
    return access.onboardingCompleted ? "/student" : "/onboarding";
  }
  return "/onboarding";
}
