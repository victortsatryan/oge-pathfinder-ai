import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserRole = "student" | "teacher";

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
      role: (data?.role ?? null) as UserRole | null,
      onboarding_completed: Boolean(data?.onboarding_completed),
    };
  });

export const setMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => roleSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ role: data.role, onboarding_completed: true })
      .eq("user_id", userId);
    if (error) throw error;
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
