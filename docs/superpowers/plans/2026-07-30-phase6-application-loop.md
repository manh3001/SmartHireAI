# Vòng ứng tuyển (Phase 6 — Gói A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây vòng ứng tuyển nối ứng viên và nhà tuyển dụng: ứng viên nộp CV vào tin tuyển dụng (xem điểm match AI + cover letter), NTD quản lý ứng viên qua board 6 trạng thái.

**Architecture:** Giữ `JobDescription` làm entity tin tuyển dụng; thêm `Application` + `ApplicationEvent`. Logic cốt lõi (chuyển trạng thái, nộp đơn) tách thành hàm thuần nhận dependency (giống `runCvEvaluation` sẵn có) để test không cần DB. Server actions là lớp mỏng nối Prisma + `auth()`. UI theo Tailwind + component `@/components/ui` sẵn có. Board kéo-thả dùng HTML5 Drag-and-Drop gốc, không thêm thư viện.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 + PostgreSQL (Neon), Auth.js, Zod 4, Vitest, Tailwind 4, AI qua OpenAI-compat client (Gemini) sẵn có.

## Global Constraints

- **Next.js là bản có breaking changes.** Trước khi viết code Next.js (route, server action, page), đọc guide liên quan trong `node_modules/next/dist/docs/`. (AGENTS.md)
- **Prisma giữ v6**, không nâng v7. (memory: prisma-pinned-v6)
- **AI provider: Gemini** qua OpenAI-compat client `@/lib/ai/client` (`getAiClient`, `AI_MODEL`) — không đổi provider.
- **Đẩy schema DB bằng** `npm run db:push` (đã bọc `NODE_OPTIONS=--dns-result-order=ipv4first` để tránh lỗi Neon IPv6). Không chạy `prisma db push` trần.
- **Chạy test:** `npm test` (vitest run). Toàn bộ UI copy bằng **tiếng Việt**.
- **Server actions** dùng `auth()` từ `@/auth` và `prisma` từ `@/lib/db/prisma`; kiểm tra `session.user.id` và `session.user.role`.
- **Palette:** blue-700 tiêu đề, slate-50 nền, dùng `Card`/`Button`/`Badge`-style hiện có.

---

## File Structure

**Tạo mới:**
- `lib/applications/status.ts` — hằng trạng thái, nhãn tiếng Việt, luật chuyển trạng thái, `canWithdraw`.
- `lib/applications/schema.ts` — Zod schema form ứng tuyển.
- `lib/applications/apply.ts` — core `runApply` (DI) nộp đơn.
- `lib/applications/transition.ts` — core `runChangeStatus` (DI) đổi trạng thái.
- `lib/applications/actions.ts` — server actions: `previewMatch`, `submitApplication`, `withdrawApplication`, `changeStatus`.
- `lib/cv/load.ts` — `loadCvInput(cvId, userId)`: nạp CV thành `CvInput` (rút từ route đánh giá, dùng chung).
- `lib/ai/request-evaluation.ts` — `requestEvaluation(prompt)`: gọi AI trả `EvaluationResult` (rút từ route đánh giá, dùng chung).
- `app/jobs/[id]/apply/page.tsx` — trang form ứng tuyển (server) + `ApplyForm.tsx` (client).
- `app/jobs/[id]/apply/ApplyForm.tsx` — client component form.
- `app/jobs/[id]/applicants/page.tsx` — trang board NTD (server) + `ApplicantsBoard.tsx` (client).
- `app/jobs/[id]/applicants/ApplicantsBoard.tsx` — client board kéo-thả.
- `app/applications/page.tsx` — "Ứng tuyển của tôi" (server) + `WithdrawButton.tsx` (client).
- `app/applications/WithdrawButton.tsx` — nút rút đơn (client).
- Test: `lib/applications/__tests__/{status,schema,apply,transition}.test.ts`.

**Sửa:**
- `prisma/schema.prisma` — thêm `Application`, `ApplicationEvent`, enum `ApplicationStatus`, quan hệ ngược.
- `app/api/cv/[id]/evaluate/route.ts` — dùng `loadCvInput` + `requestEvaluation` chung (DRY).
- `app/jobs/[id]/page.tsx` — thêm nút "Ứng tuyển" (ứng viên) / link "Xem ứng viên" (NTD chủ tin).

---

### Task 1: Schema Prisma cho Application

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: models `Application`, `ApplicationEvent`, enum `ApplicationStatus`. Quan hệ: `User.applications`, `CV.applications`, `JobDescription.applications`, `Evaluation.application?`.

- [ ] **Step 1: Thêm enum + models vào cuối `prisma/schema.prisma`**

