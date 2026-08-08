import { getAdminStats } from "@/lib/admin/stats";
import { formatSalary } from "@/lib/jobs/salary";
import StatCard from "@/components/StatCard";

export default async function AdminDashboardPage() {
  const s = await getAdminStats();
  const maxStatus = Math.max(1, ...s.statusDistribution.map((d) => d.count));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-foreground">Tổng quan hệ thống</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Đếm tổng quan</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Người dùng" value={s.roles.total} />
          <StatCard label="Ứng viên" value={s.roles.candidates} />
          <StatCard label="Nhà tuyển dụng" value={s.roles.recruiters} />
          <StatCard label="Admin" value={s.roles.admins} />
          <StatCard label="CV" value={s.cvCount} />
          <StatCard label={`JD (công khai ${s.jdPublic})`} value={s.jdTotal} />
          <StatCard label="Công ty" value={s.companyCount} />
          <StatCard label="Đơn ứng tuyển" value={s.appCount} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Đơn theo trạng thái</h2>
        <div className="flex flex-col gap-2">
          {s.statusDistribution.map((d) => (
            <div key={d.status} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-muted-foreground">{d.label}</div>
              <div className="h-4 flex-1 rounded bg-muted">
                <div className="h-4 rounded bg-primary" style={{ width: `${(d.count / maxStatus) * 100}%` }} />
              </div>
              <div className="w-10 shrink-0 text-right text-sm font-medium text-foreground">{d.count}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Hoạt động AI</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Lượt đánh giá CV" value={s.ai.evaluations} />
          <StatCard label="Điểm TB (đánh giá)" value={s.ai.avgScore ?? "—"} />
          <StatCard label="Lượt sàng lọc" value={s.ai.screenings} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Phân bố lương JD</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="JD có lương" value={s.salary.count} />
          <StatCard label="Lương TB" value={formatSalary(s.salary.avgMidpoint, null, false)?.replace("Từ ", "") ?? "—"} />
          <StatCard label="Khoảng" value={s.salary.min == null ? "—" : (formatSalary(s.salary.min, s.salary.max, false) ?? "—")} />
        </div>
      </section>
    </div>
  );
}
