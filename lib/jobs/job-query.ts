import { salaryWhere } from "./salary";
import type { EmploymentType, ExperienceLevel } from "./job-fields";

export type JobsFilter = {
  term?: string;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  salaryMillions?: number | null;
};

// Dựng Prisma where cho danh sách việc làm. Gộp các mảnh có OR (lương, tìm kiếm)
// vào AND để chúng không ghi đè key OR của nhau.
export function buildJobsWhere(f: JobsFilter): Record<string, unknown> {
  const term = (f.term ?? "").trim();
  const and: Record<string, unknown>[] = [];
  const salary = salaryWhere(f.salaryMillions ?? null);
  if (Object.keys(salary).length > 0) and.push(salary);
  if (term) {
    and.push({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { company: { contains: term, mode: "insensitive" } },
        { rawText: { contains: term, mode: "insensitive" } },
        { location: { contains: term, mode: "insensitive" } },
        { skills: { contains: term, mode: "insensitive" } },
      ],
    });
  }
  return {
    isPublic: true,
    ...(f.employmentType ? { employmentType: f.employmentType } : {}),
    ...(f.experienceLevel ? { experienceLevel: f.experienceLevel } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}
