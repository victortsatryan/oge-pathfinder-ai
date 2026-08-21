import {
  diagnosticHistoryRowSchema,
  diagnosticTestWithStatusSchema,
  type DiagnosticHistoryRow,
  type DiagnosticTestWithStatus,
} from "@/lib/models/schemas";
import { safeAwait, parseList } from "@/lib/query/parse";
import {
  listAvailableDiagnostics,
  listMyDiagnosticHistory,
} from "@/lib/diagnostic.functions";

/** Diagnostics domain repository. */
export const diagnosticRepo = {
  async available(
    filter: { subject_id?: string; diagnostic_type?: string } = {},
  ): Promise<DiagnosticTestWithStatus[]> {
    const raw = await safeAwait("diagnostic.available", () => listAvailableDiagnostics({ data: filter }));
    return parseList("diagnostic.available", diagnosticTestWithStatusSchema, raw);
  },

  async history(): Promise<DiagnosticHistoryRow[]> {
    const raw = await safeAwait("diagnostic.history", () => listMyDiagnosticHistory());
    return parseList("diagnostic.history", diagnosticHistoryRowSchema, raw);
  },
};
