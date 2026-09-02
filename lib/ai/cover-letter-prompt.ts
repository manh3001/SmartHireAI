import type { CvInput } from "@/lib/cv/types";
import { formatCv } from "./prompt";

export const COVER_LETTER_SYSTEM_PROMPT = `Bạn là trợ lý viết thư xin việc chuyên nghiệp. \
Viết một thư giới thiệu (cover letter) bằng tiếng Việt cho ứng viên dựa trên CV và mô tả công việc (JD) người dùng cung cấp. \
Yêu cầu: độ dài khoảng 150–250 từ; giọng chuyên nghiệp, chân thành, tự tin nhưng không khoa trương; \
nêu bật các kỹ năng và kinh nghiệm trong CV khớp với JD; \
CHỈ dùng thông tin có trong CV, KHÔNG bịa số liệu hay kinh nghiệm không có; \
KHÔNG lặp lại nguyên văn JD; KHÔNG dùng markdown hay tiêu đề — chỉ trả về nội dung thư.`;

export function buildCoverLetterPrompt(
  cv: CvInput,
  jdText: string,
  candidateName: string,
): string {
  return `Ứng viên: ${candidateName}

=== CV ỨNG VIÊN ===
${formatCv(cv)}

=== MÔ TẢ CÔNG VIỆC (JD) ===
${jdText}

Hãy viết thư giới thiệu theo đúng yêu cầu ở trên.`;
}
