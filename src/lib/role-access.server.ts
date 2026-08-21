import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type UserRole = "student" | "teacher" | "admin";

export type MyAccess = {
  userId: string;
  roles: UserRole[];
  primaryRole: UserRole | null;
  hasProfile: boolean;
  profileRole: "student" | "teacher" | null;
  onboardingCompleted: boolean;
};

// Reads access state for the current caller. Returns null (never throws a
// Response) when there is no valid session, so callers can treat
// "not signed in" as a normal state instead of a runtime error.
export async function readMyAccess(): Promise<MyAccess | null> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  const request = getRequest();
  const authHeader = request?.headers?.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  if (!token) return null;

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return null;

  const sb = supabase as any;
  const [rolesRes, profileRes] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb
      .from("profiles")
      .select("role, onboarding_completed")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (rolesRes.error) throw rolesRes.error;
  if (profileRes.error) throw profileRes.error;

  const roles = ((rolesRes.data ?? []) as { role: string }[])
    .map((r) => r.role)
    .filter((r): r is UserRole => r === "student" || r === "teacher" || r === "admin");

  const primaryRole: UserRole | null = roles.includes("admin")
    ? "admin"
    : roles.includes("teacher")
      ? "teacher"
      : roles.includes("student")
        ? "student"
        : null;

  return {
    userId: userId as string,
    roles,
    primaryRole,
    hasProfile: Boolean(profileRes.data),
    profileRole: (profileRes.data?.role ?? null) as "student" | "teacher" | null,
    onboardingCompleted: Boolean(profileRes.data?.onboarding_completed),
  };
}
