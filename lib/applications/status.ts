export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// 6 cột pipeline mà NTD kéo-thả trên board (không gồm WITHDRAWN).
export const BOARD_STATUSES = [
  "SUBMITTED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
] as const satisfies readonly ApplicationStatus[];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: "Đã nộp",
  SCREENING: "Đang sàng lọc",
  INTERVIEW: "Phỏng vấn",
  OFFER: "Offer",
  HIRED: "Nhận",
  REJECTED: "Từ chối",
  WITHDRAWN: "Đã rút",
};

// NTD kéo thẻ giữa các cột tự do, trừ các luật:
// - không chuyển về chính nó
// - không kéo ngược về SUBMITTED (trạng thái khởi tạo)
// - không kéo vào/ra khỏi WITHDRAWN (chỉ ứng viên tự rút mới đặt được)
export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  if (from === to) return false;
  if (to === "SUBMITTED") return false;
  if (to === "WITHDRAWN") return false;
  if (from === "WITHDRAWN") return false;
  return true;
}

export function canWithdraw(status: ApplicationStatus): boolean {
  return status === "SUBMITTED" || status === "SCREENING";
}

// Định hình kết quả groupBy status thành mảng đủ 7 trạng thái đúng thứ tự vòng đời,
// kèm nhãn tiếng Việt; trạng thái vắng mặt = 0. Dùng chung cho /admin và dashboard.
export function shapeStatusDistribution(
  groups: { status: string; count: number }[],
): { status: string; label: string; count: number }[] {
  const map = new Map(groups.map((g) => [g.status, g.count]));
  return APPLICATION_STATUSES.map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    count: map.get(s) ?? 0,
  }));
}
