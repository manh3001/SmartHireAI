import { getRecruiterStats } from "@/lib/dashboard/recruiter-stats";
import { shapeStatusDistribution } from "@/lib/applications/status";
import { computeConversion } from "@/lib/dashboard/shape";
import StatCard from "@/components/StatCard";

export default async function RecruiterStats({ userId }: { userId: string }) {
  const s = await getRecruiterStats(userId);
  const dist = shapeStatusDistribution(s.statusCounts);
  const conv = computeConversion(s.statusCounts);
  const maxStatus = Math.max(1, ...dist.map((d) => d.count));

  return (
    <section className="mb-8 flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Tin đang đăng" value={s.openJobs} />
        <StatCard label="Ứng viên đã nộp" value={s.totalApplicants} />
        <StatCard label="Đơn mới" value={s.newApplicants} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Phễu theo trạng thái</h2>
        <div className="flex flex-col gap-2">
          {dist.map((d) => (
            <div key={d.status} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-foreground">{d.label}</div>
              <div className="h-4 flex-1 rounded bg-muted">
                <div className="h-4 rounded bg-primary" style={{ width: `${(d.count / maxStatus) * 100}%` }} />
              </div>
              <div className="w-10 shrink-0 text-right text-sm font-medium text-foreground">{d.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Tỉ lệ nhận" value={`${Math.round(conv.hiredRate * 100)}%`} />
        <StatCard label="Tỉ lệ vào phỏng vấn" value={`${Math.round(conv.interviewRate * 100)}%`} />
        <StatCard label="Điểm AI trung bình" value={s.avgScore ?? "—"} />
      </div>
    </section>
  );
}
