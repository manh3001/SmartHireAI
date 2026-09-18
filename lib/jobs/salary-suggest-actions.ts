"use server";

import { requireRole } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getCachedSalaryRows } from "@/lib/salary/insights-data";
import { computeSalarySuggestion, type SalarySuggestion } from "@/lib/salary/suggestion";
import { buildSalaryNotePrompt } from "@/lib/ai/salary-note-prompt";
import { requestSalaryNote } from "@/lib/ai/request-salary-note";
import { JOB_CATEGORY_LABELS, normalizeCategory } from "@/lib/jobs/job-categories";
import { EXPERIENCE_LEVEL_LABELS, EXPERIENCE_LEVELS } from "@/lib/jobs/job-fields";
import type { ExperienceLevel } from "@/lib/jobs/job-fields";

export async function suggestSalary(input: {
  title: string;
  category: string | null;
  experienceLevel: string | null;
  skills: string;
}): Promise<{ ok: true; suggestion: SalarySuggestion; note: string } | { ok: false; error: string }> {
  const session = await requireRole("RECRUITER");
  if (!(await checkRateLimit("ai", session.user.id)))
    return { ok: false, error: "Bạn thao tác quá nhanh, vui lòng thử lại sau." };

  const rows = await getCachedSalaryRows();
  const suggestion = computeSalarySuggestion(rows, {
    category: input.category,
    experienceLevel: input.experienceLevel,
  });
  if (!suggestion) return { ok: false, error: "Chưa đủ dữ liệu lương để gợi ý" };

  const cat = normalizeCategory(input.category);
  const level =
    input.experienceLevel && (EXPERIENCE_LEVELS as readonly string[]).includes(input.experienceLevel)
      ? (input.experienceLevel as ExperienceLevel)
      : null;

  let note = "";
  try {
    const result = await requestSalaryNote(
      buildSalaryNotePrompt({
        title: input.title || "(chưa có tiêu đề)",
        categoryLabel: cat ? JOB_CATEGORY_LABELS[cat] : "(chưa chọn)",
        levelLabel: level ? EXPERIENCE_LEVEL_LABELS[level] : "(chưa chọn)",
        skills: input.skills,
        medianMin: suggestion.medianMin,
        medianMax: suggestion.medianMax,
        sampleSize: suggestion.sampleSize,
        basis: suggestion.basis,
      }),
    );
    note = result.note;
  } catch {
    note = ""; // AI lỗi không chặn phần số — số quan trọng hơn
  }

  return { ok: true, suggestion, note };
}
