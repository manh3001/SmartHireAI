import { z } from "zod";
import type { CvInput } from "@/lib/cv/types";

export const cvExtractionSchema = z.object({
  title: z.string(),
  profile: z.object({
    fullName: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    summary: z.string(),
  }),
  experiences: z.array(
    z.object({
      company: z.string(),
      position: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      description: z.string(),
    }),
  ),
  educations: z.array(
    z.object({
      school: z.string(),
      major: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }),
  ),
  skills: z.array(z.object({ name: z.string(), level: z.string() })),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      tech: z.string(),
      link: z.string(),
    }),
  ),
});

// Kết quả khớp cấu trúc CvInput.
export type CvExtraction = CvInput;

export const EXTRACTION_SYSTEM =
  "Bạn là trợ lý trích xuất dữ liệu CV. Từ văn bản CV, hãy trích xuất thông tin thành JSON đúng cấu trúc yêu cầu. " +
  "Để trống (chuỗi rỗng) cho trường không tìm thấy; KHÔNG bịa thông tin. Giữ nguyên tiếng Việt.";

export function buildExtractionPrompt(text: string): string {
  return `Trích xuất thông tin từ nội dung CV sau thành JSON đúng cấu trúc (title, profile, experiences, educations, skills, projects).
Nếu không có thông tin cho một trường, để chuỗi rỗng. Ngày tháng giữ dạng ngắn (vd "2023" hoặc "2023-01").

=== NỘI DUNG CV ===
${text}`;
}
