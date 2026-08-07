import Link from "next/link";
import CompanyAvatar from "@/components/CompanyAvatar";
import JobMeta from "@/components/JobMeta";
import type { EmploymentType, ExperienceLevel } from "@/lib/jobs/job-fields";
import { cn } from "@/lib/utils";

export type JobCardData = {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  employmentType?: EmploymentType | null;
  experienceLevel?: ExperienceLevel | null;
  skills?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean | null;
  rawText?: string | null;
};

export default function JobCard({
  job,
  href,
  selected = false,
  saveSlot,
}: {
  job: JobCardData;
  href?: string;
  selected?: boolean;
  saveSlot?: React.ReactNode;
}) {
  const inner = (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm transition-colors",
        selected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-start gap-3 pr-8">
        <CompanyAvatar name={job.company || job.title} />
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{job.title || "(chưa có tiêu đề)"}</div>
          <div className="truncate text-sm text-muted-foreground">{job.company || "—"}</div>
          <div className="mt-2">
            <JobMeta
              location={job.location}
              employmentType={job.employmentType}
              experienceLevel={job.experienceLevel}
              skills={job.skills}
              salaryMin={job.salaryMin}
              salaryMax={job.salaryMax}
              salaryNegotiable={job.salaryNegotiable}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {href ? <Link href={href}>{inner}</Link> : inner}
      {saveSlot && <div className="absolute right-3 top-3">{saveSlot}</div>}
    </div>
  );
}
