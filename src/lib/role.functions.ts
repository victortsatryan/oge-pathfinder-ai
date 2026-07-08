import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserRole = "student" | "teacher" | "admin";

const roleSchema = z.object({ role: z.enum(["student", "teacher"]) });

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select("role, onboarding_completed")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return {
      role: (data?.role ?? null) as "student" | "teacher" | null,
      onboarding_completed: Boolean(data?.onboarding_completed),
    };
  });

export const setMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roleSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const sb = supabase as any;
    const { error } = await sb
      .from("profiles")
      .update({ role: data.role, onboarding_completed: true })
      .eq("user_id", userId);
    if (error) throw error;
    const { error: rpcErr } = await sb.rpc("assign_self_role", { _role: data.role });
    if (rpcErr) throw rpcErr;
    return { ok: true, role: data.role };
  });

export const resetMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ onboarding_completed: false })
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// Aggregate access info: roles from user_roles, plus profile onboarding
// state. Used by the auth callback to decide where to send the user, and
// by role layouts to enforce production access control.
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
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

    // Priority: admin > teacher > student.
    const primaryRole: UserRole | null = roles.includes("admin")
      ? "admin"
      : roles.includes("teacher")
        ? "teacher"
        : roles.includes("student")
          ? "student"
          : null;

    return {
      userId,
      roles,
      primaryRole,
      hasProfile: Boolean(profileRes.data),
      profileRole: (profileRes.data?.role ?? null) as "student" | "teacher" | null,
      onboardingCompleted: Boolean(profileRes.data?.onboarding_completed),
    };
  });
