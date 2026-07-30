import { z } from "zod";

export const applySchema = z.object({
  cvId: z.string().min(1, "Vui lòng chọn CV"),
  coverLetter: z.string().max(3000, "Thư giới thiệu tối đa 3000 ký tự"),
});

export type ApplyInput = z.infer<typeof applySchema>;
