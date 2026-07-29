import { NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { extractText, getDocumentProxy } from "unpdf";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { getAiClient, AI_MODEL } from "@/lib/ai/client";
import {
  cvExtractionSchema,
  EXTRACTION_SYSTEM,
  buildExtractionPrompt,
} from "@/lib/ai/extract";
import { normalizeCv } from "@/lib/cv/normalize";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import type { CvInput } from "@/lib/cv/types";

export const runtime = "nodejs";

const limiter = createRateLimiter({ max: 5, windowMs: 60000 });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const userId = session.user.id;

  if (!limiter.check(userId, Date.now())) {
    return NextResponse.json(
      { error: "Bạn thao tác quá nhanh, vui lòng thử lại sau" },
      { status: 429 },
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "Chưa chọn file" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Chỉ hỗ trợ file PDF" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File quá lớn (tối đa 5MB)" }, { status: 400 });
  }

  let text = "";
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const res = await extractText(pdf, { mergePages: true });
    text = Array.isArray(res.text) ? res.text.join("\n") : res.text;
  } catch {
    return NextResponse.json({ error: "Không đọc được file PDF" }, { status: 400 });
  }
  if (text.trim().length < 20) {
    return NextResponse.json(
      { error: "Không đọc được nội dung; hãy dùng PDF có chữ (không phải ảnh scan)" },
      { status: 422 },
    );
  }

  let extracted: CvInput;
  try {
    const client = getAiClient();
    const completion = await client.chat.completions.parse({
      model: AI_MODEL,
      max_tokens: 4096,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM },
        { role: "user", content: buildExtractionPrompt(text) },
      ],
      response_format: zodResponseFormat(cvExtractionSchema, "cv"),
    });
    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) throw new Error("no parse");
    extracted = parsed;
  } catch {
    return NextResponse.json(
      { error: "AI không trích xuất được, vui lòng thử lại" },
      { status: 500 },
    );
  }

  const data = normalizeCv(extracted);

  const cv = await prisma.cV.create({
    data: {
      userId,
      title: data.title || "CV nhập từ PDF",
      profile: {
        create: {
          fullName: data.profile.fullName,
          headline: data.profile.headline,
          email: data.profile.email,
          phone: data.profile.phone,
          summary: data.profile.summary,
        },
      },
      experiences: { create: data.experiences.map((e, i) => ({ ...e, order: i })) },
      educations: { create: data.educations.map((e, i) => ({ ...e, order: i })) },
      skills: { create: data.skills.map((s, i) => ({ ...s, order: i })) },
      projects: { create: data.projects.map((p, i) => ({ ...p, order: i })) },
    },
    select: { id: true },
  });

  return NextResponse.json({ cvId: cv.id }, { status: 201 });
}
