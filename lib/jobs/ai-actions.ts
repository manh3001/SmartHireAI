"use server";

import { requireRole } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { buildJdDraftPrompt } from "@/lib/ai/jd-draft-prompt";
import { requestJdDraft } from "@/lib/ai/request-jd-draft";
import { mapDraftToForm, type JdFormValues } from "./jd-draft-map";

export async function draftJobDescription(
  input: { title: string; brief: string },
): Promise<{ ok: true; draft: JdFormValues } | { ok: false; error: string }> {
  const session = await requireRole("RECRUITER");
  const title = (input.title ?? "").trim();
  const brief = (input.brief ?? "").trim();
  if (!title) return { ok: false, error: "Vui lòng nhập tiêu đề vị trí trước" };
  if (!brief) return { ok: false, error: "Vui lòng nhập mô tả ngắn để AI soạn" };

  if (!(await checkRateLimit("ai", session.user!.id as string)))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  try {
    const result = await requestJdDraft(buildJdDraftPrompt({ title, brief }));
    return { ok: true, draft: mapDraftToForm(result) };
  } catch {
    return { ok: false, error: "AI soạn thất bại, vui lòng thử lại" };
  }
}
