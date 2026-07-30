# Phase 6 Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ba tinh chỉnh sau Phase 6: rút đơn thành trạng thái WITHDRAWN (mềm), preview không ghi DB (điểm chính thức tính lúc nộp), và trang chi tiết ứng viên cho NTD (xem cvSnapshot).

**Architecture:** Thêm `WITHDRAWN` vào enum trạng thái nhưng tách `BOARD_STATUSES` (6 cột kéo-thả) khỏi `APPLICATION_STATUSES` (gồm WITHDRAWN). `previewMatch` chỉ tính điểm để hiển thị; `submitApplication` tự tính lại Evaluation ở server lúc nộp (atomic trong transaction, AI ngoài transaction), client không gửi điểm. Trang chi tiết ứng viên SSR + component đọc-CV `CvView` render `cvSnapshot`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 + PostgreSQL (Neon), Auth.js, Zod 4, Vitest, Tailwind 4, AI qua OpenAI-compat client (Gemini).

## Global Constraints

- **Next.js là bản có breaking changes.** Trước khi viết code route/page/server-action, đọc guide liên quan trong `node_modules/next/dist/docs/`. Pages phải `await params` (`params: Promise<{ ... }>`).
- **Prisma giữ v6.** Đẩy schema bằng `npm run db:push` (đã bọc ipv4first), KHÔNG dùng `prisma db push` trần.
- **AI provider: Gemini** qua `@/lib/ai/client` (`getAiClient`, `AI_MODEL`) — không đổi provider.
- **Test:** `npm test` (vitest run). Toàn bộ UI copy **tiếng Việt**. Nhãn: `WITHDRAWN = "Đã rút"`.
- **Server actions** dùng `auth()` từ `@/auth`, `prisma` từ `@/lib/db/prisma`; kiểm tra `session.user.id` + `session.user.role`.
- **Palette:** blue-700 tiêu đề, slate-50 nền, dùng `Card`/`Button` từ `@/components/ui`.
- Áp dụng **TDD** cho logic thuần (`status.ts`, `apply.ts`); glue/UI không unit-test (an toàn bằng `npx tsc --noEmit` + `npm test` xanh).

---

## File Structure

**Sửa:**
- `prisma/schema.prisma` — thêm `WITHDRAWN` vào enum `ApplicationStatus`.
- `lib/applications/status.ts` — thêm WITHDRAWN, `BOARD_STATUSES`, cập nhật `canTransition`.
- `lib/applications/__tests__/status.test.ts` — cập nhật + thêm test WITHDRAWN.
- `lib/applications/apply.ts` — bỏ `evaluationId` khỏi `ApplyParams`/`CreateApplicationData`.
- `lib/applications/__tests__/apply.test.ts` — cập nhật khớp core mới.
- `lib/applications/actions.ts` — `previewMatch` không ghi DB; `submitApplication` tính điểm lúc nộp + bỏ `evaluationId`; `withdrawApplication` chuyển WITHDRAWN.
- `app/jobs/[id]/apply/ApplyForm.tsx` — bỏ state `evaluationId`.
- `app/jobs/[id]/applicants/ApplicantsBoard.tsx` — cột từ `BOARD_STATUSES`, mục "Đã rút", link chi tiết.
- `app/jobs/[id]/applicants/page.tsx` — truyền `jobId` cho board.

**Tạo mới:**
- `components/CvView.tsx` — render read-only một `CvInput`.
- `app/jobs/[id]/applicants/[appId]/page.tsx` — trang chi tiết ứng viên (NTD).

---

### Task 1: Thêm WITHDRAWN vào enum Prisma

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: enum `ApplicationStatus` có thêm giá trị `WITHDRAWN`.

- [ ] **Step 1: Thêm giá trị vào enum**

Trong `prisma/schema.prisma`, sửa enum `ApplicationStatus` thành:
```prisma
enum ApplicationStatus {
  SUBMITTED
  SCREENING
  INTERVIEW
  OFFER
  HIRED
  REJECTED
  WITHDRAWN
}
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
git commit -m "feat(db): add WITHDRAWN application status"
```

---

### Task 2: status.ts — BOARD_STATUSES + WITHDRAWN + canTransition

**Files:**
- Modify: `lib/applications/status.ts`
- Modify: `lib/applications/__tests__/status.test.ts`

