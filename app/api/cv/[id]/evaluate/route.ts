import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getAnthropicClient } from "@/lib/ai/client";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { evaluationResultSchema, type EvaluationResult } from "@/lib/ai/schema";
import { runCvEvaluation, type CvEvaluationDeps } from "@/lib/ai/evaluate";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import type { CvInput } from "@/lib/cv/types";

export const runtime = "nodejs";

const limiter = createRateLimiter({ max: 5, windowMs: 60000 });

async function requestEvaluation(prompt: string): Promise<EvaluationResult> {
  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(evaluationResultSchema) },
  });
  if (!response.parsed_output) {
    throw new Error("Model không trả về kết quả hợp lệ");
  }
  return response.parsed_output;
}

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

  if (!limiter.check(userId, Date.now())) {
    return NextResponse.json(
      { error: "Bạn đánh giá quá nhanh, vui lòng thử lại sau một phút" },
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
    findCv: async (cvId, uid) => {
      const cv = await prisma.cV.findFirst({
        where: { id: cvId, userId: uid },
        include: {
          profile: true,
          experiences: { orderBy: { order: "asc" } },
          educations: { orderBy: { order: "asc" } },
          skills: { orderBy: { order: "asc" } },
          projects: { orderBy: { order: "asc" } },
        },
      });
      if (!cv) return null;
      const data: CvInput = {
        title: cv.title,
        profile: {
          fullName: cv.profile?.fullName ?? "",
          headline: cv.profile?.headline ?? "",
          email: cv.profile?.email ?? "",
          phone: cv.profile?.phone ?? "",
          summary: cv.profile?.summary ?? "",
        },
        experiences: cv.experiences.map((e) => ({
          company: e.company, position: e.position,
          startDate: e.startDate, endDate: e.endDate, description: e.description,
        })),
        educations: cv.educations.map((e) => ({
          school: e.school, major: e.major, startDate: e.startDate, endDate: e.endDate,
        })),
        skills: cv.skills.map((s) => ({ name: s.name, level: s.level })),
        projects: cv.projects.map((p) => ({
          name: p.name, description: p.description, tech: p.tech, link: p.link,
        })),
      };
      return data;
    },
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