```prisma
enum ApplicationStatus {
  SUBMITTED
  SCREENING
  INTERVIEW
  OFFER
  HIRED
  REJECTED
}

model Application {
  id           String            @id @default(cuid())
  jobId        String
  job          JobDescription    @relation(fields: [jobId], references: [id], onDelete: Cascade)
  candidateId  String
  candidate    User              @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  cvId         String
  cv           CV                @relation(fields: [cvId], references: [id], onDelete: Cascade)
  cvSnapshot   Json
  coverLetter  String            @default("")
  status       ApplicationStatus @default(SUBMITTED)
  evaluationId String?           @unique
  evaluation   Evaluation?       @relation(fields: [evaluationId], references: [id], onDelete: SetNull)
  events       ApplicationEvent[]
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  @@unique([jobId, candidateId])
}

model ApplicationEvent {
  id            String            @id @default(cuid())
  applicationId String
  application   Application       @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  fromStatus    ApplicationStatus?
  toStatus      ApplicationStatus
  note          String            @default("")
  createdAt     DateTime          @default(now())
}
```

- [ ] **Step 2: Thêm quan hệ ngược vào các model sẵn có**

Trong `model User { ... }` thêm dòng:
```prisma
  applications    Application[]
```
Trong `model CV { ... }` thêm dòng:
```prisma
  applications Application[]
```
Trong `model JobDescription { ... }` thêm dòng:
```prisma
  applications Application[]
```
Trong `model Evaluation { ... }` thêm dòng:
```prisma
  application Application?
```

- [ ] **Step 3: Validate schema**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 4: Đẩy schema lên DB + generate client**

Run: `npm run db:push`
Expected: kết thúc `Your database is now in sync with your Prisma schema.` và `Generated Prisma Client`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add Application and ApplicationEvent models"
```

---

### Task 2: Logic trạng thái (thuần) + test

**Files:**
- Create: `lib/applications/status.ts`
- Test: `lib/applications/__tests__/status.test.ts`

**Interfaces:**
- Produces:
  - `APPLICATION_STATUSES: readonly ApplicationStatus[]`
  - `type ApplicationStatus = "SUBMITTED" | "SCREENING" | "INTERVIEW" | "OFFER" | "HIRED" | "REJECTED"`
  - `STATUS_LABELS: Record<ApplicationStatus, string>`
  - `canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean`
  - `canWithdraw(status: ApplicationStatus): boolean`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/applications/__tests__/status.test.ts
import { describe, it, expect } from "vitest";
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  canTransition,
  canWithdraw,
} from "../status";

describe("status", () => {
  it("có đủ 6 trạng thái với nhãn tiếng Việt", () => {
    expect(APPLICATION_STATUSES).toHaveLength(6);
    expect(STATUS_LABELS.SUBMITTED).toBe("Đã nộp");
    expect(STATUS_LABELS.HIRED).toBe("Nhận");
  });

  it("không cho chuyển về cùng trạng thái", () => {
    expect(canTransition("SCREENING", "SCREENING")).toBe(false);
  });

  it("không cho chuyển ngược về SUBMITTED", () => {
    expect(canTransition("SCREENING", "SUBMITTED")).toBe(false);
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

Run: `npm test -- status`
Expected: FAIL — không import được `../status`.

- [ ] **Step 3: Viết `lib/applications/status.ts`**

```ts
export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: "Đã nộp",
  SCREENING: "Đang sàng lọc",
  INTERVIEW: "Phỏng vấn",
  OFFER: "Offer",
  HIRED: "Nhận",
  REJECTED: "Từ chối",
};

// NTD kéo thẻ giữa các cột tự do, trừ hai luật:
// - không chuyển về chính nó
// - không kéo ngược về SUBMITTED (trạng thái khởi tạo)
export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  if (from === to) return false;
  if (to === "SUBMITTED") return false;
  return true;
}

