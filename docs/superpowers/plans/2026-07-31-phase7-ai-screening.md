# AI Batch Screening (Phase 7 — Gói B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NTD bấm một nút để AI xếp hạng & so sánh toàn bộ ứng viên của một job (kèm shortlist đề xuất), hiển thị ở trang riêng, với nút chuyển nhanh vào trạng thái SCREENING.

**Architecture:** Một lệnh AI (Gemini structured output) nhận JD + tối đa 20 CV ứng viên (không tính WITHDRAWN), trả `ranking` theo số thứ tự `ref`. Core thuần `runScreening` (DI, giống `runCvEvaluation`) map `ref → applicationId`, nối ứng viên bị sót, và lưu qua dep. Server action `screenApplicants` nạp ứng viên + upsert model `Screening` (1 bản/job). Trang `/jobs/[id]/screening` render bảng xếp hạng; nút "Chuyển vào Sàng lọc" tái dùng `changeStatus` sẵn có.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 + PostgreSQL (Neon), Auth.js, Zod 4, Vitest, Tailwind 4, AI qua OpenAI-compat client (Gemini `gemini-2.5-flash`).

## Global Constraints

- **Next.js là bản có breaking changes.** Trước khi viết route/page/server-action, đọc guide liên quan trong `node_modules/next/dist/docs/`. Pages phải `await params` (`params: Promise<{ id: string }>`).
- **Prisma giữ v6.** Đẩy schema bằng `npm run db:push` (đã bọc ipv4first), KHÔNG dùng `prisma db push` trần.
- **AI provider: Gemini** qua `@/lib/ai/client` (`getAiClient`, `AI_MODEL`), structured output qua `zodResponseFormat` — giống `lib/ai/request-evaluation.ts`. Không đổi provider.
- **Test:** `npm test` (vitest run). Toàn bộ UI copy **tiếng Việt**.
- **Server actions** dùng `auth()` từ `@/auth`, `prisma` từ `@/lib/db/prisma`; kiểm tra `session.user.id` + `session.user.role`.
- **Palette:** blue-700 tiêu đề, slate-50 nền, dùng `Card`/`Button` từ `@/components/ui`.
- Áp dụng **TDD** cho logic thuần (`screening-schema`, `screening-prompt` builder, `runScreening` core); glue/UI không unit-test (an toàn bằng `npx tsc --noEmit` + `npm test` xanh).
- `MAX_SCREENING_APPLICANTS = 20`.

---

## File Structure

**Tạo mới:**
- `lib/ai/screening-schema.ts` — Zod `screeningResultSchema` + type `ScreeningResult`.
- `lib/ai/screening-prompt.ts` — `SCREENING_SYSTEM_PROMPT` + `buildScreeningPrompt(jdText, cvs)`.
- `lib/ai/request-screening.ts` — `requestScreening(prompt)` gọi AI structured.
- `lib/applications/screening.ts` — core `runScreening(params, deps)` + types + `MAX_SCREENING_APPLICANTS`.
- `lib/applications/screening-actions.ts` — `"use server"`: `screenApplicants(jobId)`.
- `lib/ai/__tests__/screening-schema.test.ts`, `lib/ai/__tests__/screening-prompt.test.ts`, `lib/applications/__tests__/screening.test.ts`.
- `app/jobs/[id]/screening/page.tsx` — trang bảng xếp hạng (SSR).
- `app/jobs/[id]/screening/ScreeningClient.tsx` — nút chạy + bảng + nút chuyển (client).

**Sửa:**
- `prisma/schema.prisma` — thêm model `Screening` + quan hệ ngược trên `JobDescription`.
- `app/jobs/[id]/applicants/page.tsx` — thêm link "🔎 Sàng lọc AI".

---

### Task 1: Prisma model Screening

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: model `Screening` (jobId @unique, summary, result Json, rawModelOutput Json); `JobDescription.screening Screening?`.

- [ ] **Step 1: Thêm model + quan hệ ngược**

Ở cuối `prisma/schema.prisma` thêm:
```prisma
model Screening {
  id             String         @id @default(cuid())
  jobId          String         @unique
  job            JobDescription @relation(fields: [jobId], references: [id], onDelete: Cascade)
  summary        String
  result         Json
  rawModelOutput Json
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}
```
Trong `model JobDescription { ... }` thêm dòng:
```prisma
  screening    Screening?
```