**Interfaces:**
- Produces:
  - `APPLICATION_STATUSES` (7 phần tử, gồm `WITHDRAWN`)
  - `BOARD_STATUSES` (6 phần tử pipeline, KHÔNG gồm `WITHDRAWN`)
  - `type ApplicationStatus` (7 giá trị)
  - `STATUS_LABELS` có `WITHDRAWN: "Đã rút"`
  - `canTransition(from, to)` — chặn thêm vào/ra khỏi WITHDRAWN
  - `canWithdraw(status)` — giữ nguyên (SUBMITTED | SCREENING)

- [ ] **Step 1: Cập nhật test (thay thế toàn bộ file test)**

Ghi đè `lib/applications/__tests__/status.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  APPLICATION_STATUSES,
  BOARD_STATUSES,
  STATUS_LABELS,
  canTransition,
  canWithdraw,
} from "../status";

describe("status", () => {
  it("APPLICATION_STATUSES gồm 7 trạng thái (có WITHDRAWN)", () => {
    expect(APPLICATION_STATUSES).toHaveLength(7);
    expect(APPLICATION_STATUSES).toContain("WITHDRAWN");
  });

  it("BOARD_STATUSES gồm 6 cột pipeline, không có WITHDRAWN", () => {
    expect(BOARD_STATUSES).toHaveLength(6);
    expect(BOARD_STATUSES).not.toContain("WITHDRAWN");
  });

  it("nhãn tiếng Việt đầy đủ", () => {
    expect(STATUS_LABELS.SUBMITTED).toBe("Đã nộp");
    expect(STATUS_LABELS.HIRED).toBe("Nhận");
    expect(STATUS_LABELS.WITHDRAWN).toBe("Đã rút");
  });

  it("không cho chuyển về cùng trạng thái", () => {
    expect(canTransition("SCREENING", "SCREENING")).toBe(false);
  });

  it("không cho chuyển ngược về SUBMITTED", () => {
    expect(canTransition("SCREENING", "SUBMITTED")).toBe(false);
  });

  it("không cho NTD kéo vào WITHDRAWN", () => {
    expect(canTransition("SCREENING", "WITHDRAWN")).toBe(false);
  });

  it("không cho chuyển ra khỏi WITHDRAWN", () => {
    expect(canTransition("WITHDRAWN", "SCREENING")).toBe(false);
  });

  it("cho chuyển sang trạng thái khác hợp lệ", () => {
    expect(canTransition("SUBMITTED", "SCREENING")).toBe(true);
    expect(canTransition("INTERVIEW", "OFFER")).toBe(true);
    expect(canTransition("SCREENING", "REJECTED")).toBe(true);
  });

  it("chỉ cho rút đơn khi mới nộp hoặc đang sàng lọc", () => {
    expect(canWithdraw("SUBMITTED")).toBe(true);
    expect(canWithdraw("SCREENING")).toBe(true);
    expect(canWithdraw("INTERVIEW")).toBe(false);
    expect(canWithdraw("HIRED")).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- applications/__tests__/status`
Expected: FAIL — không import được `BOARD_STATUSES`, và độ dài `APPLICATION_STATUSES` sai.

- [ ] **Step 3: Cập nhật `lib/applications/status.ts` (thay toàn bộ)**

```ts
export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// 6 cột pipeline mà NTD kéo-thả trên board (không gồm WITHDRAWN).
export const BOARD_STATUSES = [
  "SUBMITTED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
] as const satisfies readonly ApplicationStatus[];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: "Đã nộp",
  SCREENING: "Đang sàng lọc",
  INTERVIEW: "Phỏng vấn",
  OFFER: "Offer",
  HIRED: "Nhận",
  REJECTED: "Từ chối",
  WITHDRAWN: "Đã rút",
};

// NTD kéo thẻ giữa các cột tự do, trừ các luật:
// - không chuyển về chính nó
// - không kéo ngược về SUBMITTED (trạng thái khởi tạo)
// - không kéo vào/ra khỏi WITHDRAWN (chỉ ứng viên tự rút mới đặt được)
export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  if (from === to) return false;
  if (to === "SUBMITTED") return false;
  if (to === "WITHDRAWN") return false;
  if (from === "WITHDRAWN") return false;
  return true;
}

export function canWithdraw(status: ApplicationStatus): boolean {
  return status === "SUBMITTED" || status === "SCREENING";
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- applications/__tests__/status`
Expected: PASS (9 tests).

