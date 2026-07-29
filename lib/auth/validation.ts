import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Tên không được để trống"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  role: z.enum(["CANDIDATE", "RECRUITER"]).default("CANDIDATE"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