- [ ] **Step 2: Validate**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 3: Đẩy schema + generate**

Run: `npm run db:push`
Expected: `Your database is now in sync with your Prisma schema.` + `Generated Prisma Client`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add Screening model"
```

---

### Task 2: Zod schema kết quả sàng lọc

**Files:**
- Create: `lib/ai/screening-schema.ts`
- Test: `lib/ai/__tests__/screening-schema.test.ts`

**Interfaces:**
- Produces:
  - `screeningResultSchema` (Zod)
  - `type ScreeningResult = { ranking: { ref: number; score: number; shortlisted: boolean; reason: string }[]; summary: string }`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/ai/__tests__/screening-schema.test.ts
import { describe, it, expect } from "vitest";
import { screeningResultSchema } from "../screening-schema";

describe("screeningResultSchema", () => {
  it("chấp nhận kết quả hợp lệ", () => {
    const r = screeningResultSchema.safeParse({
      ranking: [{ ref: 1, score: 80, shortlisted: true, reason: "mạnh" }],
      summary: "ok",
    });
    expect(r.success).toBe(true);
  });

  it("từ chối khi thiếu summary", () => {
    const r = screeningResultSchema.safeParse({ ranking: [] });
    expect(r.success).toBe(false);
  });

  it("từ chối score ngoài 0-100", () => {
    const r = screeningResultSchema.safeParse({
      ranking: [{ ref: 1, score: 150, shortlisted: false, reason: "x" }],
      summary: "s",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- screening-schema`
Expected: FAIL — không import được `../screening-schema`.

- [ ] **Step 3: Viết `lib/ai/screening-schema.ts`**

```ts
import { z } from "zod";

export const screeningResultSchema = z.object({
  ranking: z.array(
    z.object({
      ref: z.number().int(),
      score: z.number().int().min(0).max(100),
      shortlisted: z.boolean(),
      reason: z.string(),
    }),
  ),
  summary: z.string(),
});

export type ScreeningResult = z.infer<typeof screeningResultSchema>;
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- screening-schema`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/screening-schema.ts lib/ai/__tests__/screening-schema.test.ts
git commit -m "feat(ai): screening result zod schema"
```

---

### Task 3: Prompt sàng lọc + request-screening

**Files:**
- Create: `lib/ai/screening-prompt.ts`
- Create: `lib/ai/request-screening.ts`
- Test: `lib/ai/__tests__/screening-prompt.test.ts`

**Interfaces:**
- Consumes: `CvInput` (`@/lib/cv/types`), `screeningResultSchema`/`ScreeningResult` (`./screening-schema`), `getAiClient`/`AI_MODEL` (`./client`).
- Produces:
  - `SCREENING_SYSTEM_PROMPT: string`
  - `buildScreeningPrompt(jdText: string, cvs: CvInput[]): string` — đánh số ứng viên `#1..#n`.
  - `requestScreening(prompt: string): Promise<ScreeningResult>`

- [ ] **Step 1: Viết test thất bại cho prompt builder**

```ts
// lib/ai/__tests__/screening-prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildScreeningPrompt } from "../screening-prompt";
import type { CvInput } from "@/lib/cv/types";

const cv = (name: string): CvInput => ({
  title: "CV",
  profile: { fullName: name, headline: "Dev", email: "", phone: "", summary: "" },
  experiences: [],
  educations: [],
  skills: [{ name: "React", level: "" }],
  projects: [],
});

describe("buildScreeningPrompt", () => {
  it("đánh số từng ứng viên và kèm JD", () => {
    const p = buildScreeningPrompt("JD nội dung", [cv("An"), cv("Bình")]);
    expect(p).toContain("JD nội dung");
    expect(p).toContain("#1");
    expect(p).toContain("An");
    expect(p).toContain("#2");
    expect(p).toContain("Bình");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- screening-prompt`
Expected: FAIL — không import được `../screening-prompt`.

- [ ] **Step 3: Viết `lib/ai/screening-prompt.ts`**