- [ ] **Step 5: Chạy toàn bộ test (đảm bảo không vỡ nơi khác)**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add lib/applications/status.ts lib/applications/__tests__/status.test.ts
git commit -m "feat(applications): WITHDRAWN status + BOARD_STATUSES separation"
```

---

### Task 3: apply.ts — bỏ evaluationId khỏi core

**Files:**
- Modify: `lib/applications/apply.ts`
- Modify: `lib/applications/__tests__/apply.test.ts`

**Interfaces:**
- Produces (đã đổi):
  - `type ApplyParams = { jobId; candidateId; cvId; coverLetter }` (bỏ `evaluationId`)
  - `type CreateApplicationData = { jobId; candidateId; cvId; cvSnapshot: CvInput; coverLetter }` (bỏ `evaluationId`)
  - `runApply(params, deps)` gọi `createApplication` KHÔNG kèm `evaluationId`.

- [ ] **Step 1: Cập nhật test (thay toàn bộ file)**

Ghi đè `lib/applications/__tests__/apply.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { runApply, type ApplyDeps } from "../apply";
import type { CvInput } from "@/lib/cv/types";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "A", headline: "", email: "", phone: "", summary: "" },
  experiences: [],
  educations: [],
  skills: [],
  projects: [],
};

function deps(over: Partial<ApplyDeps> = {}): ApplyDeps {
  return {
    findPublicJob: vi.fn().mockResolvedValue({ id: "job_1" }),
    findExistingApplication: vi.fn().mockResolvedValue(null),
    findCandidateCv: vi.fn().mockResolvedValue(cv),
    createApplication: vi.fn().mockResolvedValue({ id: "app_1" }),
    ...over,
  };
}

const params = {
  jobId: "job_1",
  candidateId: "u_1",
  cvId: "cv_1",
  coverLetter: "xin chào",
};

