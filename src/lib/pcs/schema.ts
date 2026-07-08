import { z } from "zod";

const keyTitle = z.object({ key: z.string().min(1), title: z.string().min(1), order: z.number().int().optional() });

// -------- Learning objective variant (default) --------

export const pcsLearningObjectiveSchema = z.object({
  schema_version: z.string(),
  pcs_version: z.string(),
  kind: z.literal("learning_objective").optional(),
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

export type PcsPayload = z.infer<typeof pcsLearningObjectiveSchema>;
// Kept for backward compatibility with existing imports.
export const pcsSchema = pcsLearningObjectiveSchema;

// -------- Diagnostic test variant --------

const answerType = z.enum(["single", "multiple", "text"]);
const difficulty = z.enum(["easy", "medium", "hard"]);

export const pcsDiagnosticTaskSchema = z.object({
  key: z.string().min(1),
  topic_key: z.string().optional(),
  prompt: z.string().min(1),
  answer_type: answerType.default("single"),
  options: z.array(z.string()).optional(),
  correct_answer: z.union([z.string(), z.array(z.string())]),
  explanation: z.string().optional(),
  difficulty: difficulty.optional(),
  task_type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  points: z.number().int().optional(),
  order: z.number().int().optional(),
  source_name: z.string().optional(),
  source_url: z.string().optional(),
});

export const pcsDiagnosticSchema = z.object({
  schema_version: z.string(),
  pcs_version: z.string(),
  kind: z.literal("diagnostic_test"),
  education_system: z.string(),
  grade: z.union([z.string(), z.number()]).transform((v) => String(v)),
  program: keyTitle.optional(),
  subject: keyTitle,
  diagnostic_test: z.object({
    key: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    diagnostic_type: z.string().default("entry"),
    duration_minutes: z.number().int().optional(),
    source_name: z.string().optional(),
    source_url: z.string().optional(),
    is_public: z.boolean().optional(),
    tasks: z.array(pcsDiagnosticTaskSchema).min(1),
  }),
});

export type PcsDiagnosticPayload = z.infer<typeof pcsDiagnosticSchema>;

// -------- Any variant --------

export function detectPcsKind(json: unknown): "diagnostic_test" | "learning_objective" {
  if (json && typeof json === "object" && (json as any).kind === "diagnostic_test") {
    return "diagnostic_test";
  }
  return "learning_objective";
}
