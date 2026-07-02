import { z } from "zod";

const keyTitle = z.object({ key: z.string().min(1), title: z.string().min(1), order: z.number().int().optional() });

export const pcsSchema = z.object({
  schema_version: z.string(),
  pcs_version: z.string(),
  education_system: z.string(),
  grade: z.union([z.string(), z.number()]).transform((v) => String(v)),
  program: keyTitle,
  subject: keyTitle,
  section: keyTitle,
  topic: keyTitle,
  subtopic: keyTitle.optional(),
  learning_objective: z.object({
    key: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    theory: z.string().min(1),
    algorithm: z.string().optional(),
    status: z.enum(["draft", "reviewed", "published", "archived"]).optional(),
  }),
  examples: z.array(z.object({
    title: z.string().optional(),
    statement: z.string(),
    solution: z.string().optional(),
    order: z.number().int().optional(),
  })).optional(),
  task_patterns: z.array(z.object({
    key: z.string().optional(),
    statement_template: z.string(),
    answer_schema: z.any().optional(),
    difficulty: z.number().int().optional(),
    hints: z.any().optional(),
    order: z.number().int().optional(),
  })).min(1),
  materials: z.array(z.object({
    type: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    url: z.string().optional(),
    content_text: z.string().optional(),
    video_url: z.string().optional(),
    file_url: z.string().optional(),
    source_name: z.string().optional(),
    license_note: z.string().optional(),
    difficulty: z.number().int().optional(),
    estimated_time_minutes: z.number().int().optional(),
    status: z.string().optional(),
  })).optional(),
  sources: z.array(z.object({
    name: z.string(),
    url: z.string().optional(),
    citation: z.string().optional(),
    license: z.string().optional(),
    order: z.number().int().optional(),
  })).optional(),
  diagnostic: z.object({
    min_tasks: z.number().int().optional(),
    mastery_threshold: z.number().int().optional(),
    difficulty_curve: z.any().optional(),
  }).optional(),
});

export type PcsPayload = z.infer<typeof pcsSchema>;
