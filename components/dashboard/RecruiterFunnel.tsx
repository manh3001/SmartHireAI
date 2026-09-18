import { getRecruiterFunnel } from "@/lib/dashboard/recruiter-funnel-data";
import { EmptyState } from "@/components/ui/empty-state";
import { Filter } from "lucide-react";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default async function RecruiterFunnel({ userId }: { userId: string }) {
  const funnel = await getRecruiterFunnel(userId);

  if (funnel.total === 0) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Funnel ứng tuyển</h2>
        <EmptyState
          icon={<Filter className="h-8 w-8" />}
          title="Chưa có đơn ứng tuyển"
          description="Khi có đơn ứng tuyển, bạn sẽ thấy tỷ lệ chuyển đổi qua từng bước."
        />
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-foreground">Funnel ứng tuyển</h2>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
        {funnel.rows.map((row) => (
          <div key={row.stage}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-foreground">{row.label}</span>
              <span className="text-muted-foreground">
                {row.count} · {pct(row.pctOfTotal)}
                {row.conversionFromPrev !== null && (
                  <span className="ml-2 text-xs">(chuyển đổi {pct(row.conversionFromPrev)})</span>
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: pct(row.pctOfTotal) }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
