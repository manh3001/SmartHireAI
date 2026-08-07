import { getCandidateStats } from "@/lib/dashboard/candidate-stats";
import { shapeStatusDistribution } from "@/lib/applications/status";
import { formatActivity } from "@/lib/dashboard/shape";
import StatCard from "@/components/StatCard";

export default async function CandidateStats({ userId }: { userId: string }) {
  const s = await getCandidateStats(userId);
  const dist = shapeStatusDistribution(s.statusCounts);
  const maxStatus = Math.max(1, ...dist.map((d) => d.count));

  return (
    <section className="mb-8 flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="CV" value={s.cvCount} />
        <StatCard label="Đơn đã nộp" value={s.totalApplications} />
        <StatCard label="Tin đã lưu" value={s.savedCount} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Đơn theo trạng thái</h2>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Điểm AI trung bình" value={s.avgScore ?? "—"} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Hoạt động gần đây</h2>
        <ul className="flex flex-col gap-1 text-sm text-foreground">
          {s.recentEvents.length === 0 && <li className="text-muted-foreground">Chưa có hoạt động nào</li>}
          {s.recentEvents.map((e) => (
            <li key={e.id}>• {formatActivity(e)}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
