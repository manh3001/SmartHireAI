import { formatSalary } from "@/lib/jobs/salary";
import type { SalaryBarRow } from "@/lib/salary/insights";

export default function SalaryTable({ rows }: { rows: SalaryBarRow[] }) {
  if (rows.length === 0) return null;
  const maxMedian = Math.max(1, ...rows.map((r) => r.medianMax ?? 0));
  return (
    <div className="mt-4 flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground">{r.label}</span>
            <span className="text-sm font-medium text-foreground">
              {formatSalary(r.medianMin, r.medianMax, false) ?? "—"}
            </span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-brand-gradient"
              style={{ width: `${((r.medianMax ?? 0) / maxMedian) * 100}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {r.sampleSize} tin{r.sampleSize < 5 ? " · ít dữ liệu" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
