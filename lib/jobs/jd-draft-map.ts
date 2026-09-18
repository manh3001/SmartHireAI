import type { JdDraft } from "@/lib/ai/jd-draft-schema";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "@/lib/jobs/job-fields";
import { normalizeCategory } from "@/lib/jobs/job-categories";

export type JdFormValues = {
  rawText: string;
  skills: string;
  category: string | null;
  employmentType: string | null;
  experienceLevel: string | null;
};

export function mapDraftToForm(draft: JdDraft): JdFormValues {
  const emp =
    draft.employmentType && (EMPLOYMENT_TYPES as readonly string[]).includes(draft.employmentType)
      ? draft.employmentType
      : null;
  const exp =
    draft.experienceLevel && (EXPERIENCE_LEVELS as readonly string[]).includes(draft.experienceLevel)
      ? draft.experienceLevel
      : null;
  return {
    rawText: draft.description,
    skills: draft.skills.join(", "),
    category: normalizeCategory(draft.categorySlug),
    employmentType: emp,
    experienceLevel: exp,
  };
}
