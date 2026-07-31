import {
  adminCandidateSchema,
  candidateSchema,
  subjectSchema,
  type AdminCandidate,
  type Candidate,
  type Subject,
} from "@/lib/models/schemas";
import { parseList } from "@/lib/query/parse";
import {
  adminListCandidates,
  listMyCandidates,
  listSubjectsForLibrary,
} from "@/lib/community-library.functions";

/** Community Library domain repository. */
export const communityRepo = {
  async myCandidates(): Promise<Candidate[]> {
    const raw = await listMyCandidates();
    return parseList("community.myCandidates", candidateSchema, raw);
  },

  async subjects(): Promise<Subject[]> {
    const raw = await listSubjectsForLibrary();
    return parseList("community.subjects", subjectSchema, raw);
  },

  async adminQueue(
    status: "all" | "draft" | "submitted" | "in_review" | "approved" | "published" | "rejected" = "all",
  ): Promise<{ candidates: AdminCandidate[]; counts: Record<string, number> }> {
    const raw: unknown = await adminListCandidates({ data: { status } });
    const obj = (raw ?? {}) as Record<string, unknown>;
    const counts =
      obj.counts && typeof obj.counts === "object"
        ? (obj.counts as Record<string, number>)
        : {};
    return {
      candidates: parseList("community.adminCandidates", adminCandidateSchema, obj.candidates ?? []),
      counts,
    };
  },
};
