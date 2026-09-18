import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
} from "@/lib/jobs/job-fields";
import { JOB_CATEGORIES } from "@/lib/jobs/job-categories";

export const JD_DRAFT_SYSTEM_PROMPT = `Bạn là chuyên gia tuyển dụng. \
Nhiệm vụ: từ tiêu đề vị trí và vài gạch đầu dòng của nhà tuyển dụng, soạn một mô tả công việc (JD) tiếng Việt \
chuyên nghiệp, rõ ràng, có các mục: Mô tả chung, Trách nhiệm chính, Yêu cầu, Quyền lợi. \
Chọn "employmentType", "experienceLevel", "categorySlug" từ danh sách hợp lệ được cung cấp; nếu không chắc thì để null. \
"skills" là danh sách ngắn gọn các kỹ năng chính. \
Trả lời hoàn toàn bằng tiếng Việt, đúng cấu trúc JSON được yêu cầu.`;

export function buildJdDraftPrompt(input: { title: string; brief: string }): string {
  const emp = EMPLOYMENT_TYPES.map((t) => `${t} (${EMPLOYMENT_TYPE_LABELS[t]})`).join(", ");
  const exp = EXPERIENCE_LEVELS.map((l) => `${l} (${EXPERIENCE_LEVEL_LABELS[l]})`).join(", ");
  const cats = JOB_CATEGORIES.map((c) => `${c.slug} (${c.label})`).join(", ");
  return [
    `Tiêu đề vị trí: ${input.title}`,
    `Mô tả ngắn / gạch đầu dòng từ nhà tuyển dụng:`,
    input.brief,
    ``,
    `employmentType hợp lệ: ${emp}`,
    `experienceLevel hợp lệ: ${exp}`,
    `categorySlug hợp lệ: ${cats}`,
    `Hãy soạn nội dung đầy đủ cho "description" và chọn skills/employmentType/experienceLevel/categorySlug phù hợp.`,
  ].join("\n");
}
