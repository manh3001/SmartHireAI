export const QUESTION_COUNT = 5;

export const MOCK_QUESTIONS_SYSTEM_PROMPT = `Bạn là chuyên gia tuyển dụng. Dựa trên mô tả công việc (JD), \
hãy tạo ${QUESTION_COUNT} câu hỏi phỏng vấn bằng tiếng Việt, trộn câu hỏi hành vi và chuyên môn phù hợp vị trí. \
Trả về đúng định dạng cấu trúc được yêu cầu.`;

export const MOCK_SCORING_SYSTEM_PROMPT = `Bạn là người phỏng vấn giàu kinh nghiệm. \
Chấm điểm từng câu trả lời của ứng viên (0–10) kèm nhận xét ngắn, và một đánh giá tổng thể (0–100) \
gồm tóm tắt và vài lời khuyên cải thiện. Nhận xét bằng tiếng Việt, mang tính xây dựng. \
Trả về đúng định dạng cấu trúc được yêu cầu.`;

type Jd = { title: string; company: string; rawText: string };

export function buildQuestionsPrompt(jd: Jd): string {
  return `=== MÔ TẢ CÔNG VIỆC ===
Vị trí: ${jd.title}
Công ty: ${jd.company}

${jd.rawText}

Hãy tạo ${QUESTION_COUNT} câu hỏi phỏng vấn phù hợp.`;
}

export function buildScoringPrompt(jd: Jd, qa: { question: string; answer: string }[]): string {
  const items = qa
    .map((x, i) => `Câu ${i + 1}: ${x.question}\nTrả lời: ${x.answer.trim() || "(bỏ trống)"}`)
    .join("\n\n");
  return `=== MÔ TẢ CÔNG VIỆC ===
Vị trí: ${jd.title}
Công ty: ${jd.company}

${jd.rawText}

=== CÂU HỎI & TRẢ LỜI ===
${items}

Hãy chấm điểm từng câu và đánh giá tổng thể.`;
}