describe("runApply", () => {
  it("nộp đơn thành công, truyền snapshot CV, không kèm evaluationId", async () => {
    const d = deps();
    const r = await runApply(params, d);
    expect(r).toEqual({ ok: true, applicationId: "app_1" });
    expect(d.createApplication).toHaveBeenCalledWith({
      jobId: "job_1",
      candidateId: "u_1",
      cvId: "cv_1",
      cvSnapshot: cv,
      coverLetter: "xin chào",
    });
  });

  it("báo lỗi khi job không tồn tại/không công khai", async () => {
    const r = await runApply(params, deps({ findPublicJob: vi.fn().mockResolvedValue(null) }));
    expect(r).toEqual({ ok: false, error: "Không tìm thấy tin tuyển dụng" });
  });

  it("chặn nộp trùng", async () => {
    const r = await runApply(
      params,
      deps({ findExistingApplication: vi.fn().mockResolvedValue({ id: "app_x" }) }),
    );
    expect(r).toEqual({ ok: false, error: "Bạn đã ứng tuyển tin này" });
  });

  it("báo lỗi khi không tìm thấy CV của ứng viên", async () => {
    const r = await runApply(params, deps({ findCandidateCv: vi.fn().mockResolvedValue(null) }));
    expect(r).toEqual({ ok: false, error: "Không tìm thấy CV" });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- applications/__tests__/apply`
Expected: FAIL — test 1 kỳ vọng `createApplication` được gọi KHÔNG có `evaluationId`, nhưng core hiện vẫn truyền `evaluationId`.

- [ ] **Step 3: Cập nhật `lib/applications/apply.ts` (thay toàn bộ)**

```ts
import type { CvInput } from "@/lib/cv/types";

export type ApplyParams = {
  jobId: string;
  candidateId: string;
  cvId: string;
  coverLetter: string;
};

export type CreateApplicationData = {
  jobId: string;
  candidateId: string;
  cvId: string;
  cvSnapshot: CvInput;
  coverLetter: string;
};

export type ApplyDeps = {
  findPublicJob: (jobId: string) => Promise<{ id: string } | null>;
  findExistingApplication: (
    jobId: string,
    candidateId: string,
  ) => Promise<{ id: string } | null>;
  findCandidateCv: (
    cvId: string,
    candidateId: string,
  ) => Promise<CvInput | null>;
  createApplication: (data: CreateApplicationData) => Promise<{ id: string }>;
};

export type ApplyOutcome =
  | { ok: true; applicationId: string }
  | { ok: false; error: string };

export async function runApply(
  params: ApplyParams,
  deps: ApplyDeps,
): Promise<ApplyOutcome> {
  const job = await deps.findPublicJob(params.jobId);
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const existing = await deps.findExistingApplication(
    params.jobId,
    params.candidateId,
  );
  if (existing) return { ok: false, error: "Bạn đã ứng tuyển tin này" };

  const cv = await deps.findCandidateCv(params.cvId, params.candidateId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  const created = await deps.createApplication({
    jobId: params.jobId,
    candidateId: params.candidateId,
    cvId: params.cvId,
    cvSnapshot: cv,
    coverLetter: params.coverLetter,
  });
  return { ok: true, applicationId: created.id };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- applications/__tests__/apply`
Expected: PASS (4 tests). (actions.ts sẽ còn lỗi typecheck vì vẫn truyền `evaluationId` — sửa ở Task 4. Đừng chạy `tsc` ở task này.)

- [ ] **Step 5: Commit**

```bash
git add lib/applications/apply.ts lib/applications/__tests__/apply.test.ts
git commit -m "refactor(applications): drop evaluationId from runApply core"
```

---

### Task 4: actions.ts + ApplyForm.tsx — preview không ghi DB, tính điểm lúc nộp, rút đơn mềm

**Files:**
- Modify: `lib/applications/actions.ts`
- Modify: `app/jobs/[id]/apply/ApplyForm.tsx`

**Interfaces:**
- Consumes: `runApply`/`ApplyDeps` (đã bỏ `evaluationId`), `canWithdraw` + `ApplicationStatus` (`./status`), `applySchema`, `loadCvInput`, `requestEvaluation`, `buildEvaluationPrompt`, `createRateLimiter`, `prisma`, `auth`.
- Produces (đổi chữ ký):
  - `previewMatch(jobId, cvId): Promise<{ ok: true; score: number; summary: string } | { ok: false; error: string }>`
  - `submitApplication(input: { jobId: string; cvId: string; coverLetter: string }): Promise<{ ok: true; applicationId: string } | { ok: false; error: string }>`
  - `withdrawApplication` và `changeStatus` giữ chữ ký cũ.

Task glue: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: Thay `previewMatch` (bỏ ghi Evaluation)**

Thay toàn bộ hàm `previewMatch` (dòng ~17-71) bằng:
```ts
export async function previewMatch(
  jobId: string,
  cvId: string,
): Promise<
  { ok: true; score: number; summary: string } | { ok: false; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới xem điểm phù hợp" };

  if (!previewLimiter.check(userId, Date.now()))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, isPublic: true },
    select: { id: true, rawText: true },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const cv = await loadCvInput(cvId, userId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  try {
    const result = await requestEvaluation(buildEvaluationPrompt(cv, job.rawText));
    return { ok: true, score: result.overallScore, summary: result.summary };
  } catch {
    return { ok: false, error: "AI đánh giá thất bại, vui lòng thử lại" };
  }
}
```

- [ ] **Step 2: Thêm limiter cho submit + thay `submitApplication`**

Ngay dưới dòng `const previewLimiter = createRateLimiter({ max: 5, windowMs: 60000 });` thêm:
```ts
const submitLimiter = createRateLimiter({ max: 5, windowMs: 60000 });
```
Thay toàn bộ hàm `submitApplication` bằng (bỏ `evaluationId` khỏi input + đoạn `trustedEvaluationId`; tính Evaluation ở server lúc nộp, atomic trong transaction, AI gọi ngoài transaction):
```ts
export async function submitApplication(input: {
  jobId: string;
  cvId: string;
  coverLetter: string;
}): Promise<
  { ok: true; applicationId: string } | { ok: false; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới được ứng tuyển" };

  if (!submitLimiter.check(userId, Date.now()))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const parsed = applySchema.safeParse({
    cvId: input.cvId,
    coverLetter: input.coverLetter,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  // Nạp job (kèm rawText để tính điểm chính thức lúc nộp). runApply dùng lại
  // đúng object này qua findPublicJob nên không truy vấn job hai lần.
  const job = await prisma.jobDescription.findFirst({
    where: { id: input.jobId, isPublic: true },
    select: { id: true, rawText: true },
  });

  const deps: ApplyDeps = {
    findPublicJob: async () => job,
    findExistingApplication: (jobId, candidateId) =>
      prisma.application.findFirst({
        where: { jobId, candidateId },
        select: { id: true },
      }),
    findCandidateCv: (cvId, candidateId) => loadCvInput(cvId, candidateId),
    createApplication: async (data) => {
      // job chắc chắn non-null ở đây (runApply chỉ gọi createApplication sau
      // khi findPublicJob trả về truthy).
      const rawText = job!.rawText;

      // Tính điểm CHÍNH THỨC ở server (không tin điểm client). AI gọi NGOÀI
      // transaction; lỗi AI -> đơn vẫn nộp, evaluationId = null.
      let evalData: {
        overallScore: number;
        strengths: unknown;
        weaknesses: unknown;
        matchedKeywords: unknown;
        missingKeywords: unknown;
        skillGaps: unknown;
        summary: string;
        rawModelOutput: unknown;
      } | null = null;
      try {
        const result = await requestEvaluation(
          buildEvaluationPrompt(data.cvSnapshot, rawText),
        );
        evalData = {
          overallScore: result.overallScore,
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          matchedKeywords: result.matchedKeywords,
          missingKeywords: result.missingKeywords,
          skillGaps: result.skillGaps,
          summary: result.summary,
          rawModelOutput: result,
        };
      } catch {
        evalData = null;
      }

      const appId = await prisma.$transaction(async (tx) => {
        let evaluationId: string | null = null;
        if (evalData) {
          const ev = await tx.evaluation.create({
            data: {
              cvId: data.cvId,
              jobDescriptionId: data.jobId,
              userId: data.candidateId,
              overallScore: evalData.overallScore,
              strengths: evalData.strengths,
              weaknesses: evalData.weaknesses,
              matchedKeywords: evalData.matchedKeywords,
              missingKeywords: evalData.missingKeywords,
              skillGaps: evalData.skillGaps,
              summary: evalData.summary,
              rawModelOutput: evalData.rawModelOutput,
            },
            select: { id: true },
          });
          evaluationId = ev.id;
        }
        const app = await tx.application.create({
          data: {
            jobId: data.jobId,
            candidateId: data.candidateId,
            cvId: data.cvId,
            cvSnapshot: data.cvSnapshot,
            coverLetter: data.coverLetter,
            evaluationId,
            events: { create: { toStatus: "SUBMITTED" } },
          },
          select: { id: true },
        });
        return app.id;
      });

      return { id: appId };
    },
  };

  const outcome = await runApply(
    {
      jobId: input.jobId,
      candidateId: userId,
      cvId: input.cvId,
      coverLetter: parsed.data.coverLetter,
    },
    deps,
  );

  if (outcome.ok) {
    revalidatePath("/applications");
    revalidatePath(`/jobs/${input.jobId}`);
  }
  return outcome;
}
```

- [ ] **Step 3: Thay `withdrawApplication` (chuyển WITHDRAWN thay vì xoá)**

Thay toàn bộ hàm `withdrawApplication` bằng:
```ts
export async function withdrawApplication(
  applicationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới được rút đơn" };

  const app = await prisma.application.findFirst({
    where: { id: applicationId, candidateId: userId },
    select: { id: true, status: true },
  });
  if (!app) return { ok: false, error: "Không tìm thấy đơn ứng tuyển" };
  if (!canWithdraw(app.status))
    return { ok: false, error: "Không thể rút đơn ở trạng thái này" };

  await prisma.$transaction([
    prisma.application.update({
      where: { id: app.id },
      data: { status: "WITHDRAWN" },
    }),
    prisma.applicationEvent.create({
      data: {
        applicationId: app.id,
        fromStatus: app.status,
        toStatus: "WITHDRAWN",
      },
    }),
  ]);
  revalidatePath("/applications");
  return { ok: true };
}
```

- [ ] **Step 4: Cập nhật `ApplyForm.tsx` khớp chữ ký mới (cùng task để tsc sạch)**

Vì `previewMatch`/`submitApplication` vừa đổi chữ ký, phải cập nhật client ngay trong task này. Thay toàn bộ `app/jobs/[id]/apply/ApplyForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { previewMatch, submitApplication } from "@/lib/applications/actions";

export default function ApplyForm({
  jobId,
  cvs,
}: {
  jobId: string;
  cvs: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [cvId, setCvId] = useState(cvs[0]?.id ?? "");
  const [coverLetter, setCoverLetter] = useState("");
  const [match, setMatch] = useState<{ score: number; summary: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onPreview() {
    if (!cvId) return;
    setPreviewing(true);
    setMatch(null);
    const r = await previewMatch(jobId, cvId);
    if (r.ok) {
      setMatch({ score: r.score, summary: r.summary });
    } else {
      toast.error(r.error);
    }
    setPreviewing(false);
  }

  async function onSubmit() {
    if (!cvId) return;
    setSubmitting(true);
    const r = await submitApplication({ jobId, cvId, coverLetter });
    if (r.ok) {
      toast.success("Đã nộp đơn ứng tuyển");
      router.push("/applications");
    } else {
      toast.error(r.error);
      setSubmitting(false);
    }
  }

  if (cvs.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Bạn chưa có CV nào. Hãy tạo CV trước ở dashboard rồi quay lại ứng tuyển.
      </p>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-blue-700">Ứng tuyển</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="text-sm font-medium text-slate-700">Chọn CV để nộp</label>
        <select
          value={cvId}
          onChange={(e) => {
            setCvId(e.target.value);
            setMatch(null);
          }}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          {cvs.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        <div>
          <Button variant="outline" onClick={onPreview} disabled={previewing || !cvId}>
            {previewing ? "Đang tính điểm..." : "Xem điểm phù hợp"}
          </Button>
        </div>
        {match && (
          <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm">
            <p className="font-semibold text-blue-700">Điểm phù hợp: {match.score}/100</p>
            <p className="mt-1 text-slate-700">{match.summary}</p>
            <p className="mt-1 text-xs text-slate-400">Điểm chính thức sẽ được tính lại khi bạn nộp đơn.</p>
          </div>
        )}

        <label className="text-sm font-medium text-slate-700">Thư giới thiệu (không bắt buộc)</label>
        <textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          rows={5}
          maxLength={3000}
          placeholder="Vài dòng giới thiệu bản thân và lý do phù hợp..."
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        />

        <Button onClick={onSubmit} disabled={submitting || !cvId} className="justify-self-start">
          {submitting ? "Đang nộp..." : "Nộp đơn"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi (actions + ApplyForm đã đồng bộ chữ ký).

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit (cả hai file trong một commit)**

```bash
git add lib/applications/actions.ts app/jobs/[id]/apply/ApplyForm.tsx
git commit -m "feat(applications): preview no-persist, server-computed eval on submit, soft withdraw"
```

---

### Task 5: CvView + trang chi tiết ứng viên (NTD)

**Files:**
- Create: `components/CvView.tsx`
- Create: `app/jobs/[id]/applicants/[appId]/page.tsx`

**Interfaces:**
- Consumes: `CvInput` (`@/lib/cv/types`), `STATUS_LABELS` + `ApplicationStatus` (`@/lib/applications/status`).
- Produces: `CvView({ cv }: { cv: CvInput })` (default export).

- [ ] **Step 1: Tạo `components/CvView.tsx`**

```tsx
import type { CvInput } from "@/lib/cv/types";

export default function CvView({ cv }: { cv: CvInput }) {
  const p = cv.profile;
  return (
    <div className="grid gap-4 text-sm text-slate-700">
      <div>
        <p className="text-lg font-semibold text-slate-900">{p.fullName || "(chưa có tên)"}</p>
        {p.headline && <p className="text-slate-500">{p.headline}</p>}
        <p className="text-xs text-slate-400">
          {[p.email, p.phone].filter(Boolean).join(" · ")}
        </p>
        {p.summary && <p className="mt-2 whitespace-pre-wrap">{p.summary}</p>}
      </div>

      {cv.experiences.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold text-blue-700">Kinh nghiệm</h3>
          <div className="grid gap-2">
            {cv.experiences.map((e, i) => (
              <div key={i}>
                <p className="font-medium text-slate-800">
                  {e.position} — {e.company}
                </p>
                <p className="text-xs text-slate-400">
                  {[e.startDate, e.endDate].filter(Boolean).join(" – ")}
                </p>
                {e.description && <p className="whitespace-pre-wrap">{e.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {cv.educations.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold text-blue-700">Học vấn</h3>
          <div className="grid gap-2">
            {cv.educations.map((e, i) => (
              <div key={i}>
                <p className="font-medium text-slate-800">
                  {e.school}{e.major ? ` — ${e.major}` : ""}
                </p>
                <p className="text-xs text-slate-400">
                  {[e.startDate, e.endDate].filter(Boolean).join(" – ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {cv.skills.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold text-blue-700">Kỹ năng</h3>
          <p>
            {cv.skills
              .map((s) => (s.level ? `${s.name} (${s.level})` : s.name))
              .join(", ")}
          </p>
        </section>
      )}

      {cv.projects.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold text-blue-700">Dự án</h3>
          <div className="grid gap-2">
            {cv.projects.map((pr, i) => (
              <div key={i}>
                <p className="font-medium text-slate-800">
                  {pr.name}{pr.tech ? ` · ${pr.tech}` : ""}
                </p>
                {pr.description && <p className="whitespace-pre-wrap">{pr.description}</p>}
                {pr.link && (
                  <a href={pr.link} className="text-xs text-blue-600 hover:underline">
                    {pr.link}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tạo `app/jobs/[id]/applicants/[appId]/page.tsx`**

```tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import CvView from "@/components/CvView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/status";
import type { CvInput } from "@/lib/cv/types";

export const dynamic = "force-dynamic";

export default async function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string; appId: string }>;
}) {
  const { id, appId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect(`/jobs/${id}`);

  const app = await prisma.application.findFirst({
    where: { id: appId, jobId: id, job: { userId: session.user.id } },
    select: {
      id: true,
      status: true,
      coverLetter: true,
      cvSnapshot: true,
      candidate: { select: { name: true } },
      evaluation: { select: { overallScore: true, summary: true } },
      events: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      },
    },
  });
  if (!app) notFound();

  const cv = app.cvSnapshot as unknown as CvInput;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href={`/jobs/${id}/applicants`} className="text-sm text-blue-600 hover:underline">
          ← Về danh sách ứng viên
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-blue-700">{app.candidate.name}</h1>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {STATUS_LABELS[app.status as ApplicationStatus]}
          </span>
        </div>

        {app.evaluation && (
          <Card className="mt-3">
            <CardHeader><CardTitle className="text-blue-700">Điểm phù hợp AI</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-700">
              <p className="font-semibold">{app.evaluation.overallScore}/100</p>
              {app.evaluation.summary && <p className="mt-1">{app.evaluation.summary}</p>}
            </CardContent>
          </Card>
        )}

        {app.coverLetter && (
          <Card className="mt-3">
            <CardHeader><CardTitle className="text-blue-700">Thư giới thiệu</CardTitle></CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm text-slate-700">
              {app.coverLetter}
            </CardContent>
          </Card>
        )}

        <Card className="mt-3">
          <CardHeader><CardTitle className="text-blue-700">CV đã nộp</CardTitle></CardHeader>
          <CardContent><CvView cv={cv} /></CardContent>
        </Card>

        <Card className="mt-3">
          <CardHeader><CardTitle className="text-blue-700">Lịch sử trạng thái</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-1 text-xs text-slate-500">
            {app.events.map((e, i) => (
              <span key={i}>
                {STATUS_LABELS[e.toStatus as ApplicationStatus]}
                {i < app.events.length - 1 ? " → " : ""}
              </span>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 4: Commit**

```bash
git add components/CvView.tsx "app/jobs/[id]/applicants/[appId]/page.tsx"
git commit -m "feat(applications): recruiter applicant detail page with CvView"
```

---

### Task 6: Board — cột từ BOARD_STATUSES, mục "Đã rút", link chi tiết

**Files:**
- Modify: `app/jobs/[id]/applicants/ApplicantsBoard.tsx`
- Modify: `app/jobs/[id]/applicants/page.tsx`

**Interfaces:**
- Consumes: `BOARD_STATUSES`, `STATUS_LABELS`, `ApplicationStatus` (`@/lib/applications/status`), `changeStatus`.
- `ApplicantsBoard` nhận thêm prop `jobId: string`.

- [ ] **Step 1: Thay toàn bộ `app/jobs/[id]/applicants/ApplicantsBoard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  BOARD_STATUSES,
  STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/applications/status";
import { changeStatus } from "@/lib/applications/actions";

export type ApplicantCard = {
  id: string;
  status: ApplicationStatus;
  candidateName: string;
  score: number | null;
  coverLetter: string;
};

export default function ApplicantsBoard({
  jobId,
  initial,
}: {
  jobId: string;
  initial: ApplicantCard[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);

  async function onDrop(status: ApplicationStatus) {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) return;

    const prev = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    const r = await changeStatus(id, status, "");
    if (r.ok) {
      toast.success(`Đã chuyển sang "${STATUS_LABELS[status]}"`);
      router.refresh();
    } else {
      setCards(prev);
      toast.error(r.error);
    }
  }

  const withdrawn = cards.filter((c) => c.status === "WITHDRAWN");

  return (
    <>
      <div className="mt-4 grid grid-flow-col gap-3 overflow-x-auto pb-2 [grid-auto-columns:minmax(220px,1fr)]">
        {BOARD_STATUSES.map((status) => {
          const col = cards.filter((c) => c.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(status)}
              className="rounded-lg border border-slate-200 bg-white p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-blue-700">{STATUS_LABELS[status]}</span>
                <span className="text-xs text-slate-400">{col.length}</span>
              </div>
              <div className="grid gap-2">
                {col.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    className="cursor-grab rounded-md border border-slate-200 bg-slate-50 p-2 text-sm active:cursor-grabbing"
                  >
                    <p className="font-medium text-slate-800">{c.candidateName}</p>
                    {c.score !== null && (
                      <p className="text-xs text-blue-600">Điểm phù hợp: {c.score}/100</p>
                    )}
                    {c.coverLetter && (
                      <p className="mt-1 line-clamp-3 text-xs text-slate-500">{c.coverLetter}</p>
                    )}
                    <Link
                      href={`/jobs/${jobId}/applicants/${c.id}`}
                      draggable={false}
                      className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                    >
                      Xem chi tiết →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {withdrawn.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-sm font-semibold text-slate-500">
            Đã rút ({withdrawn.length})
          </p>
          <div className="grid gap-1">
            {withdrawn.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm text-slate-500">
                <span>{c.candidateName}</span>
                <Link
                  href={`/jobs/${jobId}/applicants/${c.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Xem chi tiết →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Sửa `app/jobs/[id]/applicants/page.tsx` — truyền `jobId`**

Đổi phần render board (dòng ~58-62) thành:
```tsx
        {initial.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Chưa có ai ứng tuyển tin này.</p>
        ) : (
          <ApplicantsBoard jobId={id} initial={initial} />
        )}
```
(Phần query và mapping `initial` giữ nguyên — đã lấy đủ mọi trạng thái, gồm cả WITHDRAWN.)

- [ ] **Step 3: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 4: Kiểm tra thủ công (cho người dùng)**

Chạy `npm run dev`: (a) ứng viên nộp đơn → điểm hiển thị ở board NTD; (b) ứng viên rút đơn → biến khỏi 6 cột, xuất hiện ở mục "Đã rút", trang "Ứng tuyển của tôi" hiện "Đã rút" không còn nút rút; (c) NTD bấm "Xem chi tiết" trên thẻ → trang chi tiết hiển thị CV đã nộp + cover letter + điểm + timeline; (d) kéo thẻ vẫn đổi trạng thái bình thường.

- [ ] **Step 5: Commit**

```bash
git add "app/jobs/[id]/applicants/ApplicantsBoard.tsx" "app/jobs/[id]/applicants/page.tsx"
git commit -m "feat(applications): board uses BOARD_STATUSES, withdrawn section, detail links"
```

---

## Self-Review (đã thực hiện)

- **Bao phủ spec:** §2 WITHDRAWN mềm → Task 1 (enum) + 2 (status/board/canTransition) + 4 (withdraw) + 6 (board section) + trang "Ứng tuyển của tôi" tự hoạt động nhờ nhãn mới (không cần sửa). §3 preview không ghi + tính điểm lúc nộp → Task 4 (preview/submit + form) + 3 (bỏ evaluationId khỏi core). §4 trang chi tiết + CvView → Task 5, link từ board → Task 6. §5 phân quyền → gate trong Task 4/5. §6 kiểm thử → Task 2/3 (TDD thuần). §7 ranh giới → không thêm cột WITHDRAWN, không dọn dữ liệu cũ, CvView read-only.
- **Placeholder:** không còn TBD/TODO; mọi bước có code hoặc lệnh cụ thể. `actions.ts` + `ApplyForm.tsx` ghép chung Task 4 nên mọi commit đều xanh tsc.
- **Nhất quán kiểu:** `APPLICATION_STATUSES`(7)/`BOARD_STATUSES`(6)/`canTransition`/`STATUS_LABELS` (Task 2) dùng ở Task 4/5/6; `ApplyParams`/`CreateApplicationData` bỏ `evaluationId` (Task 3) khớp `submitApplication` (Task 4); `previewMatch`→`{score,summary}` và `submitApplication({jobId,cvId,coverLetter})` khớp `ApplyForm` (cùng Task 4); `ApplicantCard` + prop `jobId` (Task 6); `CvView({cv})` (Task 5).
```