export function canWithdraw(status: ApplicationStatus): boolean {
  return status === "SUBMITTED" || status === "SCREENING";
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- status`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/applications/status.ts lib/applications/__tests__/status.test.ts
git commit -m "feat(applications): status labels and transition rules"
```

---

### Task 3: Zod schema form ứng tuyển + test

**Files:**
- Create: `lib/applications/schema.ts`
- Test: `lib/applications/__tests__/schema.test.ts`

**Interfaces:**
- Produces:
  - `applySchema` (Zod)
  - `type ApplyInput = { cvId: string; coverLetter: string }`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/applications/__tests__/schema.test.ts
import { describe, it, expect } from "vitest";
import { applySchema } from "../schema";

describe("applySchema", () => {
  it("chấp nhận cvId hợp lệ, coverLetter rỗng", () => {
    const r = applySchema.safeParse({ cvId: "cv_1", coverLetter: "" });
    expect(r.success).toBe(true);
  });

  it("từ chối khi thiếu cvId", () => {
    const r = applySchema.safeParse({ cvId: "", coverLetter: "hi" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Vui lòng chọn CV");
  });

  it("từ chối cover letter quá dài", () => {
    const r = applySchema.safeParse({ cvId: "cv_1", coverLetter: "x".repeat(3001) });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- applications/__tests__/schema`
Expected: FAIL — không import được `../schema`.

- [ ] **Step 3: Viết `lib/applications/schema.ts`**

```ts
import { z } from "zod";

export const applySchema = z.object({
  cvId: z.string().min(1, "Vui lòng chọn CV"),
  coverLetter: z.string().max(3000, "Thư giới thiệu tối đa 3000 ký tự"),
});

export type ApplyInput = z.infer<typeof applySchema>;
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- applications/__tests__/schema`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/applications/schema.ts lib/applications/__tests__/schema.test.ts
git commit -m "feat(applications): zod schema for apply form"
```

---

### Task 4: Rút hàm dùng chung — nạp CV & gọi AI (DRY)

**Files:**
- Create: `lib/cv/load.ts`
- Create: `lib/ai/request-evaluation.ts`
- Modify: `app/api/cv/[id]/evaluate/route.ts`

**Interfaces:**
- Produces:
  - `loadCvInput(cvId: string, userId: string): Promise<CvInput | null>`
  - `requestEvaluation(prompt: string): Promise<EvaluationResult>`
- Consumes: `prisma`, `CvInput` (`@/lib/cv/types`), `getAiClient`, `AI_MODEL`, `SYSTEM_PROMPT`, `evaluationResultSchema`, `EvaluationResult`.

Đây là task refactor: an toàn được bảo đảm bằng bộ test hiện có vẫn xanh + typecheck, không thêm test mới.

- [ ] **Step 1: Tạo `lib/cv/load.ts` (rút nguyên logic `findCv` từ route)**

```ts
import prisma from "@/lib/db/prisma";
import type { CvInput } from "./types";

export async function loadCvInput(
  cvId: string,
  userId: string,
): Promise<CvInput | null> {
  const cv = await prisma.cV.findFirst({
    where: { id: cvId, userId },
    include: {
      profile: true,
      experiences: { orderBy: { order: "asc" } },
      educations: { orderBy: { order: "asc" } },
      skills: { orderBy: { order: "asc" } },
      projects: { orderBy: { order: "asc" } },
    },
  });
  if (!cv) return null;
  return {
    title: cv.title,
    profile: {
      fullName: cv.profile?.fullName ?? "",
      headline: cv.profile?.headline ?? "",
      email: cv.profile?.email ?? "",
      phone: cv.profile?.phone ?? "",
      summary: cv.profile?.summary ?? "",
    },
    experiences: cv.experiences.map((e) => ({
      company: e.company,
      position: e.position,
      startDate: e.startDate,
      endDate: e.endDate,
      description: e.description,
    })),
    educations: cv.educations.map((e) => ({
      school: e.school,
      major: e.major,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
    skills: cv.skills.map((s) => ({ name: s.name, level: s.level })),
    projects: cv.projects.map((p) => ({
      name: p.name,
      description: p.description,
      tech: p.tech,
      link: p.link,
    })),
  };
}
```

- [ ] **Step 2: Tạo `lib/ai/request-evaluation.ts` (rút từ route)**

```ts
import { zodResponseFormat } from "openai/helpers/zod";
import { getAiClient, AI_MODEL } from "./client";
import { SYSTEM_PROMPT } from "./prompt";
import { evaluationResultSchema, type EvaluationResult } from "./schema";

export async function requestEvaluation(
  prompt: string,
): Promise<EvaluationResult> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(evaluationResultSchema, "evaluation"),
  });
  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("Model không trả về kết quả hợp lệ");
  }
  return parsed;
}
```

- [ ] **Step 3: Sửa route dùng hàm chung**

Trong `app/api/cv/[id]/evaluate/route.ts`:

Thêm import (cạnh các import hiện có):
```ts
import { loadCvInput } from "@/lib/cv/load";
import { requestEvaluation } from "@/lib/ai/request-evaluation";
```

Xoá đoạn khai báo `async function requestEvaluation(...) { ... }` (dòng ~16-31) và các import chỉ phục vụ nó nếu không còn dùng: bỏ `import { zodResponseFormat } from "openai/helpers/zod";`, `import { getAiClient, AI_MODEL } from "@/lib/ai/client";`, `import { SYSTEM_PROMPT } from "@/lib/ai/prompt";`. Giữ `import { evaluationResultSchema, type EvaluationResult } from "@/lib/ai/schema";`? — không còn dùng `EvaluationResult`/`evaluationResultSchema` trong route sau khi rút; xoá luôn import đó.

Thay toàn bộ hàm `findCv` trong `deps` bằng:
```ts
    findCv: (cvId, uid) => loadCvInput(cvId, uid),
```

- [ ] **Step 4: Chạy toàn bộ test + typecheck**

Run: `npm test`
Expected: PASS toàn bộ (bộ test evaluate hiện có vẫn xanh).

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add lib/cv/load.ts lib/ai/request-evaluation.ts app/api/cv/[id]/evaluate/route.ts
git commit -m "refactor(ai): extract loadCvInput and requestEvaluation for reuse"
```

---

### Task 5: Core nộp đơn `runApply` (DI) + test

**Files:**
- Create: `lib/applications/apply.ts`
- Test: `lib/applications/__tests__/apply.test.ts`

**Interfaces:**
- Consumes: `CvInput` (`@/lib/cv/types`).
- Produces:
  - `type ApplyParams = { jobId: string; candidateId: string; cvId: string; coverLetter: string; evaluationId: string | null }`
  - `type CreateApplicationData = { jobId: string; candidateId: string; cvId: string; cvSnapshot: CvInput; coverLetter: string; evaluationId: string | null }`
  - `type ApplyDeps = { findPublicJob; findExistingApplication; findCandidateCv; createApplication }`
  - `type ApplyOutcome = { ok: true; applicationId: string } | { ok: false; error: string }`
  - `runApply(params: ApplyParams, deps: ApplyDeps): Promise<ApplyOutcome>`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/applications/__tests__/apply.test.ts
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
  evaluationId: "ev_1",
};

describe("runApply", () => {
  it("nộp đơn thành công và chụp snapshot CV", async () => {
    const d = deps();
    const r = await runApply(params, d);
    expect(r).toEqual({ ok: true, applicationId: "app_1" });
    expect(d.createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ cvSnapshot: cv, evaluationId: "ev_1" }),
    );
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
Expected: FAIL — không import được `../apply`.

- [ ] **Step 3: Viết `lib/applications/apply.ts`**

```ts
import type { CvInput } from "@/lib/cv/types";

export type ApplyParams = {
  jobId: string;
  candidateId: string;
  cvId: string;
  coverLetter: string;
  evaluationId: string | null;
};

export type CreateApplicationData = {
  jobId: string;
  candidateId: string;
  cvId: string;
  cvSnapshot: CvInput;
  coverLetter: string;
  evaluationId: string | null;
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
    evaluationId: params.evaluationId,
  });
  return { ok: true, applicationId: created.id };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- applications/__tests__/apply`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/applications/apply.ts lib/applications/__tests__/apply.test.ts
git commit -m "feat(applications): runApply core with duplicate + snapshot logic"
```

---

### Task 6: Core đổi trạng thái `runChangeStatus` (DI) + test

**Files:**
- Create: `lib/applications/transition.ts`
- Test: `lib/applications/__tests__/transition.test.ts`

**Interfaces:**
- Consumes: `ApplicationStatus`, `canTransition` (`./status`).
- Produces:
  - `type ChangeStatusParams = { applicationId: string; recruiterId: string; toStatus: ApplicationStatus; note: string }`
  - `type ChangeStatusDeps = { findApplicationForRecruiter; applyStatusChange }`
  - `type ChangeStatusOutcome = { ok: true } | { ok: false; error: string }`
  - `runChangeStatus(params, deps): Promise<ChangeStatusOutcome>`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/applications/__tests__/transition.test.ts
import { describe, it, expect, vi } from "vitest";
import { runChangeStatus, type ChangeStatusDeps } from "../transition";

function deps(over: Partial<ChangeStatusDeps> = {}): ChangeStatusDeps {
  return {
    findApplicationForRecruiter: vi
      .fn()
      .mockResolvedValue({ id: "app_1", status: "SUBMITTED" }),
    applyStatusChange: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

const params = {
  applicationId: "app_1",
  recruiterId: "r_1",
  toStatus: "SCREENING" as const,
  note: "",
};

describe("runChangeStatus", () => {
  it("đổi trạng thái hợp lệ và ghi event", async () => {
    const d = deps();
    const r = await runChangeStatus(params, d);
    expect(r).toEqual({ ok: true });
    expect(d.applyStatusChange).toHaveBeenCalledWith({
      applicationId: "app_1",
      fromStatus: "SUBMITTED",
      toStatus: "SCREENING",
      note: "",
    });
  });

  it("từ chối khi không phải chủ tin (không tìm thấy đơn)", async () => {
    const r = await runChangeStatus(
      params,
      deps({ findApplicationForRecruiter: vi.fn().mockResolvedValue(null) }),
    );
    expect(r).toEqual({ ok: false, error: "Không tìm thấy đơn ứng tuyển" });
  });

  it("từ chối chuyển trạng thái không hợp lệ", async () => {
    const d = deps({
      findApplicationForRecruiter: vi
        .fn()
        .mockResolvedValue({ id: "app_1", status: "SCREENING" }),
    });
    const r = await runChangeStatus(
      { ...params, toStatus: "SUBMITTED" },
      d,
    );
    expect(r).toEqual({ ok: false, error: "Không thể chuyển sang trạng thái này" });
    expect(d.applyStatusChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- applications/__tests__/transition`
Expected: FAIL — không import được `../transition`.

- [ ] **Step 3: Viết `lib/applications/transition.ts`**

```ts
import { canTransition, type ApplicationStatus } from "./status";

export type ChangeStatusParams = {
  applicationId: string;
  recruiterId: string;
  toStatus: ApplicationStatus;
  note: string;
};

export type ChangeStatusDeps = {
  findApplicationForRecruiter: (
    applicationId: string,
    recruiterId: string,
  ) => Promise<{ id: string; status: ApplicationStatus } | null>;
  applyStatusChange: (data: {
    applicationId: string;
    fromStatus: ApplicationStatus;
    toStatus: ApplicationStatus;
    note: string;
  }) => Promise<void>;
};

export type ChangeStatusOutcome =
  | { ok: true }
  | { ok: false; error: string };

export async function runChangeStatus(
  params: ChangeStatusParams,
  deps: ChangeStatusDeps,
): Promise<ChangeStatusOutcome> {
  const app = await deps.findApplicationForRecruiter(
    params.applicationId,
    params.recruiterId,
  );
  if (!app) return { ok: false, error: "Không tìm thấy đơn ứng tuyển" };

  if (!canTransition(app.status, params.toStatus)) {
    return { ok: false, error: "Không thể chuyển sang trạng thái này" };
  }

  await deps.applyStatusChange({
    applicationId: app.id,
    fromStatus: app.status,
    toStatus: params.toStatus,
    note: params.note,
  });
  return { ok: true };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- applications/__tests__/transition`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/applications/transition.ts lib/applications/__tests__/transition.test.ts
git commit -m "feat(applications): runChangeStatus core with authorization"
```

---

### Task 7: Server actions ứng tuyển

**Files:**
- Create: `lib/applications/actions.ts`

**Interfaces:**
- Consumes: `runApply`/`ApplyDeps` (`./apply`), `runChangeStatus`/`ChangeStatusDeps` (`./transition`), `canWithdraw`/`ApplicationStatus` (`./status`), `applySchema` (`./schema`), `loadCvInput` (`@/lib/cv/load`), `requestEvaluation` (`@/lib/ai/request-evaluation`), `buildEvaluationPrompt` (`@/lib/ai/prompt`), `createRateLimiter` (`@/lib/ai/rate-limit`), `prisma`, `auth`.
- Produces (server actions gọi từ client):
  - `previewMatch(jobId: string, cvId: string): Promise<{ ok: true; evaluationId: string; score: number; summary: string } | { ok: false; error: string }>`
  - `submitApplication(input: { jobId: string; cvId: string; coverLetter: string; evaluationId: string | null }): Promise<{ ok: true; applicationId: string } | { ok: false; error: string }>`
  - `withdrawApplication(applicationId: string): Promise<{ ok: true } | { ok: false; error: string }>`
  - `changeStatus(applicationId: string, toStatus: ApplicationStatus, note: string): Promise<{ ok: true } | { ok: false; error: string }>`

Task glue: an toàn bằng typecheck + core tests đã có. Không viết unit test cho lớp Prisma này (khó mock sạch, đúng chuẩn dự án chỉ unit-test hàm thuần).

- [ ] **Step 1: Viết `lib/applications/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { applySchema } from "./schema";
import { canWithdraw, type ApplicationStatus } from "./status";
import { runApply, type ApplyDeps } from "./apply";
import { runChangeStatus, type ChangeStatusDeps } from "./transition";
import { loadCvInput } from "@/lib/cv/load";
import { requestEvaluation } from "@/lib/ai/request-evaluation";
import { buildEvaluationPrompt } from "@/lib/ai/prompt";
import { createRateLimiter } from "@/lib/ai/rate-limit";

const previewLimiter = createRateLimiter({ max: 5, windowMs: 60000 });

export async function previewMatch(
  jobId: string,
  cvId: string,
): Promise<
  | { ok: true; evaluationId: string; score: number; summary: string }
  | { ok: false; error: string }
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
    const result = await requestEvaluation(
      buildEvaluationPrompt(cv, job.rawText),
    );
    const ev = await prisma.evaluation.create({
      data: {
        cvId,
        jobDescriptionId: job.id,
        userId,
        overallScore: result.overallScore,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        matchedKeywords: result.matchedKeywords,
        missingKeywords: result.missingKeywords,
        skillGaps: result.skillGaps,
        summary: result.summary,
        rawModelOutput: result,
      },
      select: { id: true },
    });
    return {
      ok: true,
      evaluationId: ev.id,
      score: result.overallScore,
      summary: result.summary,
    };
  } catch {
    return { ok: false, error: "AI đánh giá thất bại, vui lòng thử lại" };
  }
}

export async function submitApplication(input: {
  jobId: string;
  cvId: string;
  coverLetter: string;
  evaluationId: string | null;
}): Promise<
  { ok: true; applicationId: string } | { ok: false; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới được ứng tuyển" };

  const parsed = applySchema.safeParse({
    cvId: input.cvId,
    coverLetter: input.coverLetter,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const deps: ApplyDeps = {
    findPublicJob: (jobId) =>
      prisma.jobDescription.findFirst({
        where: { id: jobId, isPublic: true },
        select: { id: true },
      }),
    findExistingApplication: (jobId, candidateId) =>
      prisma.application.findFirst({
        where: { jobId, candidateId },
        select: { id: true },
      }),
    findCandidateCv: (cvId, candidateId) => loadCvInput(cvId, candidateId),
    createApplication: async (data) => {
      const app = await prisma.application.create({
        data: {
          jobId: data.jobId,
          candidateId: data.candidateId,
          cvId: data.cvId,
          cvSnapshot: data.cvSnapshot,
          coverLetter: data.coverLetter,
          evaluationId: data.evaluationId,
          events: { create: { toStatus: "SUBMITTED" } },
        },
        select: { id: true },
      });
      return { id: app.id };
    },
  };

  const outcome = await runApply(
    {
      jobId: input.jobId,
      candidateId: userId,
      cvId: input.cvId,
      coverLetter: parsed.data.coverLetter,
      evaluationId: input.evaluationId,
    },
    deps,
  );

  if (outcome.ok) {
    revalidatePath("/applications");
    revalidatePath(`/jobs/${input.jobId}`);
  }
  return outcome;
}

export async function withdrawApplication(
  applicationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };

  const app = await prisma.application.findFirst({
    where: { id: applicationId, candidateId: userId },
    select: { id: true, status: true },
  });
  if (!app) return { ok: false, error: "Không tìm thấy đơn ứng tuyển" };
  if (!canWithdraw(app.status))
    return { ok: false, error: "Không thể rút đơn ở trạng thái này" };

  await prisma.application.delete({ where: { id: app.id } });
  revalidatePath("/applications");
  return { ok: true };
}

export async function changeStatus(
  applicationId: string,
  toStatus: ApplicationStatus,
  note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "RECRUITER")
    return { ok: false, error: "Chỉ nhà tuyển dụng mới đổi trạng thái" };

  const deps: ChangeStatusDeps = {
    findApplicationForRecruiter: (appId, recruiterId) =>
      prisma.application.findFirst({
        where: { id: appId, job: { userId: recruiterId } },
        select: { id: true, status: true },
      }),
    applyStatusChange: async (data) => {
      await prisma.$transaction([
        prisma.application.update({
          where: { id: data.applicationId },
          data: { status: data.toStatus },
        }),
        prisma.applicationEvent.create({
          data: {
            applicationId: data.applicationId,
            fromStatus: data.fromStatus,
            toStatus: data.toStatus,
            note: data.note,
          },
        }),
      ]);
    },
  };

  const outcome = await runChangeStatus(
    { applicationId, recruiterId: userId, toStatus, note },
    deps,
  );
  if (outcome.ok) revalidatePath(`/jobs`);
  return outcome;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Chạy toàn bộ test (đảm bảo không vỡ gì)**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 4: Commit**

```bash
git add lib/applications/actions.ts
git commit -m "feat(applications): server actions preview/submit/withdraw/changeStatus"
```

---

### Task 8: UI ứng viên — form ứng tuyển + nút trên trang job

**Files:**
- Create: `app/jobs/[id]/apply/page.tsx`
- Create: `app/jobs/[id]/apply/ApplyForm.tsx`
- Modify: `app/jobs/[id]/page.tsx`

**Interfaces:**
- Consumes: `previewMatch`, `submitApplication` (`@/lib/applications/actions`).

- [ ] **Step 1: Tạo `app/jobs/[id]/apply/ApplyForm.tsx` (client)**

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
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  const [match, setMatch] = useState<{ score: number; summary: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onPreview() {
    if (!cvId) return;
    setPreviewing(true);
    setMatch(null);
    const r = await previewMatch(jobId, cvId);
    if (r.ok) {
      setEvaluationId(r.evaluationId);
      setMatch({ score: r.score, summary: r.summary });
    } else {
      toast.error(r.error);
    }
    setPreviewing(false);
  }

  async function onSubmit() {
    if (!cvId) return;
    setSubmitting(true);
    const r = await submitApplication({ jobId, cvId, coverLetter, evaluationId });
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
            setEvaluationId(null);
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

- [ ] **Step 2: Tạo `app/jobs/[id]/apply/page.tsx` (server)**

```tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ApplyForm from "./ApplyForm";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "CANDIDATE") redirect(`/jobs/${id}`);

  const job = await prisma.jobDescription.findFirst({
    where: { id, isPublic: true },
    select: { id: true, title: true, company: true },
  });
  if (!job) notFound();

  const existing = await prisma.application.findFirst({
    where: { jobId: id, candidateId: session.user.id },
    select: { id: true },
  });
  if (existing) redirect("/applications");

  const cvs = await prisma.cV.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href={`/jobs/${id}`} className="text-sm text-blue-600 hover:underline">← Về tin tuyển dụng</Link>
        <Card className="mt-3">
          <CardHeader>
            <CardTitle className="text-blue-700">{job.title || "(chưa có tiêu đề)"}</CardTitle>
            <p className="text-sm text-slate-500">{job.company || "—"}</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Chọn CV, xem điểm phù hợp và nộp đơn.</p>
          </CardContent>
        </Card>
        <ApplyForm jobId={job.id} cvs={cvs} />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Sửa `app/jobs/[id]/page.tsx` — thêm nút "Ứng tuyển" cho ứng viên**

Thêm import ở đầu file (cạnh import `Link`):
```tsx
import { buttonVariants } from "@/components/ui/button";
```
Trước khối `{isCandidate && (` chứa `<EvaluateFromJob .../>`, thêm truy vấn đơn đã nộp. Sau khi lấy `cvs`, thêm:
```tsx
  const applied = isCandidate
    ? await prisma.application.findFirst({
        where: { jobId: job.id, candidateId: session.user.id },
        select: { id: true },
      })
    : null;
```
Trong phần render, ngay dưới thẻ `</Card>` của job (trước `{isCandidate && (`), thêm:
```tsx
        {isCandidate && (
          <div className="mt-4">
            {applied ? (
              <Link href="/applications" className={buttonVariants({ variant: "outline" })}>
                Bạn đã ứng tuyển — xem đơn của tôi
              </Link>
            ) : (
              <Link href={`/jobs/${job.id}/apply`} className={buttonVariants()}>
                Ứng tuyển ngay
              </Link>
            )}
          </div>
        )}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 5: Kiểm tra thủ công**

Chạy `npm run dev`, đăng nhập tài khoản CANDIDATE, mở một job công khai → thấy nút "Ứng tuyển ngay" → vào form chọn CV, bấm "Xem điểm phù hợp" (hiện điểm), nộp đơn → chuyển sang `/applications`. Ứng tuyển lại job đó → nút đổi thành "Bạn đã ứng tuyển".

- [ ] **Step 6: Commit**

```bash
git add app/jobs/[id]/apply app/jobs/[id]/page.tsx
git commit -m "feat(applications): candidate apply form with match preview"
```

---

### Task 9: UI ứng viên — trang "Ứng tuyển của tôi"

**Files:**
- Create: `app/applications/page.tsx`
- Create: `app/applications/WithdrawButton.tsx`

**Interfaces:**
- Consumes: `withdrawApplication` (`@/lib/applications/actions`), `STATUS_LABELS`, `canWithdraw`, `ApplicationStatus` (`@/lib/applications/status`).

- [ ] **Step 1: Tạo `app/applications/WithdrawButton.tsx` (client)**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { withdrawApplication } from "@/lib/applications/actions";

export default function WithdrawButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onWithdraw() {
    setLoading(true);
    const r = await withdrawApplication(applicationId);
    if (r.ok) {
      toast.success("Đã rút đơn");
      router.refresh();
    } else {
      toast.error(r.error);
      setLoading(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={onWithdraw} disabled={loading}>
      {loading ? "Đang rút..." : "Rút đơn"}
    </Button>
  );
}
```

- [ ] **Step 2: Tạo `app/applications/page.tsx` (server)**

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STATUS_LABELS,
  canWithdraw,
  type ApplicationStatus,
} from "@/lib/applications/status";
import WithdrawButton from "./WithdrawButton";

export const dynamic = "force-dynamic";

export default async function MyApplicationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "CANDIDATE") redirect("/dashboard");

  const applications = await prisma.application.findMany({
    where: { candidateId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      job: { select: { id: true, title: true, company: true } },
      evaluation: { select: { overallScore: true } },
      events: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      },
    },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <h1 className="text-xl font-semibold text-blue-700">Ứng tuyển của tôi</h1>
        {applications.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Bạn chưa ứng tuyển tin nào.{" "}
            <Link href="/jobs" className="text-blue-600 hover:underline">Xem tin tuyển dụng</Link>
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {applications.map((a) => (
              <Card key={a.id}>
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-blue-700">
                      <Link href={`/jobs/${a.job.id}`} className="hover:underline">
                        {a.job.title || "(chưa có tiêu đề)"}
                      </Link>
                    </CardTitle>
                    <p className="text-sm text-slate-500">{a.job.company || "—"}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {STATUS_LABELS[a.status as ApplicationStatus]}
                  </span>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-slate-700">
                  {a.evaluation && (
                    <p>Điểm phù hợp: <span className="font-semibold">{a.evaluation.overallScore}/100</span></p>
                  )}
                  <div className="flex flex-wrap gap-1 text-xs text-slate-500">
                    {a.events.map((e, i) => (
                      <span key={i}>
                        {STATUS_LABELS[e.toStatus as ApplicationStatus]}
                        {i < a.events.length - 1 ? " → " : ""}
                      </span>
                    ))}
                  </div>
                  {canWithdraw(a.status as ApplicationStatus) && (
                    <div><WithdrawButton applicationId={a.id} /></div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 4: Kiểm tra thủ công**

Với tài khoản CANDIDATE đã nộp đơn ở Task 8: mở `/applications` → thấy đơn, trạng thái "Đã nộp", điểm phù hợp, timeline, nút "Rút đơn". Bấm rút → đơn biến mất.

- [ ] **Step 5: Commit**

```bash
git add app/applications
git commit -m "feat(applications): candidate my-applications page with withdraw"
```

---

### Task 10: UI nhà tuyển dụng — board ứng viên kéo-thả

**Files:**
- Create: `app/jobs/[id]/applicants/page.tsx`
- Create: `app/jobs/[id]/applicants/ApplicantsBoard.tsx`
- Modify: `app/jobs/[id]/page.tsx`

**Interfaces:**
- Consumes: `changeStatus` (`@/lib/applications/actions`), `APPLICATION_STATUSES`, `STATUS_LABELS`, `ApplicationStatus` (`@/lib/applications/status`).

- [ ] **Step 1: Tạo `app/jobs/[id]/applicants/ApplicantsBoard.tsx` (client, HTML5 drag-drop)**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  APPLICATION_STATUSES,
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

export default function ApplicantsBoard({ initial }: { initial: ApplicantCard[] }) {
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

  return (
    <div className="mt-4 grid grid-flow-col gap-3 overflow-x-auto pb-2 [grid-auto-columns:minmax(220px,1fr)]">
      {APPLICATION_STATUSES.map((status) => {
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
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Tạo `app/jobs/[id]/applicants/page.tsx` (server)**

```tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import ApplicantsBoard, { type ApplicantCard } from "./ApplicantsBoard";
import type { ApplicationStatus } from "@/lib/applications/status";

export const dynamic = "force-dynamic";

export default async function ApplicantsPage({
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
    select: { id: true, title: true, company: true },
  });
  if (!job) notFound();

  const rows = await prisma.application.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      coverLetter: true,
      candidate: { select: { name: true } },
      evaluation: { select: { overallScore: true } },
    },
  });

  const initial: ApplicantCard[] = rows.map((r) => ({
    id: r.id,
    status: r.status as ApplicationStatus,
    candidateName: r.candidate.name,
    score: r.evaluation?.overallScore ?? null,
    coverLetter: r.coverLetter,
  }));

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <Link href={`/jobs/${id}`} className="text-sm text-blue-600 hover:underline">← Về tin tuyển dụng</Link>
        <h1 className="mt-2 text-xl font-semibold text-blue-700">
          Ứng viên — {job.title || "(chưa có tiêu đề)"}
        </h1>
        <p className="text-sm text-slate-500">
          Kéo thẻ ứng viên giữa các cột để đổi trạng thái. Tổng {initial.length} ứng viên.
        </p>
        {initial.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Chưa có ai ứng tuyển tin này.</p>
        ) : (
          <ApplicantsBoard initial={initial} />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Sửa `app/jobs/[id]/page.tsx` — link "Xem ứng viên" cho NTD chủ tin**

Trong query `job`, đảm bảo lấy thêm `userId`:
```tsx
    select: { id: true, title: true, company: true, rawText: true, userId: true },
```
Sau khối `isCandidate`, thêm biến và render (dùng `buttonVariants` đã import ở Task 8):
```tsx
  const isOwnerRecruiter =
    session.user.role === "RECRUITER" && job.userId === session.user.id;
```
Render (đặt cạnh khối nút của ứng viên):
```tsx
        {isOwnerRecruiter && (
          <div className="mt-4">
            <Link href={`/jobs/${job.id}/applicants`} className={buttonVariants()}>
              Xem ứng viên đã nộp
            </Link>
          </div>
        )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 5: Kiểm tra thủ công**

Đăng nhập RECRUITER là chủ tin → mở job → thấy "Xem ứng viên đã nộp" → vào board 6 cột, thẻ ứng viên nằm ở cột "Đã nộp". Kéo một thẻ sang "Đang sàng lọc" → toast thành công, thẻ ở lại cột mới sau refresh. Đăng nhập lại CANDIDATE mở `/applications` → thấy trạng thái đã cập nhật + timeline có thêm bước.

- [ ] **Step 6: Commit**

```bash
git add app/jobs/[id]/applicants app/jobs/[id]/page.tsx
git commit -m "feat(applications): recruiter applicants kanban board"
```

---

## Self-Review (đã thực hiện)

- **Bao phủ spec:** §2 data model → Task 1; §3 model mới (Application/Event/snapshot/evaluationId/unique) → Task 1 + 5 + 7; §4 luồng ứng viên (chọn CV, xem điểm, cover letter, nộp, "Ứng tuyển của tôi", rút đơn) → Task 7/8/9; §5 luồng NTD (board 6 cột kéo-thả, đổi trạng thái ghi event) → Task 7/10; §6 phân quyền → kiểm tra role trong Task 7–10; §7 xử lý lỗi (AI lỗi vẫn nộp được, chặn trùng, sai quyền) → Task 5/7; §8 kiểm thử (unit hàm thuần, mock AI) → Task 2/3/5/6. Ranh giới gói B/E được tôn trọng (không làm notification/xếp hạng hàng loạt).
- **Placeholder:** không còn TBD/TODO; mọi bước có code hoặc lệnh cụ thể.
- **Nhất quán kiểu:** `ApplicationStatus`, `canTransition`, `canWithdraw`, `runApply`/`ApplyDeps`, `runChangeStatus`/`ChangeStatusDeps`, `loadCvInput`, `requestEvaluation`, `previewMatch`/`submitApplication`/`withdrawApplication`/`changeStatus`, `ApplicantCard` khớp giữa các task.
```
