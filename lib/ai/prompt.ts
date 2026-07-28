import type { CvInput } from "@/lib/cv/types";

export const SYSTEM_PROMPT = `Bạn là chuyên gia tuyển dụng giàu kinh nghiệm. \
Nhiệm vụ: đánh giá mức độ phù hợp của một CV với một mô tả công việc (JD). \
Chấm điểm khách quan theo các tiêu chí: kỹ năng khớp, kinh nghiệm liên quan, \
mức độ đáp ứng yêu cầu. Trả lời hoàn toàn bằng tiếng Việt, đúng cấu trúc JSON được yêu cầu. \
overallScore là số nguyên 0-100. Với mỗi kỹ năng còn thiếu, giải thích vì sao cần và cách học.`;

function formatCv(cv: CvInput): string {
  const p = cv.profile;
  const lines: string[] = [];
  lines.push(`Họ tên: ${p.fullName}`);
  if (p.headline) lines.push(`Chức danh: ${p.headline}`);
  if (p.summary) lines.push(`Giới thiệu: ${p.summary}`);

  if (cv.experiences.length) {
    lines.push("Kinh nghiệm:");
    for (const e of cv.experiences) {
      lines.push(`- ${e.position} tại ${e.company} (${e.startDate}-${e.endDate}): ${e.description}`);
    }
  }
  if (cv.educations.length) {
    lines.push("Học vấn:");
    for (const e of cv.educations) {
      lines.push(`- ${e.school} - ${e.major} (${e.startDate}-${e.endDate})`);
    }
  }
  if (cv.skills.length) {
    lines.push("Kỹ năng: " + cv.skills.map((s) => (s.level ? `${s.name} (${s.level})` : s.name)).join(", "));
  }
  if (cv.projects.length) {
    lines.push("Dự án:");
    for (const pr of cv.projects) {
      lines.push(`- ${pr.name} (${pr.tech}): ${pr.description}`);
    }
  }
  return lines.join("\n");
}

export function buildEvaluationPrompt(cv: CvInput, jdText: string): string {
  return `=== CV ỨNG VIÊN ===
${formatCv(cv)}

=== MÔ TẢ CÔNG VIỆC (JD) ===
${jdText}

Hãy đánh giá CV trên so với JD và trả về kết quả theo đúng cấu trúc JSON yêu cầu.`;
}
