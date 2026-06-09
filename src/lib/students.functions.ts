import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().max(80).optional().nullable(),
  grade: z.number().int().min(1).max(11).optional().nullable(),
  subjects: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const idSchema = z.object({ id: z.string().uuid() });

const updateSchema = idSchema.extend({
  first_name: z.string().trim().min(1).max(80).optional(),
  last_name: z.string().trim().max(80).nullable().optional(),
  grade: z.number().int().min(1).max(11).nullable().optional(),
  subjects: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const listMyStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("students")
      .select("id, first_name, last_name, grade, subjects, notes, created_at, updated_at")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getStudent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await (supabase as any)
      .from("students")
      .select("id, first_name, last_name, grade, subjects, notes, created_at, updated_at")
      .eq("id", data.id)
      .eq("teacher_id", userId)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await (supabase as any)
      .from("students")
      .insert({ ...data, teacher_id: userId })
      .select("id, first_name, last_name, grade, subjects, notes, created_at, updated_at")
      .single();
    if (error) throw error;
    return row;
  });

export const updateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { data: row, error } = await (supabase as any)
      .from("students")
      .update(patch)
      .eq("id", id)
      .eq("teacher_id", userId)
      .select("id, first_name, last_name, grade, subjects, notes, created_at, updated_at")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("students")
      .delete()
      .eq("id", data.id)
      .eq("teacher_id", userId);
    if (error) throw error;
    return { ok: true };
  });
