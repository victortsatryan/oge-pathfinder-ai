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

  async adminCandidates(
    status: "all" | "draft" | "submitted" | "in_review" | "approved" | "published" | "rejected" = "all",
  ): Promise<AdminCandidate[]> {
    const raw = await adminListCandidates({ data: { status } });
    return parseList("community.adminCandidates", adminCandidateSchema, raw);
  },
};
