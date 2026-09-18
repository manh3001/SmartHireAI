import { formatSalary } from "@/lib/jobs/salary";

export const SALARY_NOTE_SYSTEM_PROMPT = `Bạn là chuyên gia nhân sự. \
Nhiệm vụ: viết 1-2 câu tiếng Việt nhận định ngắn gọn về KHOẢNG LƯƠNG ĐÃ ĐƯỢC CUNG CẤP cho một vị trí. \
TUYỆT ĐỐI KHÔNG đưa ra con số lương mới hay thay đổi con số đã cho; chỉ nhận xét (mức độ phù hợp, yếu tố ảnh hưởng như kỹ năng/địa điểm, lưu ý nếu cỡ mẫu nhỏ). \
Trả lời hoàn toàn bằng tiếng Việt, đúng cấu trúc JSON được yêu cầu ("note").`;

export function buildSalaryNotePrompt(input: {
  title: string;
  categoryLabel: string;
  levelLabel: string;
  skills: string;
  medianMin: number | null;
  medianMax: number | null;
  sampleSize: number;
  basis: string;
}): string {
  const range = formatSalary(input.medianMin, input.medianMax, false) ?? "chưa xác định";
  return [
    `Vị trí: ${input.title}`,
    `Ngành: ${input.categoryLabel}`,
    `Cấp bậc: ${input.levelLabel}`,
    `Kỹ năng: ${input.skills || "(không có)"}`,
    `Khoảng lương tham chiếu (đã tính từ dữ liệu, KHÔNG được đổi): ${range}`,
    `Cỡ mẫu: ${input.sampleSize} tin (cơ sở: ${input.basis})`,
    `Hãy viết "note" 1-2 câu nhận định về khoảng lương này.`,
  ].join("\n");
}
