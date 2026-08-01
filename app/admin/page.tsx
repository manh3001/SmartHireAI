import { getAdminStats } from "@/lib/admin/stats";
import { Card, CardContent } from "@/components/ui/card";
import { formatSalary } from "@/lib/jobs/salary";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="py-4">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const s = await getAdminStats();
  const maxStatus = Math.max(1, ...s.statusDistribution.map((d) => d.count));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-slate-900">Tổng quan hệ thống</h1>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Đếm tổng quan</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Người dùng" value={s.roles.total} />
          <Stat label="Ứng viên" value={s.roles.candidates} />
          <Stat label="Nhà tuyển dụng" value={s.roles.recruiters} />
          <Stat label="Admin" value={s.roles.admins} />
          <Stat label="CV" value={s.cvCount} />
          <Stat label={`JD (công khai ${s.jdPublic})`} value={s.jdTotal} />
          <Stat label="Công ty" value={s.companyCount} />
          <Stat label="Đơn ứng tuyển" value={s.appCount} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Đơn theo trạng thái</h2>
        <div className="flex flex-col gap-2">
          {s.statusDistribution.map((d) => (
            <div key={d.status} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-slate-600">{d.label}</div>
              <div className="h-4 flex-1 rounded bg-slate-100">
                <div className="h-4 rounded bg-blue-500" style={{ width: `${(d.count / maxStatus) * 100}%` }} />
              </div>
              <div className="w-10 shrink-0 text-right text-sm font-medium text-slate-700">{d.count}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Hoạt động AI</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Lượt đánh giá CV" value={s.ai.evaluations} />
          <Stat label="Điểm TB (đánh giá)" value={s.ai.avgScore ?? "—"} />
          <Stat label="Lượt sàng lọc" value={s.ai.screenings} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">Phân bố lương JD</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="JD có lương" value={s.salary.count} />
          <Stat label="Lương TB" value={formatSalary(s.salary.avgMidpoint, null, false)?.replace("Từ ", "") ?? "—"} />
          <Stat label="Khoảng" value={s.salary.min == null ? "—" : (formatSalary(s.salary.min, s.salary.max, false) ?? "—")} />
        </div>
      </section>
    </div>
  );
}
