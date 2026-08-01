import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  type EmploymentType,
  type ExperienceLevel,
} from "@/lib/jobs/job-fields";
import { formatSalary } from "@/lib/jobs/salary";

export default function JobMeta({
  location,
  employmentType,
  experienceLevel,
  skills,
  salaryMin,
  salaryMax,
  salaryNegotiable,
}: {
  location?: string | null;
  employmentType?: EmploymentType | null;
  experienceLevel?: ExperienceLevel | null;
  skills?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean | null;
}) {
  const skillList = (skills ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const salary = formatSalary(salaryMin ?? null, salaryMax ?? null, !!salaryNegotiable);

  const hasAny =
    !!location?.trim() || !!employmentType || !!experienceLevel || skillList.length > 0 || !!salary;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {salary && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">💰 {salary}</span>
      )}
      {location?.trim() && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">📍 {location.trim()}</span>
      )}
      {employmentType && (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{EMPLOYMENT_TYPE_LABELS[employmentType]}</span>
      )}
      {experienceLevel && (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{EXPERIENCE_LEVEL_LABELS[experienceLevel]}</span>
      )}
      {skillList.map((s) => (
        <span key={s} className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">{s}</span>
      ))}
    </div>
  );
}
