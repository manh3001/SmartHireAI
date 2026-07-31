import { z } from "zod";

export const companySchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên công ty"),
  description: z.string(),
  website: z.string(),
  location: z.string(),
  logoUrl: z.string(),
});

export type CompanyInput = z.infer<typeof companySchema>;
