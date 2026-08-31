import { z } from "zod";
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { getAiClient, AI_MODEL } from "@/lib/ai/client";
import { loadCvInput } from "@/lib/cv/load";
import { checkRateLimit } from "@/lib/security/ratelimit";

export const runtime = "nodejs";

const analyzeResponseSchema = z.object({
  score: z.number().int().min(0).max(100),
  sections: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["ok", "warning", "error"]),
      tip: z.string(),
    }),
  ),
});

export type AnalyzeResult = z.infer<typeof analyzeResponseSchema>;

function buildAnalyzePrompt(cvText: string): string {
  return `Bạn là chuyên gia tư vấn CV. Phân tích CV sau và trả về JSON với cấu trúc:
{
  "score": <số nguyên 0-100>,
  "sections": [
    { "name": "Thông tin liên hệ", "status": "ok"|"warning"|"error", "tip": "<gợi ý cụ thể hoặc rỗng nếu ok>" },
    { "name": "Kinh nghiệm", "status": "ok"|"warning"|"error", "tip": "..." },
    { "name": "Học vấn", "status": "ok"|"warning"|"error", "tip": "..." },
    { "name": "Kỹ năng", "status": "ok"|"warning"|"error", "tip": "..." },
    { "name": "Tổng thể", "status": "ok"|"warning"|"error", "tip": "..." }
  ]
}

Quy tắc đánh giá:
- "ok": mục đầy đủ, cụ thể, chuyên nghiệp
- "warning": thiếu một số thông tin quan trọng hoặc còn chung chung
- "error": thiếu hoàn toàn hoặc quá sơ sài
- tip: gợi ý ngắn gọn bằng tiếng Việt, tối đa 100 ký tự. Rỗng ("") nếu status là "ok".
- score: tổng điểm dựa trên tất cả 5 mục

Chỉ trả về JSON, không giải thích thêm.

CV:
${cvText}`;
}

function cvToText(cv: Awaited<ReturnType<typeof loadCvInput>>): string {
  if (!cv) return "";
  const lines: string[] = [];
  const p = cv.profile;
  lines.push(`Họ tên: ${p.fullName}`, `Tiêu đề: ${p.headline}`, `Email: ${p.email}`, `Điện thoại: ${p.phone}`);
  if (p.linkedin) lines.push(`LinkedIn: ${p.linkedin}`);
  if (p.summary) lines.push(`Tóm tắt: ${p.summary}`);
  if (cv.experiences.length) {
    lines.push("\nKINH NGHIỆM:");
    cv.experiences.forEach((e) => lines.push(`- ${e.position} tại ${e.company}: ${e.description}`));
  }
  if (cv.educations.length) {
    lines.push("\nHỌC VẤN:");
    cv.educations.forEach((e) => lines.push(`- ${e.degree} ${e.major} tại ${e.school}, GPA: ${e.gpa}`));
  }
  if (cv.skills.length) {
    lines.push("\nKỸ NĂNG:");
    lines.push(cv.skills.map((s) => `${s.name} (${s.level})`).join(", "));
  }
  if (cv.projects.length) {
    lines.push("\nDỰ ÁN:");
    cv.projects.forEach((p) => lines.push(`- ${p.name}: ${p.description} [${p.tech}]`));
  }
  return lines.join("\n");
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return new Response("Chưa đăng nhập", { status: 401 });
  const userId = session.user.id;

  if (!(await checkRateLimit("ai", userId))) {
    return new Response("Bạn gửi yêu cầu quá nhanh", { status: 429 });
  }

  const cv = await prisma.cV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!cv) return new Response("Không tìm thấy CV", { status: 404 });

  const cvInput = await loadCvInput(id, userId);
  if (!cvInput) return new Response("Không tìm thấy CV", { status: 404 });

  const prompt = buildAnalyzePrompt(cvToText(cvInput));

  try {
    const client = getAiClient();
    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = analyzeResponseSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return new Response("Phân tích thất bại", { status: 500 });
    }
    return Response.json(parsed.data);
  } catch {
    return new Response("Phân tích thất bại", { status: 500 });
  }
}
