import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { runCvEvaluation, type CvEvaluationDeps } from "@/lib/ai/evaluate";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { loadCvInput } from "@/lib/cv/load";
import { requestEvaluation } from "@/lib/ai/request-evaluation";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const userId = session.user.id;

  if (!(await checkRateLimit("ai", userId))) {
    return NextResponse.json(
      { error: "Bạn đánh giá quá nhanh, vui lòng thử lại sau" },
      { status: 429 },
    );
  }

  let body: { jdText?: string; jdTitle?: string; jdCompany?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const deps: CvEvaluationDeps = {
    findCv: (cvId, uid) => loadCvInput(cvId, uid),
    requestEvaluation,
    saveEvaluation: async (d) => {
      const jd = await prisma.jobDescription.create({
        data: { userId: d.userId, title: d.jdTitle, company: d.jdCompany, rawText: d.jdText },
        select: { id: true },
      });
      const ev = await prisma.evaluation.create({
        data: {
          cvId: d.cvId,
          jobDescriptionId: jd.id,
          userId: d.userId,
          overallScore: d.result.overallScore,
          strengths: d.result.strengths,
          weaknesses: d.result.weaknesses,
          matchedKeywords: d.result.matchedKeywords,
          missingKeywords: d.result.missingKeywords,
          skillGaps: d.result.skillGaps,
          summary: d.result.summary,
          rawModelOutput: d.result,
        },
        select: { id: true },
      });
      return { id: ev.id };
    },
  };

  const outcome = await runCvEvaluation(
    {
      cvId: id,
      userId,
      jdText: body.jdText ?? "",
      jdTitle: body.jdTitle ?? "",
      jdCompany: body.jdCompany ?? "",
    },
    deps,
  );

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }
  return NextResponse.json(
    { evaluationId: outcome.evaluationId, result: outcome.result },
    { status: 201 },
  );
}
