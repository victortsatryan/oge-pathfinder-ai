import {
  diagnosticHistoryRowSchema,
  diagnosticTestSchema,
  type DiagnosticHistoryRow,
  type DiagnosticTest,
} from "@/lib/models/schemas";
import { parseList } from "@/lib/query/parse";
import {
  listAvailableDiagnostics,
  listMyDiagnosticHistory,
} from "@/lib/diagnostic.functions";

/** Diagnostics domain repository. */
export const diagnosticRepo = {
  async available(
    filter: { subject_id?: string; diagnostic_type?: string } = {},
  ): Promise<DiagnosticTest[]> {
    const raw = await listAvailableDiagnostics({ data: filter });
    return parseList("diagnostic.available", diagnosticTestSchema, raw);
  },

  async history(): Promise<DiagnosticHistoryRow[]> {
    const raw = await listMyDiagnosticHistory();
    return parseList("diagnostic.history", diagnosticHistoryRowSchema, raw);
  },
};
