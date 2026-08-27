import { z } from "zod";
import { passwordStrength } from "./password-strength";

export const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Tên không được để trống"),
  password: z.string().superRefine((val, ctx) => {
    const r = passwordStrength(val);
    if (!r.ok) ctx.addIssue({ code: "custom", message: r.error! });
  }),
  role: z.enum(["CANDIDATE", "RECRUITER"]).default("CANDIDATE"),
});

// z.input: role là tùy chọn ở đầu vào (schema tự điền mặc định CANDIDATE khi parse).
export type RegisterInput = z.input<typeof registerSchema>;