```ts
import type { CvInput } from "@/lib/cv/types";

export const SCREENING_SYSTEM_PROMPT = `Bạn là chuyên gia tuyển dụng giàu kinh nghiệm. \
Nhiệm vụ: SO SÁNH nhiều ứng viên với nhau theo một mô tả công việc (JD) và xếp hạng họ. \
Với mỗi ứng viên: chấm điểm tương đối 0-100 (so với các ứng viên khác cho vị trí này), \
đặt shortlisted = true nếu nên mời phỏng vấn, và nêu lý do ngắn gọn (điểm mạnh/yếu tương đối). \
Trả về "ranking" xếp từ TỐT NHẤT trước và PHẢI gồm TẤT CẢ ứng viên được cung cấp, \
dùng đúng số "ref" đã gán cho mỗi ứng viên. "summary" là nhận xét tổng quan về nhóm ứng viên. \
Trả lời hoàn toàn bằng tiếng Việt, đúng cấu trúc JSON được yêu cầu.`;

function formatCvBrief(cv: CvInput): string {
  const p = cv.profile;
  const lines: string[] = [];
  lines.push(`Họ tên: ${p.fullName}`);
  if (p.headline) lines.push(`Chức danh: ${p.headline}`);
  if (p.summary) lines.push(`Giới thiệu: ${p.summary}`);
  if (cv.skills.length) {
    lines.push(
      "Kỹ năng: " +
        cv.skills.map((s) => (s.level ? `${s.name} (${s.level})` : s.name)).join(", "),
    );
  }
  if (cv.experiences.length) {
    lines.push("Kinh nghiệm:");
    for (const e of cv.experiences) {
      lines.push(`- ${e.position} tại ${e.company} (${e.startDate}-${e.endDate})`);
    }
  }
  if (cv.educations.length) {
    lines.push(
      "Học vấn: " +
        cv.educations.map((e) => `${e.school}${e.major ? " - " + e.major : ""}`).join("; "),
    );
  }
  if (cv.projects.length) {
    lines.push("Dự án: " + cv.projects.map((pr) => pr.name).join(", "));
  }
  return lines.join("\n");
}

export function buildScreeningPrompt(jdText: string, cvs: CvInput[]): string {
  const blocks = cvs.map(
    (cv, i) => `### Ứng viên #${i + 1}\n${formatCvBrief(cv)}`,
  );
  return `=== MÔ TẢ CÔNG VIỆC (JD) ===
${jdText}

=== DANH SÁCH ỨNG VIÊN ===
${blocks.join("\n\n")}

Hãy so sánh và xếp hạng TẤT CẢ ứng viên trên theo JD, trả về đúng cấu trúc JSON yêu cầu (dùng số ref tương ứng #1..#${cvs.length}).`;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- screening-prompt`
Expected: PASS (1 test).

- [ ] **Step 5: Viết `lib/ai/request-screening.ts`**

```ts
import { zodResponseFormat } from "openai/helpers/zod";
import { getAiClient, AI_MODEL } from "./client";
import { SCREENING_SYSTEM_PROMPT } from "./screening-prompt";
import { screeningResultSchema, type ScreeningResult } from "./screening-schema";

export async function requestScreening(prompt: string): Promise<ScreeningResult> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: SCREENING_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(screeningResultSchema, "screening"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("Model không trả về kết quả hợp lệ");
  }
  return parsed;
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: không lỗi.

```bash
git add lib/ai/screening-prompt.ts lib/ai/request-screening.ts lib/ai/__tests__/screening-prompt.test.ts
git commit -m "feat(ai): screening prompt builder and request helper"
```

---

### Task 4: Core `runScreening` (DI) + test

**Files:**
- Create: `lib/applications/screening.ts`
- Test: `lib/applications/__tests__/screening.test.ts`

