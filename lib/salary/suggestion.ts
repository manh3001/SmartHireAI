import { median } from "./insights";
import { normalizeCategory } from "@/lib/jobs/job-categories";
import { EXPERIENCE_LEVELS } from "@/lib/jobs/job-fields";

export const MIN_SUGGESTION_SAMPLE = 3;

export type SalaryBasis = "category_level" | "category" | "level" | "overall";
export type SalarySuggestion = {
  medianMin: number | null;
  medianMax: number | null;
  sampleSize: number;
  basis: SalaryBasis;
};
export type SuggestionRow = {
  category: string | null;
  experienceLevel: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
};

function hasSalary(r: SuggestionRow): boolean {
  return r.salaryMin != null || r.salaryMax != null;
}

function summarize(rows: SuggestionRow[]): { medianMin: number | null; medianMax: number | null; sampleSize: number } {
  const mins = rows.map((r) => r.salaryMin).filter((v): v is number => v != null);
  const maxs = rows.map((r) => r.salaryMax).filter((v): v is number => v != null);
  return { medianMin: median(mins), medianMax: median(maxs), sampleSize: rows.length };
}

export function computeSalarySuggestion(
  rows: SuggestionRow[],
  input: { category: string | null; experienceLevel: string | null },
): SalarySuggestion | null {
  const withSalary = rows.filter(hasSalary);
  if (withSalary.length === 0) return null;

  const cat = normalizeCategory(input.category);
  const level =
    input.experienceLevel && (EXPERIENCE_LEVELS as readonly string[]).includes(input.experienceLevel)
      ? input.experienceLevel
      : null;

  const candidates: { basis: SalaryBasis; rows: SuggestionRow[] }[] = [];
  if (cat && level)
    candidates.push({
      basis: "category_level",
      rows: withSalary.filter((r) => normalizeCategory(r.category) === cat && r.experienceLevel === level),
    });
  if (cat)
    candidates.push({ basis: "category", rows: withSalary.filter((r) => normalizeCategory(r.category) === cat) });
  if (level)
    candidates.push({ basis: "level", rows: withSalary.filter((r) => r.experienceLevel === level) });
  candidates.push({ basis: "overall", rows: withSalary });

  for (const c of candidates) {
    if (c.rows.length >= MIN_SUGGESTION_SAMPLE) {
      return { ...summarize(c.rows), basis: c.basis };
    }
  }
  // Không mức nào đạt ngưỡng nhưng vẫn có dữ liệu -> dùng overall (cỡ mẫu nhỏ).
  return { ...summarize(withSalary), basis: "overall" };
}
