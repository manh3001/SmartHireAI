import type { EmploymentType } from "@/lib/jobs/job-fields";

// Map EmploymentType nội bộ -> giá trị schema.org của Google.
export function employmentTypeToSchema(t: EmploymentType): string {
  const map: Record<EmploymentType, string> = {
    FULL_TIME: "FULL_TIME",
    PART_TIME: "PART_TIME",
    CONTRACT: "CONTRACTOR",
    INTERNSHIP: "INTERN",
  };
  return map[t];
}

// Rút gọn text cho thẻ description: gộp khoảng trắng, cắt <= max, thêm "…".
export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}
