import { z } from "zod";

export const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập nội dung")
    .max(2000, "Tin nhắn tối đa 2000 ký tự"),
});

export type MessageInput = z.infer<typeof messageSchema>;
