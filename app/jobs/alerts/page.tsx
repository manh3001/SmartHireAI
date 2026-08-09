import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { criteriaToQuery, type AlertCriteria } from "@/lib/jobs/alerts";
import type { JobCategory } from "@/lib/jobs/job-categories";
import type { EmploymentType, ExperienceLevel } from "@/lib/jobs/job-fields";
import DeleteAlertButton from "@/components/jobs/DeleteAlertButton";
import AlertEmailToggle from "@/components/jobs/AlertEmailToggle";

export default async function JobAlertsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const alerts = await prisma.jobAlert.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Thông báo việc làm</h1>
          <Link href="/jobs" className="text-sm text-primary hover:underline">← Về tin tuyển dụng</Link>
        </div>
        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Chưa có thông báo nào. Vào <Link href="/jobs" className="text-primary hover:underline">Tin tuyển dụng</Link>, chọn bộ lọc rồi bấm &quot;Lưu bộ lọc làm thông báo&quot;.
          </div>
        ) : (
          <ul className="space-y-3">
            {alerts.map((a) => {
              const criteria: AlertCriteria = {
                term: a.term ?? undefined,
                category: (a.category as JobCategory | null) ?? undefined,
                employmentType: (a.employmentType as EmploymentType | null) ?? undefined,
                experienceLevel: (a.experienceLevel as ExperienceLevel | null) ?? undefined,
                salaryMillions: a.salaryMillions,
              };
              const query = new URLSearchParams(criteriaToQuery(criteria)).toString();
              return (
                <li key={a.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
                  <div>
                    <div className="font-medium text-foreground">{a.label || "Tất cả việc làm"}</div>
                    <Link href={query ? `/jobs?${query}` : "/jobs"} className="text-sm text-primary hover:underline">
                      Xem việc khớp →
                    </Link>
                  </div>
                  <div className="flex items-center gap-3">
                    <AlertEmailToggle id={a.id} enabled={a.emailEnabled} />
                    <DeleteAlertButton id={a.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
