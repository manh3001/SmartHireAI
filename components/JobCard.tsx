import Link from "next/link";
import CompanyAvatar from "@/components/CompanyAvatar";
import JobMeta from "@/components/JobMeta";
import type { EmploymentType, ExperienceLevel } from "@/lib/jobs/job-fields";
import { cn } from "@/lib/utils";
import { jobBadges } from "@/lib/jobs/job-badges";

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
  category?: string | null;
  rawText?: string | null;
  createdAt?: string | Date | null;
  applicationCount?: number | null;
};

export default function JobCard({
  job,
  href,
  selected = false,
  saveSlot,
  onSelect,
}: {
  job: JobCardData;
  href?: string;
  selected?: boolean;
  saveSlot?: React.ReactNode;
  onSelect?: () => void;
}) {
  const badges = jobBadges(job);

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
          {badges.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className={
                    "rounded-full px-2 py-0.5 text-[11px] font-medium " +
                    (b.tone === "hot"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : b.tone === "new"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400")
                  }
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}
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

  const clickable = onSelect ? (
    <button type="button" onClick={onSelect} className="block w-full text-left">{inner}</button>
  ) : href ? (
    <Link href={href}>{inner}</Link>
  ) : (
    inner
  );

  return (
    <div className="relative">
      {clickable}
      {saveSlot && <div className="absolute right-3 top-3">{saveSlot}</div>}
    </div>
  );
}
