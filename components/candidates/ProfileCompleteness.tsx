import Link from "next/link";
import type { CompletenessResult } from "@/lib/candidates/completeness";

export default function ProfileCompleteness({
  result,
  compact = false,
}: {
  result: CompletenessResult;
  compact?: boolean;
}) {
  const { percent, missing } = result;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Hoàn thiện hồ sơ</span>
        <span className="text-sm font-semibold text-primary">{percent}%</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-muted">
        <div className="h-2 rounded-full bg-brand-gradient" style={{ width: `${percent}%` }} />
      </div>
      {missing.length > 0 && (
        <ul className={compact ? "mt-2 flex flex-wrap gap-2" : "mt-3 flex flex-col gap-1"}>
          {missing.map((m) => (
            <li key={m.key}>
              <Link href={m.href} className="text-xs font-medium text-primary hover:underline">
                + {m.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
