import { getRecruiterAnalytics } from "@/lib/dashboard/recruiter-analytics";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";

export default async function RecruiterAnalytics({ userId }: { userId: string }) {
  const summary = await getRecruiterAnalytics(userId);

  if (summary.topJobs.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Phân tích tuyển dụng chi tiết</h2>
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title="Chưa có dữ liệu tuyển dụng"
          description="Bắt đầu nhận đơn ứng tuyển để xem phân tích."
        />
      </section>
    );
  }

  return (
    <section className="mb-8 flex flex-col gap-6">
      <h2 className="text-base font-semibold text-foreground">Phân tích tuyển dụng chi tiết</h2>

      {/* Thời gian tuyển TB */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
        <BarChart3 className="h-5 w-5 text-primary" />
        <div>
          <div className="text-sm text-muted-foreground">Thời gian tuyển trung bình</div>
          <div className="text-xl font-bold text-foreground">
            {summary.avgDaysToHire !== null ? `${summary.avgDaysToHire} ngày` : "—"}
          </div>
        </div>
      </div>

      {/* Top 5 jobs table */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Top 5 tin tuyển dụng</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tin tuyển dụng</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Đơn</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Điểm AI TB</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Tỉ lệ tiến lên</th>
              </tr>
            </thead>
            <tbody>
              {summary.topJobs.map((job, i) => (
                <tr key={job.jobId} className={i < summary.topJobs.length - 1 ? "border-b border-border" : ""}>
                  <td className="px-4 py-3 font-medium text-foreground">{job.title || "(chưa đặt tên)"}</td>
                  <td className="px-4 py-3 text-right text-foreground">{job.total}</td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {job.avgScore !== null ? job.avgScore : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {Math.round(job.progressRate * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
