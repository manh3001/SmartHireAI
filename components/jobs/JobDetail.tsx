import CompanyAvatar from "@/components/CompanyAvatar";
import JobMeta from "@/components/JobMeta";
import type { JobCardData } from "@/components/JobCard";

export type JobDetailData = JobCardData;

export default function JobDetail({ job, action }: { job: JobDetailData; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        <CompanyAvatar name={job.company || job.title} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">{job.title || "(chưa có tiêu đề)"}</h1>
          <div className="text-sm text-muted-foreground">{job.company || "—"}</div>
          <div className="mt-3">
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
      {action && <div className="mt-4">{action}</div>}
      <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{job.rawText}</div>
    </div>
  );
}
