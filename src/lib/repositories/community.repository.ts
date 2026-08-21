import {
  adminCandidateSchema,
  candidateSchema,
  libraryMaterialSchema,
  subjectSchema,
  type AdminCandidate,
  type Candidate,
  type LibraryMaterial,
  type Subject,
} from "@/lib/models/schemas";
import { safeAwait, parseList } from "@/lib/query/parse";
import {
  adminListCandidates,
  listMyCandidates,
  listPublicLibrary,
  listSubjectsForLibrary,
} from "@/lib/community-library.functions";

/** Community Library domain repository. */
export const communityRepo = {
  async myCandidates(): Promise<Candidate[]> {
    const raw = await safeAwait("community.myCandidates", () => listMyCandidates());
    return parseList("community.myCandidates", candidateSchema, raw);
  },

  async publicMaterials(
    filter: {
      material_type?: string;
      topic_id?: string;
      search?: string;
      page?: number;
      page_size?: number;
    } = {},
  ): Promise<{ materials: LibraryMaterial[]; total: number }> {
    const raw: unknown = await safeAwait("community.publicMaterials", () => listPublicLibrary({ data: filter }));
    const obj = (raw ?? {}) as Record<string, unknown>;
    const materials = parseList(
      "community.publicMaterials",
      libraryMaterialSchema,
      obj.materials ?? raw,
    );
    const total = typeof obj.total === "number" ? obj.total : materials.length;
    return { materials, total };
  },

  async subjects(): Promise<Subject[]> {
    const raw = await safeAwait("community.subjects", () => listSubjectsForLibrary());
    return parseList("community.subjects", subjectSchema, raw);
  },

  async adminQueue(
    status: "all" | "draft" | "submitted" | "in_review" | "approved" | "published" | "rejected" = "all",
  ): Promise<{ candidates: AdminCandidate[]; counts: Record<string, number> }> {
    const raw: unknown = await safeAwait("community.adminQueue", () => adminListCandidates({ data: { status } }));
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
