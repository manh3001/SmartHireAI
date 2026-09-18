import { z } from "zod";

export const salaryNoteSchema = z.object({
  note: z.string(),
});

export type SalaryNote = z.infer<typeof salaryNoteSchema>;
