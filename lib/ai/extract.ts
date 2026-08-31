import { z } from "zod";
import type { CvInput } from "@/lib/cv/types";

export const cvExtractionSchema = z.object({
  title: z.string(),
  profile: z.object({
    fullName: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    linkedin: z.string(),
    github: z.string(),
    portfolio: z.string(),
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
      degree: z.string(),
      major: z.string(),
      startDate: z.string(),
      endDate: z.string(),
      gpa: z.string(),
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
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string(),
      date: z.string(),
    }),
  ),
});

export type CvExtraction = CvInput;

export const EXTRACTION_SYSTEM =
  "Bạn là trợ lý trích xuất dữ liệu CV. Từ văn bản CV, hãy trích xuất thông tin thành JSON đúng cấu trúc yêu cầu. " +
  "Để trống (chuỗi rỗng) cho trường không tìm thấy; KHÔNG bịa thông tin. Giữ nguyên tiếng Việt.";

export function buildExtractionPrompt(text: string): string {
  return `Trích xuất thông tin từ nội dung CV sau thành JSON đúng cấu trúc.
Các trường bắt buộc: title, profile (fullName, headline, email, phone, location, linkedin, github, portfolio, summary), experiences, educations (school, degree, major, startDate, endDate, gpa), skills, projects, languages (name, level), certifications (name, issuer, date).
Để chuỗi rỗng nếu không có thông tin. Ngày tháng giữ dạng ngắn (vd "2023" hoặc "2023-01").

=== NỘI DUNG CV ===
${text}`;
}
