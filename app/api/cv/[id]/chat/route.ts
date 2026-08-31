import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";
import { getAiClient, AI_MODEL } from "@/lib/ai/client";
import { buildChatSystemPrompt } from "@/lib/ai/chat";
import type { EvaluationResult } from "@/lib/ai/schema";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { loadCvInput } from "@/lib/cv/load";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Chưa đăng nhập", { status: 401 });
  }
  const userId = session.user.id;

  if (!(await checkRateLimit("ai", userId))) {
    return new Response("Bạn nhắn quá nhanh, vui lòng chờ một chút", { status: 429 });
  }

  let message = "";
  try {
    const body = await req.json();
    message = String(body.message ?? "").trim();
  } catch {
    return new Response("Dữ liệu không hợp lệ", { status: 400 });
  }
  if (!message) return new Response("Tin nhắn rỗng", { status: 400 });

  const cvInput = await loadCvInput(id, userId);
  if (!cvInput) return new Response("Không tìm thấy CV", { status: 404 });

  const evalRow = await prisma.evaluation.findFirst({
    where: { cvId: id, userId },
    orderBy: { createdAt: "desc" },
  });
  const evaluation: EvaluationResult | undefined = evalRow
    ? {
        overallScore: evalRow.overallScore,
        strengths: evalRow.strengths as unknown as string[],
        weaknesses: evalRow.weaknesses as unknown as string[],
        matchedKeywords: evalRow.matchedKeywords as unknown as string[],
        missingKeywords: evalRow.missingKeywords as unknown as string[],
        skillGaps: evalRow.skillGaps as unknown as EvaluationResult["skillGaps"],
        summary: evalRow.summary,
      }
    : undefined;

  let chatSession = await prisma.chatSession.findFirst({
    where: { cvId: id, userId },
  });
  if (!chatSession) {
    chatSession = await prisma.chatSession.create({ data: { userId, cvId: id } });
  }

  await prisma.chatMessage.create({
    data: { sessionId: chatSession.id, role: "USER", content: message },
  });

  const history = await prisma.chatMessage.findMany({
    where: { sessionId: chatSession.id },
    orderBy: { createdAt: "asc" },
  });

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildChatSystemPrompt(cvInput, evaluation) },
    ...history.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  ];

  const client = getAiClient();
  const sessionId = chatSession.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        const completion = await client.chat.completions.create({
          model: AI_MODEL,
          messages,
          stream: true,
        });
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            full += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }
      } catch {
        controller.enqueue(encoder.encode("\n[Có lỗi khi tạo phản hồi, vui lòng thử lại]"));
      } finally {
        if (full) {
          await prisma.chatMessage.create({
            data: { sessionId, role: "ASSISTANT", content: full },
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
