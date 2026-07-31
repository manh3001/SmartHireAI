import type { CvInput } from "@/lib/cv/types";

export const SCREENING_SYSTEM_PROMPT = `Bạn là chuyên gia tuyển dụng giàu kinh nghiệm. \
Nhiệm vụ: SO SÁNH nhiều ứng viên với nhau theo một mô tả công việc (JD) và xếp hạng họ. \
Với mỗi ứng viên: chấm điểm tương đối 0-100 (so với các ứng viên khác cho vị trí này), \
đặt shortlisted = true nếu nên mời phỏng vấn, và nêu lý do ngắn gọn (điểm mạnh/yếu tương đối). \
Trả về "ranking" xếp từ TỐT NHẤT trước và PHẢI gồm TẤT CẢ ứng viên được cung cấp, \
dùng đúng số "ref" đã gán cho mỗi ứng viên. "summary" là nhận xét tổng quan về nhóm ứng viên. \
Trả lời hoàn toàn bằng tiếng Việt, đúng cấu trúc JSON được yêu cầu.`;

function formatCvBrief(cv: CvInput): string {
  const p = cv.profile;
  const lines: string[] = [];
  lines.push(`Họ tên: ${p.fullName}`);
  if (p.headline) lines.push(`Chức danh: ${p.headline}`);
  if (p.summary) lines.push(`Giới thiệu: ${p.summary}`);
  if (cv.skills.length) {
    lines.push(
      "Kỹ năng: " +
        cv.skills.map((s) => (s.level ? `${s.name} (${s.level})` : s.name)).join(", "),
    );
  }
  if (cv.experiences.length) {
    lines.push("Kinh nghiệm:");
    for (const e of cv.experiences) {
      lines.push(`- ${e.position} tại ${e.company} (${e.startDate}-${e.endDate})`);
    }
  }
  if (cv.educations.length) {
    lines.push(
      "Học vấn: " +
        cv.educations.map((e) => `${e.school}${e.major ? " - " + e.major : ""}`).join("; "),
    );
  }
  if (cv.projects.length) {
    lines.push("Dự án: " + cv.projects.map((pr) => pr.name).join(", "));
  }
  return lines.join("\n");
}

export function buildScreeningPrompt(jdText: string, cvs: CvInput[]): string {
  const blocks = cvs.map(
    (cv, i) => `### Ứng viên #${i + 1}\n${formatCvBrief(cv)}`,
  );
  return `=== MÔ TẢ CÔNG VIỆC (JD) ===
${jdText}

=== DANH SÁCH ỨNG VIÊN ===
${blocks.join("\n\n")}

Hãy so sánh và xếp hạng TẤT CẢ ứng viên trên theo JD, trả về đúng cấu trúc JSON yêu cầu (dùng số ref tương ứng #1..#${cvs.length}).`;
}
