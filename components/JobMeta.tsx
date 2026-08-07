import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  type EmploymentType,
  type ExperienceLevel,
} from "@/lib/jobs/job-fields";
import { formatSalary } from "@/lib/jobs/salary";
import { Badge } from "@/components/ui/badge";

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
      {salary && <Badge variant="salary">💰 {salary}</Badge>}
      {location?.trim() && <Badge variant="muted">📍 {location.trim()}</Badge>}
      {employmentType && <Badge variant="default">{EMPLOYMENT_TYPE_LABELS[employmentType]}</Badge>}
      {experienceLevel && <Badge variant="default">{EXPERIENCE_LEVEL_LABELS[experienceLevel]}</Badge>}
      {skillList.map((s) => (
        <Badge key={s} variant="skill">{s}</Badge>
      ))}
    </div>
  );
}
