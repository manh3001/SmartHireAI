import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  type EmploymentType,
  type ExperienceLevel,
} from "@/lib/jobs/job-fields";

export default function JobMeta({
  location,
  employmentType,
  experienceLevel,
  skills,
}: {
  location?: string | null;
  employmentType?: EmploymentType | null;
  experienceLevel?: ExperienceLevel | null;
  skills?: string | null;
}) {
  const skillList = (skills ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const hasAny =
    !!location?.trim() || !!employmentType || !!experienceLevel || skillList.length > 0;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
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
