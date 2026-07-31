import { z } from "zod";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "./job-fields";

const emptyToNull = (v: unknown) => (v === "" || v == null ? null : v);

export const jobSchema = z.object({
  title: z.string().min(1, "Vui lòng nhập tiêu đề"),
  company: z.string(),
  rawText: z.string().min(1, "Vui lòng nhập mô tả công việc"),
  location: z.string(),
  skills: z.string(),
  employmentType: z.preprocess(emptyToNull, z.enum(EMPLOYMENT_TYPES).nullable()),
  experienceLevel: z.preprocess(emptyToNull, z.enum(EXPERIENCE_LEVELS).nullable()),
});

export type JobInput = z.infer<typeof jobSchema>;