**Interfaces:**
- Consumes: `CvInput` (`@/lib/cv/types`), `buildScreeningPrompt` (`@/lib/ai/screening-prompt`), `ScreeningResult` (`@/lib/ai/screening-schema`).
- Produces:
  - `MAX_SCREENING_APPLICANTS = 20`
  - `type ScreeningApplicantInput = { applicationId: string; candidateName: string; cv: CvInput; score: number | null }`
  - `type ScreeningResultItem = { applicationId: string; candidateName: string; score: number | null; shortlisted: boolean; reason: string }`
  - `type RunScreeningParams = { jobId: string; jdText: string; applicants: ScreeningApplicantInput[] }`
  - `type RunScreeningDeps = { requestScreening: (prompt: string) => Promise<ScreeningResult>; saveScreening: (data: { jobId: string; summary: string; result: ScreeningResultItem[]; rawModelOutput: ScreeningResult }) => Promise<void> }`
  - `type RunScreeningOutcome = { ok: true } | { ok: false; error: string }`
  - `runScreening(params, deps): Promise<RunScreeningOutcome>`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/applications/__tests__/screening.test.ts
import { describe, it, expect, vi } from "vitest";
import { runScreening, type RunScreeningDeps, type ScreeningApplicantInput } from "../screening";
import type { CvInput } from "@/lib/cv/types";
import type { ScreeningResult } from "@/lib/ai/screening-schema";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "x", headline: "", email: "", phone: "", summary: "" },
  experiences: [], educations: [], skills: [], projects: [],
};

function applicant(id: string, name: string, score: number | null): ScreeningApplicantInput {
  return { applicationId: id, candidateName: name, cv, score };
}

