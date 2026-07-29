import type { CvInput } from "@/lib/cv/types";
import type { EvaluationResult } from "./schema";

export function buildChatSystemPrompt(
  cv: CvInput,
  evaluation?: EvaluationResult,
): string {
  const p = cv.profile;
  const parts: string[] = [];

  parts.push(
    "Bạn là cố vấn nghề nghiệp thân thiện, giàu kinh nghiệm. " +
      "Hãy tư vấn cho ứng viên về CV và định hướng nghề nghiệp dựa trên hồ sơ bên dưới. " +
      "Trả lời bằng tiếng Việt, ngắn gọn, thực tế và khích lệ. " +
      "Chỉ dựa vào thông tin trong CV và kết quả đánh giá; không bịa thông tin không có.",
  );

  parts.push("\n--- CV CỦA ỨNG VIÊN ---");
  parts.push(`Họ tên: ${p.fullName || "(chưa có)"}`);
  if (p.headline) parts.push(`Chức danh: ${p.headline}`);
  if (p.summary) parts.push(`Giới thiệu: ${p.summary}`);
  if (cv.experiences.length) {
    parts.push(
      "Kinh nghiệm: " +
        cv.experiences.map((e) => `${e.position} tại ${e.company}`).join("; "),
    );
  }
  if (cv.skills.length) {
    parts.push("Kỹ năng: " + cv.skills.map((s) => s.name).join(", "));
  }
  if (cv.projects.length) {
    parts.push("Dự án: " + cv.projects.map((pr) => pr.name).join(", "));
  }

  if (evaluation) {
    parts.push("\n--- KẾT QUẢ ĐÁNH GIÁ GẦN NHẤT ---");
    parts.push(`Điểm phù hợp: ${evaluation.overallScore}/100`);
    if (evaluation.strengths.length)
      parts.push("Điểm mạnh: " + evaluation.strengths.join("; "));
    if (evaluation.weaknesses.length)
      parts.push("Điểm yếu: " + evaluation.weaknesses.join("; "));
    if (evaluation.skillGaps.length)
      parts.push(
        "Kỹ năng còn thiếu: " +
          evaluation.skillGaps.map((g) => g.skill).join(", "),
      );
  }

  return parts.join("\n");
}
