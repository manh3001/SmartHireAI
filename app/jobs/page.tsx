import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
} from "@/lib/jobs/job-fields";
import { SALARY_FILTER_STEPS } from "@/lib/jobs/salary";
import { buildJobsWhere } from "@/lib/jobs/job-query";
import { isJobCategory } from "@/lib/jobs/job-categories";
import JobFilters from "@/components/jobs/JobFilters";
import JobsBrowser from "@/components/jobs/JobsBrowser";
import { criteriaFromFilter } from "@/lib/jobs/alerts";
import SaveAlertButton from "@/components/jobs/SaveAlertButton";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; level?: string; salary?: string; category?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q, type, level, salary, category } = await searchParams;
  const term = (q ?? "").trim();
  const typeFilter = EMPLOYMENT_TYPES.includes(type as never) ? (type as (typeof EMPLOYMENT_TYPES)[number]) : undefined;
  const levelFilter = EXPERIENCE_LEVELS.includes(level as never) ? (level as (typeof EXPERIENCE_LEVELS)[number]) : undefined;
  const salaryNum = Number(salary);
  const salaryFilter = SALARY_FILTER_STEPS.includes(salaryNum as never) ? salaryNum : null;
  const categoryFilter = isJobCategory(category) ? category : undefined;

  const jobs = await prisma.jobDescription.findMany({
    where: buildJobsWhere({
      term,
      employmentType: typeFilter,
      experienceLevel: levelFilter,
      salaryMillions: salaryFilter,
      category: categoryFilter,
    }),
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, company: true, rawText: true, createdAt: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
      salaryMin: true, salaryMax: true, salaryNegotiable: true,
    },
  });

  const isCandidate = session.user.role === "CANDIDATE";

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <h1 className="mb-4 text-2xl font-bold text-foreground">Tin tuyển dụng</h1>
        {isCandidate && (
          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
            <Link href="/jobs/saved" className="text-primary hover:underline">Tin đã lưu</Link>
            <Link href="/jobs/recommendations" className="text-primary hover:underline">Gợi ý việc cho tôi</Link>
            <Link href="/jobs/alerts" className="text-primary hover:underline">Thông báo đã lưu</Link>
            <SaveAlertButton
              criteria={criteriaFromFilter({
                term,
                employmentType: typeFilter,
                experienceLevel: levelFilter,
                salaryMillions: salaryFilter,
                category: categoryFilter,
              })}
            />
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <JobFilters defaults={{ q: term, type: typeFilter, level: levelFilter, salary: salary ?? "", category: categoryFilter }} />
          </aside>
          <div>
            {jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
                {term || typeFilter || levelFilter || salaryFilter || categoryFilter
                  ? "Không tìm thấy tin nào khớp bộ lọc."
                  : "Chưa có tin tuyển dụng nào."}
              </div>
            ) : (
              <JobsBrowser jobs={jobs} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
