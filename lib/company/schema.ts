import { z } from "zod";

const httpUrlOrBlank = z
  .string()
  .transform((v) => (/^https?:\/\//i.test(v.trim()) ? v.trim() : ""));

export const companySchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên công ty"),
  description: z.string(),
  website: httpUrlOrBlank,
  location: z.string(),
  logoUrl: httpUrlOrBlank,
});

export type CompanyInput = z.infer<typeof companySchema>;