function deps(ai: ScreeningResult, over: Partial<RunScreeningDeps> = {}): RunScreeningDeps {
  return {
    requestScreening: vi.fn().mockResolvedValue(ai),
    saveScreening: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("runScreening", () => {
  it("báo lỗi khi không có ứng viên", async () => {
    const d = deps({ ranking: [], summary: "" });
    const r = await runScreening({ jobId: "j", jdText: "jd", applicants: [] }, d);
    expect(r).toEqual({ ok: false, error: "Chưa có ứng viên để sàng lọc" });
    expect(d.requestScreening).not.toHaveBeenCalled();
  });

  it("map ref -> application theo đúng thứ tự, bỏ ref ngoài phạm vi và trùng", async () => {
    const applicants = [applicant("a1", "An", 50), applicant("a2", "Bình", 60), applicant("a3", "Cường", 70)];
    const ai: ScreeningResult = {
      ranking: [
        { ref: 2, score: 90, shortlisted: true, reason: "tốt" },
        { ref: 5, score: 80, shortlisted: false, reason: "ngoài phạm vi" },
        { ref: 2, score: 10, shortlisted: false, reason: "trùng" },
        { ref: 1, score: 70, shortlisted: true, reason: "khá" },
      ],
      summary: "tổng quan",
    };
    const d = deps(ai);
    const r = await runScreening({ jobId: "j", jdText: "jd", applicants }, d);
    expect(r).toEqual({ ok: true });
    expect(d.saveScreening).toHaveBeenCalledWith({
      jobId: "j",
      summary: "tổng quan",
      rawModelOutput: ai,
      result: [
        { applicationId: "a2", candidateName: "Bình", score: 90, shortlisted: true, reason: "tốt" },
        { applicationId: "a1", candidateName: "An", score: 70, shortlisted: true, reason: "khá" },
        { applicationId: "a3", candidateName: "Cường", score: null, shortlisted: false, reason: "Chưa được AI xếp hạng" },
      ],
    });
  });

  it("báo lỗi mềm khi AI thất bại", async () => {
    const d = deps({ ranking: [], summary: "" }, {
      requestScreening: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const r = await runScreening(
      { jobId: "j", jdText: "jd", applicants: [applicant("a1", "An", 1)] },
      d,
    );
    expect(r).toEqual({ ok: false, error: "AI sàng lọc thất bại, vui lòng thử lại" });
    expect(d.saveScreening).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- applications/__tests__/screening`
Expected: FAIL — không import được `../screening`.

- [ ] **Step 3: Viết `lib/applications/screening.ts`**

```ts
import type { CvInput } from "@/lib/cv/types";
import { buildScreeningPrompt } from "@/lib/ai/screening-prompt";
import type { ScreeningResult } from "@/lib/ai/screening-schema";

export const MAX_SCREENING_APPLICANTS = 20;

export type ScreeningApplicantInput = {
  applicationId: string;
  candidateName: string;
  cv: CvInput;
  score: number | null;
};

export type ScreeningResultItem = {
  applicationId: string;
  candidateName: string;
  score: number | null;
  shortlisted: boolean;
  reason: string;
};

export type RunScreeningParams = {
  jobId: string;
  jdText: string;
  applicants: ScreeningApplicantInput[];
};

export type RunScreeningDeps = {
  requestScreening: (prompt: string) => Promise<ScreeningResult>;
  saveScreening: (data: {
    jobId: string;
    summary: string;
    result: ScreeningResultItem[];
    rawModelOutput: ScreeningResult;
  }) => Promise<void>;
};

export type RunScreeningOutcome =
  | { ok: true }
  | { ok: false; error: string };

export async function runScreening(
  params: RunScreeningParams,
  deps: RunScreeningDeps,
): Promise<RunScreeningOutcome> {
  if (params.applicants.length === 0) {
    return { ok: false, error: "Chưa có ứng viên để sàng lọc" };
  }

  const prompt = buildScreeningPrompt(
    params.jdText,
    params.applicants.map((a) => a.cv),
  );

  let ai: ScreeningResult;
  try {
    ai = await deps.requestScreening(prompt);
  } catch {
    return { ok: false, error: "AI sàng lọc thất bại, vui lòng thử lại" };
  }

  const n = params.applicants.length;
  const seen = new Set<number>();
  const result: ScreeningResultItem[] = [];

  for (const r of ai.ranking) {
    const idx = r.ref - 1;
    if (idx < 0 || idx >= n) continue;
    if (seen.has(idx)) continue;
    seen.add(idx);
    const a = params.applicants[idx];
    result.push({
      applicationId: a.applicationId,
      candidateName: a.candidateName,
      score: r.score,
      shortlisted: r.shortlisted,
      reason: r.reason,
    });
  }

  params.applicants.forEach((a, idx) => {
    if (!seen.has(idx)) {
      result.push({
        applicationId: a.applicationId,
        candidateName: a.candidateName,
        score: null,
        shortlisted: false,
        reason: "Chưa được AI xếp hạng",
      });
    }
  });

  await deps.saveScreening({
    jobId: params.jobId,
    summary: ai.summary,
    result,
    rawModelOutput: ai,
  });

  return { ok: true };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- applications/__tests__/screening`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/applications/screening.ts lib/applications/__tests__/screening.test.ts
git commit -m "feat(applications): runScreening core with ref mapping"
```

---

### Task 5: Server action `screenApplicants`

**Files:**
- Create: `lib/applications/screening-actions.ts`

**Interfaces:**
- Consumes: `runScreening`/`RunScreeningDeps`/`ScreeningApplicantInput`/`MAX_SCREENING_APPLICANTS` (`./screening`), `requestScreening` (`@/lib/ai/request-screening`), `createRateLimiter` (`@/lib/ai/rate-limit`), `prisma`, `auth`, `CvInput` (`@/lib/cv/types`).
- Produces: `screenApplicants(jobId: string): Promise<{ ok: true } | { ok: false; error: string }>`

Glue task: an toàn bằng `npx tsc --noEmit` + `npm test` (không unit-test riêng, đúng chuẩn dự án).

- [ ] **Step 1: Viết `lib/applications/screening-actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import { requestScreening } from "@/lib/ai/request-screening";
import {
  runScreening,
  MAX_SCREENING_APPLICANTS,
  type RunScreeningDeps,
  type ScreeningApplicantInput,
} from "./screening";
import type { CvInput } from "@/lib/cv/types";

const screeningLimiter = createRateLimiter({ max: 5, windowMs: 60000 });

export async function screenApplicants(
  jobId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "RECRUITER")
    return { ok: false, error: "Chỉ nhà tuyển dụng mới sàng lọc" };

  if (!screeningLimiter.check(userId, Date.now()))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, userId },
    select: { id: true, rawText: true },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const rows = await prisma.application.findMany({
    where: { jobId, status: { not: "WITHDRAWN" } },
    select: {
      id: true,
      cvSnapshot: true,
      candidate: { select: { name: true } },
      evaluation: { select: { overallScore: true } },
    },
  });

  // Sắp theo điểm giảm dần (đơn chưa có điểm xếp sau), cắt còn tối đa 20.
  rows.sort(
    (a, b) => (b.evaluation?.overallScore ?? -1) - (a.evaluation?.overallScore ?? -1),
  );
  const applicants: ScreeningApplicantInput[] = rows
    .slice(0, MAX_SCREENING_APPLICANTS)
    .map((r) => ({
      applicationId: r.id,
      candidateName: r.candidate.name,
      cv: r.cvSnapshot as unknown as CvInput,
      score: r.evaluation?.overallScore ?? null,
    }));

  const deps: RunScreeningDeps = {
    requestScreening,
    saveScreening: async (data) => {
      await prisma.screening.upsert({
        where: { jobId: data.jobId },
        create: {
          jobId: data.jobId,
          summary: data.summary,
          result: data.result,
          rawModelOutput: data.rawModelOutput,
        },
        update: {
          summary: data.summary,
          result: data.result,
          rawModelOutput: data.rawModelOutput,
        },
      });
    },
  };

  const outcome = await runScreening(
    { jobId: job.id, jdText: job.rawText, applicants },
    deps,
  );

  if (outcome.ok) revalidatePath(`/jobs/${jobId}/screening`);
  return outcome;
}
```

- [ ] **Step 2: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 3: Commit**

```bash
git add lib/applications/screening-actions.ts
git commit -m "feat(applications): screenApplicants server action"
```

---

### Task 6: Trang sàng lọc + client + link từ board

**Files:**
- Create: `app/jobs/[id]/screening/ScreeningClient.tsx`
- Create: `app/jobs/[id]/screening/page.tsx`
- Modify: `app/jobs/[id]/applicants/page.tsx`

**Interfaces:**
- Consumes: `screenApplicants` (`@/lib/applications/screening-actions`), `changeStatus` (`@/lib/applications/actions`), `ScreeningResultItem` (`@/lib/applications/screening`).

- [ ] **Step 1: Tạo `app/jobs/[id]/screening/ScreeningClient.tsx` (client)**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { screenApplicants } from "@/lib/applications/screening-actions";
import { changeStatus } from "@/lib/applications/actions";
import type { ScreeningResultItem } from "@/lib/applications/screening";

export default function ScreeningClient({
  jobId,
  screening,
}: {
  jobId: string;
  screening: { summary: string; result: ScreeningResultItem[] } | null;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  async function onRun() {
    setRunning(true);
    const r = await screenApplicants(jobId);
    if (r.ok) {
      toast.success("Đã sàng lọc xong");
      router.refresh();
    } else {
      toast.error(r.error);
    }
    setRunning(false);
  }

  async function onMove(applicationId: string) {
    setMovingId(applicationId);
    const r = await changeStatus(applicationId, "SCREENING", "");
    if (r.ok) {
      toast.success('Đã chuyển vào "Đang sàng lọc"');
      router.refresh();
    } else {
      toast.error(r.error);
    }
    setMovingId(null);
  }

  return (
    <div className="mt-4 grid gap-4">
      <div>
        <Button onClick={onRun} disabled={running}>
          {running ? "Đang sàng lọc..." : screening ? "Chạy lại sàng lọc AI" : "Chạy sàng lọc AI"}
        </Button>
      </div>

      {!screening ? (
        <p className="text-sm text-slate-500">Chưa có kết quả sàng lọc. Bấm nút trên để AI xếp hạng ứng viên.</p>
      ) : (
        <>
          <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
            <p className="font-semibold text-blue-700">Nhận xét tổng quan</p>
            <p className="mt-1 whitespace-pre-wrap">{screening.summary}</p>
          </div>

          <div className="grid gap-2">
            {screening.result.map((r, i) => (
              <div
                key={r.applicationId}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">
                      #{i + 1} · {r.candidateName}
                      {r.shortlisted && (
                        <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Shortlist
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-blue-600">
                      {r.score !== null ? `Điểm: ${r.score}/100` : "Chưa xếp hạng"}
                    </p>
                    <p className="mt-1 text-slate-700">{r.reason}</p>
                  </div>
                  {r.shortlisted && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onMove(r.applicationId)}
                      disabled={movingId === r.applicationId}
                    >
                      {movingId === r.applicationId ? "Đang chuyển..." : "Chuyển vào Sàng lọc"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tạo `app/jobs/[id]/screening/page.tsx` (server)**

```tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import ScreeningClient from "./ScreeningClient";
import type { ScreeningResultItem } from "@/lib/applications/screening";

export const dynamic = "force-dynamic";

export default async function ScreeningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect(`/jobs/${id}`);

  const job = await prisma.jobDescription.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      title: true,
      screening: { select: { summary: true, result: true } },
    },
  });
  if (!job) notFound();

  const screening = job.screening
    ? {
        summary: job.screening.summary,
        result: job.screening.result as unknown as ScreeningResultItem[],
      }
    : null;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href={`/jobs/${id}/applicants`} className="text-sm text-blue-600 hover:underline">
          ← Về danh sách ứng viên
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-blue-700">
          Sàng lọc AI — {job.title || "(chưa có tiêu đề)"}
        </h1>
        <p className="text-sm text-slate-500">
          AI xếp hạng và so sánh các ứng viên (không tính đơn đã rút), tối đa 20 ứng viên điểm cao nhất.
        </p>
        <ScreeningClient jobId={job.id} screening={screening} />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Sửa `app/jobs/[id]/applicants/page.tsx` — thêm link "🔎 Sàng lọc AI"**

Trong phần render, ngay dưới đoạn `<p>` mô tả "Kéo thẻ ứng viên..." (khối `<p className="text-sm text-slate-500">Kéo thẻ...`), thêm:
```tsx
        <Link
          href={`/jobs/${id}/screening`}
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          🔎 Sàng lọc AI
        </Link>
```
(`Link` đã được import sẵn ở đầu file.)

- [ ] **Step 4: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 5: Kiểm tra thủ công (cho người dùng)**

Chạy `npm run dev`, đăng nhập RECRUITER chủ một job có ứng viên: mở trang board → bấm "🔎 Sàng lọc AI" → trang screening → "Chạy sàng lọc AI" → hiện bảng xếp hạng + summary; hàng shortlist có nút "Chuyển vào Sàng lọc" → bấm → ứng viên chuyển sang cột "Đang sàng lọc" trên board. Job không có ứng viên → báo "Chưa có ứng viên để sàng lọc".

- [ ] **Step 6: Commit**

```bash
git add "app/jobs/[id]/screening/ScreeningClient.tsx" "app/jobs/[id]/screening/page.tsx" "app/jobs/[id]/applicants/page.tsx"
git commit -m "feat(applications): AI screening page with ranking and quick move"
```

---

## Self-Review (đã thực hiện)

- **Bao phủ spec:** §2 AI I/O (ref, cap 20, schema) → Task 2 (schema) + 3 (prompt/request) + 5 (cap 20 trong action). §3 model `Screening` upsert → Task 1 + 5 (upsert). §4.1 core (rỗng, map ref, sót, lưu) → Task 4. §4.2 action (auth/owner/rate-limit/nạp/AI/upsert) → Task 5. §4.3 nút chuyển tái dùng `changeStatus` → Task 6. §5 trang + link → Task 6. §6 xử lý lỗi → lỗi mềm trong core (Task 4) + action (Task 5) + changeStatus có sẵn. §7 test → Task 2/3/4 (TDD thuần).
- **Placeholder:** không còn TBD/TODO; mọi bước có code hoặc lệnh cụ thể.
- **Nhất quán kiểu:** `screeningResultSchema`/`ScreeningResult` (Task 2) dùng ở Task 3/4; `buildScreeningPrompt(jdText, cvs)` (Task 3) dùng trong core (Task 4); `runScreening`/`RunScreeningDeps`/`ScreeningApplicantInput`/`ScreeningResultItem`/`MAX_SCREENING_APPLICANTS` (Task 4) dùng ở Task 5/6; `screenApplicants(jobId)` (Task 5) dùng ở Task 6; `changeStatus(applicationId, "SCREENING", "")` tái dùng đúng chữ ký sẵn có.
```
