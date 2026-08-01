import { STATUS_LABELS } from "@/lib/applications/status";

export function computeConversion(
  statusCounts: { status: string; count: number }[],
): { total: number; hiredRate: number; interviewRate: number } {
  const total = statusCounts.reduce((a, c) => a + c.count, 0);
  if (total === 0) return { total: 0, hiredRate: 0, interviewRate: 0 };
  const get = (s: string) => statusCounts.find((c) => c.status === s)?.count ?? 0;
  const interviewPlus = get("INTERVIEW") + get("OFFER") + get("HIRED");
  return { total, hiredRate: get("HIRED") / total, interviewRate: interviewPlus / total };
}

export function formatActivity(event: { toStatus: string; jobTitle: string }): string {
  const label =
    STATUS_LABELS[event.toStatus as keyof typeof STATUS_LABELS] ?? event.toStatus;
  return `Đơn "${event.jobTitle}" chuyển sang ${label}`;
}
