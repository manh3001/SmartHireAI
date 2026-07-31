import type { CvInput } from "@/lib/cv/types";

export const RECOMMENDATION_SYSTEM_PROMPT = `Bạn là cố vấn nghề nghiệp giàu kinh nghiệm. \
Nhiệm vụ: so khớp MỘT CV của ứng viên với NHIỀU tin tuyển dụng và xếp hạng các tin theo mức phù hợp với ứng viên. \
Với mỗi tin: chấm điểm phù hợp 0-100 và nêu lý do ngắn gọn (vì sao tin này hợp/không hợp với ứng viên). \
Trả về "ranking" xếp từ PHÙ HỢP NHẤT trước, dùng đúng số "ref" đã gán cho mỗi tin. \
Chỉ đưa vào ranking những tin đáng gợi ý; "summary" là nhận xét tổng quan cho ứng viên. \
Trả lời hoàn toàn bằng tiếng Việt, đúng cấu trúc JSON được yêu cầu.`;

export type RecommendationJob = {
  title: string;
  company: string;
  rawText: string;
};

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
  if (cv.projects.length) {
    lines.push("Dự án: " + cv.projects.map((pr) => pr.name).join(", "));
  }
  return lines.join("\n");
}

export function buildRecommendationPrompt(
  cv: CvInput,
  jobs: RecommendationJob[],
): string {
  const blocks = jobs.map((j, i) => {
    const body = j.rawText.length > 600 ? j.rawText.slice(0, 600) + "…" : j.rawText;
    return `### Tin #${i + 1}: ${j.title || "(chưa có tiêu đề)"} — ${j.company || "—"}\n${body}`;
  });
  return `=== CV ỨNG VIÊN ===
${formatCvBrief(cv)}

=== DANH SÁCH TIN TUYỂN DỤNG ===
${blocks.join("\n\n")}

Hãy xếp hạng các tin trên theo mức phù hợp với ứng viên, trả về đúng cấu trúc JSON yêu cầu (dùng số ref tương ứng #1..#${jobs.length}).`;
}
