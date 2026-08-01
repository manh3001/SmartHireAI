import { formatSalary } from "./salary";

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
export type ExperienceLevel = "INTERN" | "JUNIOR" | "MID" | "SENIOR" | "LEAD";

export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERNSHIP",
] as const satisfies readonly EmploymentType[];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian",
  CONTRACT: "Hợp đồng",
  INTERNSHIP: "Thực tập",
};

export const EXPERIENCE_LEVELS = [
  "INTERN",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
] as const satisfies readonly ExperienceLevel[];

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  INTERN: "Thực tập sinh",
  JUNIOR: "Junior",
  MID: "Middle",
  SENIOR: "Senior",
  LEAD: "Lead",
};

export type JobTextInput = {
  location?: string | null;
  employmentType?: EmploymentType | null;
  experienceLevel?: ExperienceLevel | null;
  skills?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean | null;
  rawText: string;
};

// Ghép các trường cấu trúc có mặt thành một dòng meta rồi tới rawText, để đưa
// vào AI. Không có trường cấu trúc nào -> trả nguyên rawText.
export function composeJdText(job: JobTextInput): string {
  const meta: string[] = [];
  if (job.location?.trim()) meta.push(`Địa điểm: ${job.location.trim()}`);
  if (job.employmentType)
    meta.push(`Loại hình: ${EMPLOYMENT_TYPE_LABELS[job.employmentType]}`);
  if (job.experienceLevel)
    meta.push(`Cấp bậc: ${EXPERIENCE_LEVEL_LABELS[job.experienceLevel]}`);
  const salary = formatSalary(
    job.salaryMin ?? null,
    job.salaryMax ?? null,
    !!job.salaryNegotiable,
  );
  if (salary) meta.push(`Mức lương: ${salary}`);
  if (job.skills?.trim()) meta.push(`Kỹ năng: ${job.skills.trim()}`);
  if (meta.length === 0) return job.rawText;
  return `${meta.join(" | ")}\n${job.rawText}`;
}
