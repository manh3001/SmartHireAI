import { STATUS_LABELS } from "@/lib/applications/status";

export const FUNNEL_STAGES = ["SUBMITTED", "SCREENING", "INTERVIEW", "OFFER", "HIRED"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export type FunnelRow = {
  stage: FunnelStage;
  label: string;
  count: number;
  pctOfTotal: number;
  conversionFromPrev: number | null;
};
export type FunnelResult = { total: number; rows: FunnelRow[] };

const STAGE_INDEX: Record<string, number> = Object.fromEntries(
  FUNNEL_STAGES.map((s, i) => [s, i]),
);

export function computeFunnel(
  apps: { id: string }[],
  events: { applicationId: string; toStatus: string }[],
): FunnelResult {
  // maxReached: bước cao nhất mỗi đơn (baseline 0 = SUBMITTED cho mọi đơn).
  const maxReached = new Map<string, number>();
  for (const a of apps) maxReached.set(a.id, 0);
  for (const e of events) {
    if (!maxReached.has(e.applicationId)) continue;
    const idx = STAGE_INDEX[e.toStatus];
    if (idx === undefined) continue; // REJECTED/WITHDRAWN: không phải bước funnel
    if (idx > maxReached.get(e.applicationId)!) maxReached.set(e.applicationId, idx);
  }

  const total = apps.length;
  const reached = FUNNEL_STAGES.map((_, k) => {
    let c = 0;
    for (const v of maxReached.values()) if (v >= k) c++;
    return c;
  });

  const rows: FunnelRow[] = FUNNEL_STAGES.map((stage, k) => ({
    stage,
    label: STATUS_LABELS[stage],
    count: reached[k],
    pctOfTotal: total > 0 ? reached[k] / total : 0,
    conversionFromPrev: k === 0 ? null : reached[k - 1] > 0 ? reached[k] / reached[k - 1] : 0,
  }));

  return { total, rows };
}
