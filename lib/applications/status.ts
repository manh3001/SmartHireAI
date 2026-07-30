export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: "Đã nộp",
  SCREENING: "Đang sàng lọc",
  INTERVIEW: "Phỏng vấn",
  OFFER: "Offer",
  HIRED: "Nhận",
  REJECTED: "Từ chối",
};

// NTD kéo thẻ giữa các cột tự do, trừ hai luật:
// - không chuyển về chính nó
// - không kéo ngược về SUBMITTED (trạng thái khởi tạo)
export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  if (from === to) return false;
  if (to === "SUBMITTED") return false;
  return true;
}

export function canWithdraw(status: ApplicationStatus): boolean {
  return status === "SUBMITTED" || status === "SCREENING";
}
