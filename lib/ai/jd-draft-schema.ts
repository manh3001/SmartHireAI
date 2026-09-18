import { z } from "zod";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "@/lib/jobs/job-fields";

export const jdDraftSchema = z.object({
  description: z.string(),
  skills: z.array(z.string()),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullable(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).nullable(),
  categorySlug: z.string().nullable(),
});

export type JdDraft = z.infer<typeof jdDraftSchema>;
