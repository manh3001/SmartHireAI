# Candidate Job Discovery (Phase 8 — Gói C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ứng viên khám phá việc: tìm kiếm theo từ khóa trên `/jobs`, lưu tin (bookmark) + trang "Tin đã lưu", và gợi ý việc bằng AI xếp hạng tin theo CV đã chọn.

**Architecture:** Tìm kiếm là lọc server-side qua `?q`. Lưu tin dùng model `SavedJob` + action toggle + nút client. Gợi ý AI đảo ngược gói B: một lệnh AI (Gemini structured output) nhận 1 CV + tối đa 20 tin (chưa ứng tuyển), trả `ranking` theo số `ref`; core thuần `runRecommendations` (DI) map `ref → jobId`, tính on-demand (không lưu DB). Server action `recommendJobs(cvId)` nạp dữ liệu và trả kết quả về client.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 + PostgreSQL (Neon), Auth.js, Zod 4, Vitest, Tailwind 4, lucide-react, AI qua OpenAI-compat client (Gemini `gemini-2.5-flash`).

## Global Constraints

- **Next.js là bản có breaking changes.** Trước khi viết route/page/server-action, đọc guide liên quan trong `node_modules/next/dist/docs/`. Pages phải `await params`/`await searchParams` (đều là `Promise` trong bản này).
- **Prisma giữ v6.** Đẩy schema bằng `npm run db:push` (đã bọc ipv4first), KHÔNG dùng `prisma db push` trần.
- **AI provider: Gemini** qua `@/lib/ai/client` (`getAiClient`, `AI_MODEL`), structured output qua `zodResponseFormat` — giống `lib/ai/request-evaluation.ts`. Không đổi provider.
- **Test:** `npm test` (vitest run). Toàn bộ UI copy **tiếng Việt**.
- **Server actions** dùng `auth()` từ `@/auth`, `prisma` từ `@/lib/db/prisma`; kiểm tra `session.user.id` + `session.user.role`.
- **Palette:** blue-700 tiêu đề, slate-50 nền, dùng `Card`/`Button` từ `@/components/ui`, icon `lucide-react`.
- Áp dụng **TDD** cho logic thuần (`recommendation-schema`, `recommendation-prompt` builder, `runRecommendations` core); glue/UI/tìm kiếm/lưu tin không unit-test (an toàn bằng `npx tsc --noEmit` + `npm test` xanh).
- `MAX_RECOMMEND_JOBS = 20`.

---

## File Structure

**Tạo mới:**
- `lib/ai/recommendation-schema.ts` — Zod `recommendationResultSchema` + type `RecommendationResult`.
- `lib/ai/recommendation-prompt.ts` — `RECOMMENDATION_SYSTEM_PROMPT` + `buildRecommendationPrompt(cv, jobs)`.
- `lib/ai/request-recommendations.ts` — `requestRecommendations(prompt)`.
- `lib/jobs/recommendations.ts` — core `runRecommendations(params, deps)` + types + `MAX_RECOMMEND_JOBS`.
- `lib/jobs/saved-actions.ts` — `"use server"`: `toggleSaveJob(jobId)`.
- `lib/jobs/recommend-actions.ts` — `"use server"`: `recommendJobs(cvId)`.
- `lib/jobs/__tests__/recommendations.test.ts`, `lib/ai/__tests__/recommendation-schema.test.ts`, `lib/ai/__tests__/recommendation-prompt.test.ts`.
- `app/jobs/SaveJobButton.tsx` — nút lưu/bỏ lưu (client).
- `app/jobs/saved/page.tsx` — trang "Tin đã lưu".
- `app/jobs/recommendations/page.tsx` — trang gợi ý (SSR khung).
- `app/jobs/recommendations/RecommendClient.tsx` — dropdown CV + nút gợi ý + danh sách (client).

**Sửa:**
- `prisma/schema.prisma` — thêm model `SavedJob` + quan hệ ngược.
- `app/jobs/page.tsx` — ô tìm kiếm `?q`; nút lưu trên thẻ; link "Tin đã lưu" + "✨ Gợi ý việc cho tôi".

---

### Task 1: Prisma model SavedJob

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: model `SavedJob` (userId, jobId, `@@unique([userId, jobId])`); `User.savedJobs SavedJob[]`, `JobDescription.savedBy SavedJob[]`.

- [ ] **Step 1: Thêm model + quan hệ ngược**

Ở cuối `prisma/schema.prisma` thêm:
```prisma
model SavedJob {
  id        String         @id @default(cuid())
  userId    String
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobId     String
  job       JobDescription @relation(fields: [jobId], references: [id], onDelete: Cascade)
  createdAt DateTime       @default(now())

  @@unique([userId, jobId])
}
```
Trong `model User { ... }` thêm dòng:
```prisma
  savedJobs    SavedJob[]
```
Trong `model JobDescription { ... }` thêm dòng:
```prisma
  savedBy      SavedJob[]
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
git commit -m "feat(db): add SavedJob model"
```

---

### Task 2: Tìm kiếm theo từ khóa trên /jobs

**Files:**
- Modify: `app/jobs/page.tsx`

**Interfaces:**
- Produces: `/jobs?q=<từ khóa>` lọc tin theo title/company/rawText.

Glue/UI: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: Sửa `app/jobs/page.tsx` để nhận `searchParams` và lọc**

Thay chữ ký hàm + phần nạp `jobs` (giữ nguyên phần render danh sách bên dưới):
```tsx
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q } = await searchParams;
  const term = (q ?? "").trim();

  const jobs = await prisma.jobDescription.findMany({
    where: {
      isPublic: true,
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: "insensitive" } },
              { company: { contains: term, mode: "insensitive" } },
              { rawText: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, company: true, rawText: true, createdAt: true },
  });
```

- [ ] **Step 2: Thêm ô tìm kiếm (form GET) ngay dưới `<h1>`**

Trong phần render, ngay sau `<h1 ...>Tin tuyển dụng</h1>` thêm:
```tsx
        <form method="get" className="mb-4 flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={term}
            placeholder="Tìm theo tiêu đề, công ty, nội dung..."
            className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Tìm
          </button>
        </form>
```
(Xoá bỏ `mb-4` khỏi `<h1>` nếu trùng lặp khoảng cách; giữ tiêu đề như cũ.)

- [ ] **Step 3: Cập nhật thông báo rỗng khi đang tìm kiếm**

Thay khối `{jobs.length === 0 && (...)}` (thông báo rỗng) bằng:
```tsx
          {jobs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-slate-500">
                {term ? `Không tìm thấy tin nào khớp "${term}".` : "Chưa có tin tuyển dụng nào."}
              </CardContent>
            </Card>
          )}
```

- [ ] **Step 4: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add app/jobs/page.tsx
git commit -m "feat(jobs): keyword search on jobs list"
```

---

### Task 3: Server action `toggleSaveJob`

**Files:**
- Create: `lib/jobs/saved-actions.ts`

**Interfaces:**
- Produces: `toggleSaveJob(jobId: string): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }>`

Glue: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: Viết `lib/jobs/saved-actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";

export async function toggleSaveJob(
  jobId: string,
): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới lưu tin" };

  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, isPublic: true },
    select: { id: true },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const existing = await prisma.savedJob.findUnique({
    where: { userId_jobId: { userId, jobId } },
    select: { id: true },
  });

  let saved: boolean;
  if (existing) {
    await prisma.savedJob.delete({ where: { id: existing.id } });
    saved = false;
  } else {
    await prisma.savedJob.create({ data: { userId, jobId } });
    saved = true;
  }

  revalidatePath("/jobs");
  revalidatePath("/jobs/saved");
  return { ok: true, saved };
}
```

- [ ] **Step 2: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 3: Commit**

```bash
git add lib/jobs/saved-actions.ts
git commit -m "feat(jobs): toggleSaveJob server action"
```

---

### Task 4: SaveJobButton + tích hợp /jobs + trang "Tin đã lưu"

**Files:**
- Create: `app/jobs/SaveJobButton.tsx`
- Create: `app/jobs/saved/page.tsx`
- Modify: `app/jobs/page.tsx`

**Interfaces:**
- Consumes: `toggleSaveJob` (`@/lib/jobs/saved-actions`).
- Produces: `SaveJobButton({ jobId, initialSaved }: { jobId: string; initialSaved: boolean })` (default export).

- [ ] **Step 1: Tạo `app/jobs/SaveJobButton.tsx` (client)**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { toggleSaveJob } from "@/lib/jobs/saved-actions";

export default function SaveJobButton({
  jobId,
  initialSaved,
}: {
  jobId: string;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);

  async function onToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPending(true);
    const r = await toggleSaveJob(jobId);
    if (r.ok) {
      setSaved(r.saved);
      toast.success(r.saved ? "Đã lưu tin" : "Đã bỏ lưu");
      router.refresh();
    } else {
      toast.error(r.error);
    }
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-label={saved ? "Bỏ lưu tin" : "Lưu tin"}
      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
    >
      {saved ? (
        <BookmarkCheck className="h-4 w-4 text-blue-600" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Sửa `app/jobs/page.tsx` — nạp trạng thái đã lưu + nút lưu trên thẻ + link điều hướng**

Sau khi nạp `jobs`, thêm:
```tsx
  const isCandidate = session.user.role === "CANDIDATE";
  const savedIds = isCandidate
    ? new Set(
        (
          await prisma.savedJob.findMany({
            where: { userId: session.user.id },
            select: { jobId: true },
          })
        ).map((s) => s.jobId),
      )
    : new Set<string>();
```
Thêm import ở đầu file:
```tsx
import SaveJobButton from "./SaveJobButton";
```
Ngay dưới `<form method="get" ...>` (ô tìm kiếm), thêm link tới trang đã lưu cho ứng viên:
```tsx
        {isCandidate && (
          <div className="mb-4">
            <Link href="/jobs/saved" className="text-sm text-blue-600 hover:underline">
              🔖 Tin đã lưu
            </Link>
          </div>
        )}
```
Thay mỗi thẻ job (khối `<Link key={j.id} href={...}><Card>...</Card></Link>`) bằng cấu trúc bọc `relative` để nút lưu KHÔNG nằm trong `Link`:
```tsx
          {jobs.map((j) => (
            <div key={j.id} className="relative">
              <Link href={`/jobs/${j.id}`}>
                <Card className="border-slate-200 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
                  <CardContent className="flex items-start gap-3 py-4 pr-10">
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Briefcase className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-medium text-slate-900">{j.title || "(chưa có tiêu đề)"}</div>
                      <div className="text-xs text-slate-400">{j.company || "—"}</div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{j.rawText}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              {isCandidate && (
                <div className="absolute right-2 top-2">
                  <SaveJobButton jobId={j.id} initialSaved={savedIds.has(j.id)} />
                </div>
              )}
            </div>
          ))}
```

- [ ] **Step 3: Tạo `app/jobs/saved/page.tsx` (server)**

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import SaveJobButton from "../SaveJobButton";

export const dynamic = "force-dynamic";

export default async function SavedJobsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "CANDIDATE") redirect("/jobs");

  const saved = await prisma.savedJob.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      job: { select: { id: true, title: true, company: true, rawText: true } },
    },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/jobs" className="text-sm text-blue-600 hover:underline">← Về danh sách việc</Link>
        <h1 className="mb-4 mt-2 text-2xl font-bold text-slate-900">Tin đã lưu</h1>
        <div className="flex flex-col gap-3">
          {saved.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-slate-500">Bạn chưa lưu tin nào.</CardContent>
            </Card>
          )}
          {saved.map(({ job: j }) => (
            <div key={j.id} className="relative">
              <Link href={`/jobs/${j.id}`}>
                <Card className="border-slate-200 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
                  <CardContent className="flex items-start gap-3 py-4 pr-10">
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Briefcase className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-medium text-slate-900">{j.title || "(chưa có tiêu đề)"}</div>
                      <div className="text-xs text-slate-400">{j.company || "—"}</div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{j.rawText}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <div className="absolute right-2 top-2">
                <SaveJobButton jobId={j.id} initialSaved={true} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 5: Kiểm tra thủ công (cho người dùng)**

Đăng nhập CANDIDATE: `/jobs` hiện nút lưu (icon bookmark) trên mỗi thẻ; bấm lưu → icon đổi màu xanh, toast "Đã lưu tin"; mở `/jobs/saved` thấy tin; bỏ lưu → biến mất. NTD không thấy nút lưu.

- [ ] **Step 6: Commit**

```bash
git add app/jobs/SaveJobButton.tsx "app/jobs/saved/page.tsx" app/jobs/page.tsx
git commit -m "feat(jobs): save/bookmark jobs with saved list page"
```

---

### Task 5: Zod schema kết quả gợi ý

**Files:**
- Create: `lib/ai/recommendation-schema.ts`
- Test: `lib/ai/__tests__/recommendation-schema.test.ts`

**Interfaces:**
- Produces:
  - `recommendationResultSchema` (Zod)
  - `type RecommendationResult = { ranking: { ref: number; score: number; reason: string }[]; summary: string }`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/ai/__tests__/recommendation-schema.test.ts
import { describe, it, expect } from "vitest";
import { recommendationResultSchema } from "../recommendation-schema";

describe("recommendationResultSchema", () => {
  it("chấp nhận kết quả hợp lệ", () => {
    const r = recommendationResultSchema.safeParse({
      ranking: [{ ref: 1, score: 85, reason: "hợp" }],
      summary: "ok",
    });
    expect(r.success).toBe(true);
  });

  it("từ chối khi thiếu summary", () => {
    const r = recommendationResultSchema.safeParse({ ranking: [] });
    expect(r.success).toBe(false);
  });

  it("từ chối score ngoài 0-100", () => {
    const r = recommendationResultSchema.safeParse({
      ranking: [{ ref: 1, score: -5, reason: "x" }],
      summary: "s",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- recommendation-schema`
Expected: FAIL — không import được `../recommendation-schema`.

- [ ] **Step 3: Viết `lib/ai/recommendation-schema.ts`**

```ts
import { z } from "zod";

export const recommendationResultSchema = z.object({
  ranking: z.array(
    z.object({
      ref: z.number().int(),
      score: z.number().int().min(0).max(100),
      reason: z.string(),
    }),
  ),
  summary: z.string(),
});

export type RecommendationResult = z.infer<typeof recommendationResultSchema>;
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- recommendation-schema`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/recommendation-schema.ts lib/ai/__tests__/recommendation-schema.test.ts
git commit -m "feat(ai): recommendation result zod schema"
```

---

### Task 6: Prompt gợi ý + request-recommendations

**Files:**
- Create: `lib/ai/recommendation-prompt.ts`
- Create: `lib/ai/request-recommendations.ts`
- Test: `lib/ai/__tests__/recommendation-prompt.test.ts`

**Interfaces:**
- Consumes: `CvInput` (`@/lib/cv/types`), `recommendationResultSchema`/`RecommendationResult` (`./recommendation-schema`), `getAiClient`/`AI_MODEL` (`./client`).
- Produces:
  - `RECOMMENDATION_SYSTEM_PROMPT: string`
  - `type RecommendationJob = { title: string; company: string; rawText: string }`
  - `buildRecommendationPrompt(cv: CvInput, jobs: RecommendationJob[]): string` — đánh số tin `#1..#n`.
  - `requestRecommendations(prompt: string): Promise<RecommendationResult>`

- [ ] **Step 1: Viết test thất bại cho prompt builder**

```ts
// lib/ai/__tests__/recommendation-prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildRecommendationPrompt } from "../recommendation-prompt";
import type { CvInput } from "@/lib/cv/types";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "An", headline: "Frontend Dev", email: "", phone: "", summary: "" },
  experiences: [],
  educations: [],
  skills: [{ name: "React", level: "" }],
  projects: [],
};

describe("buildRecommendationPrompt", () => {
  it("kèm CV và đánh số từng tin", () => {
    const p = buildRecommendationPrompt(cv, [
      { title: "Frontend", company: "A", rawText: "Cần React" },
      { title: "Backend", company: "B", rawText: "Cần Node" },
    ]);
    expect(p).toContain("An");
    expect(p).toContain("React");
    expect(p).toContain("#1");
    expect(p).toContain("Frontend");
    expect(p).toContain("#2");
    expect(p).toContain("Backend");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- recommendation-prompt`
Expected: FAIL — không import được `../recommendation-prompt`.

- [ ] **Step 3: Viết `lib/ai/recommendation-prompt.ts`**

```ts
import type { CvInput } from "@/lib/cv/types";

export const RECOMMENDATION_SYSTEM_PROMPT = `Bạn là cố vấn nghề nghiệp giàu kinh nghiệm. \
Nhiệm vụ: so khớp MỘT CV của ứng viên với NHIỀU tin tuyển dụng và xếp hạng các tin theo mức phù hợp với ứng viên. \
Với mỗi tin: chấm điểm phù hợp 0-100 và nêu lý do ngắn gọn (vì sao tin này hợp/không hợp với ứng viên). \
Trả về "ranking" xếp từ PHÙ HỢP NHẤT trước, dùng đúng số "ref" đã gán cho mỗi tin. \
Chỉ đưa vào ranking những tin đáng gợi ý; "summary" là nhận xét tổng quan cho ứng viên. \
Trả lời hoàn toàn bằng tiếng Việt, đúng cấu trúc JSON được yêu cầu.`;

export type RecommendationJob = {
  title: string;
  company: string;
  rawText: string;
};

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
  if (cv.projects.length) {
    lines.push("Dự án: " + cv.projects.map((pr) => pr.name).join(", "));
  }
  return lines.join("\n");
}

export function buildRecommendationPrompt(
  cv: CvInput,
  jobs: RecommendationJob[],
): string {
  const blocks = jobs.map((j, i) => {
    const body = j.rawText.length > 600 ? j.rawText.slice(0, 600) + "…" : j.rawText;
    return `### Tin #${i + 1}: ${j.title || "(chưa có tiêu đề)"} — ${j.company || "—"}\n${body}`;
  });
  return `=== CV ỨNG VIÊN ===
${formatCvBrief(cv)}

=== DANH SÁCH TIN TUYỂN DỤNG ===
${blocks.join("\n\n")}

Hãy xếp hạng các tin trên theo mức phù hợp với ứng viên, trả về đúng cấu trúc JSON yêu cầu (dùng số ref tương ứng #1..#${jobs.length}).`;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- recommendation-prompt`
Expected: PASS (1 test).

- [ ] **Step 5: Viết `lib/ai/request-recommendations.ts`**

```ts
import { zodResponseFormat } from "openai/helpers/zod";
import { getAiClient, AI_MODEL } from "./client";
import { RECOMMENDATION_SYSTEM_PROMPT } from "./recommendation-prompt";
import {
  recommendationResultSchema,
  type RecommendationResult,
} from "./recommendation-schema";

export async function requestRecommendations(
  prompt: string,
): Promise<RecommendationResult> {
  const client = getAiClient();
  const completion = await client.chat.completions.parse({
    model: AI_MODEL,
    messages: [
      { role: "system", content: RECOMMENDATION_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: zodResponseFormat(recommendationResultSchema, "recommendation"),
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
git add lib/ai/recommendation-prompt.ts lib/ai/request-recommendations.ts lib/ai/__tests__/recommendation-prompt.test.ts
git commit -m "feat(ai): recommendation prompt builder and request helper"
```

---

### Task 7: Core `runRecommendations` (DI) + test

**Files:**
- Create: `lib/jobs/recommendations.ts`
- Test: `lib/jobs/__tests__/recommendations.test.ts`

**Interfaces:**
- Consumes: `CvInput` (`@/lib/cv/types`), `buildRecommendationPrompt`/`RecommendationJob` (`@/lib/ai/recommendation-prompt`), `RecommendationResult` (`@/lib/ai/recommendation-schema`).
- Produces:
  - `MAX_RECOMMEND_JOBS = 20`
  - `type RecommendationJobInput = { jobId: string; title: string; company: string; rawText: string }`
  - `type RecommendationItem = { jobId: string; title: string; company: string; score: number; reason: string }`
  - `type RunRecommendationsParams = { cv: CvInput; jobs: RecommendationJobInput[] }`
  - `type RunRecommendationsDeps = { requestRecommendations: (prompt: string) => Promise<RecommendationResult> }`
  - `type RunRecommendationsOutcome = { ok: true; summary: string; items: RecommendationItem[] } | { ok: false; error: string }`
  - `runRecommendations(params, deps): Promise<RunRecommendationsOutcome>`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/jobs/__tests__/recommendations.test.ts
import { describe, it, expect, vi } from "vitest";
import { runRecommendations, type RunRecommendationsDeps, type RecommendationJobInput } from "../recommendations";
import type { CvInput } from "@/lib/cv/types";
import type { RecommendationResult } from "@/lib/ai/recommendation-schema";

const cv: CvInput = {
  title: "CV",
  profile: { fullName: "An", headline: "", email: "", phone: "", summary: "" },
  experiences: [], educations: [], skills: [], projects: [],
};

function job(id: string, title: string): RecommendationJobInput {
  return { jobId: id, title, company: "C", rawText: "jd" };
}

function deps(ai: RecommendationResult, over: Partial<RunRecommendationsDeps> = {}): RunRecommendationsDeps {
  return { requestRecommendations: vi.fn().mockResolvedValue(ai), ...over };
}

describe("runRecommendations", () => {
  it("báo lỗi khi không có tin", async () => {
    const d = deps({ ranking: [], summary: "" });
    const r = await runRecommendations({ cv, jobs: [] }, d);
    expect(r).toEqual({ ok: false, error: "Chưa có tin phù hợp để gợi ý" });
    expect(d.requestRecommendations).not.toHaveBeenCalled();
  });

  it("map ref -> job theo thứ tự, bỏ ref lỗi/trùng, bỏ tin không xếp hạng", async () => {
    const jobs = [job("j1", "A"), job("j2", "B"), job("j3", "C")];
    const ai: RecommendationResult = {
      ranking: [
        { ref: 2, score: 90, reason: "hợp" },
        { ref: 9, score: 50, reason: "ngoài phạm vi" },
        { ref: 2, score: 10, reason: "trùng" },
        { ref: 1, score: 70, reason: "khá" },
      ],
      summary: "tổng quan",
    };
    const r = await runRecommendations({ cv, jobs }, deps(ai));
    expect(r).toEqual({
      ok: true,
      summary: "tổng quan",
      items: [
        { jobId: "j2", title: "B", company: "C", score: 90, reason: "hợp" },
        { jobId: "j1", title: "A", company: "C", score: 70, reason: "khá" },
      ],
    });
  });

  it("báo lỗi mềm khi AI thất bại", async () => {
    const d = deps({ ranking: [], summary: "" }, {
      requestRecommendations: vi.fn().mockRejectedValue(new Error("boom")),
    });
    const r = await runRecommendations({ cv, jobs: [job("j1", "A")] }, d);
    expect(r).toEqual({ ok: false, error: "AI gợi ý thất bại, vui lòng thử lại" });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- jobs/__tests__/recommendations`
Expected: FAIL — không import được `../recommendations`.

- [ ] **Step 3: Viết `lib/jobs/recommendations.ts`**

```ts
import type { CvInput } from "@/lib/cv/types";
import {
  buildRecommendationPrompt,
  type RecommendationJob,
} from "@/lib/ai/recommendation-prompt";
import type { RecommendationResult } from "@/lib/ai/recommendation-schema";

export const MAX_RECOMMEND_JOBS = 20;

export type RecommendationJobInput = {
  jobId: string;
  title: string;
  company: string;
  rawText: string;
};

export type RecommendationItem = {
  jobId: string;
  title: string;
  company: string;
  score: number;
  reason: string;
};

export type RunRecommendationsParams = {
  cv: CvInput;
  jobs: RecommendationJobInput[];
};

export type RunRecommendationsDeps = {
  requestRecommendations: (prompt: string) => Promise<RecommendationResult>;
};

export type RunRecommendationsOutcome =
  | { ok: true; summary: string; items: RecommendationItem[] }
  | { ok: false; error: string };

export async function runRecommendations(
  params: RunRecommendationsParams,
  deps: RunRecommendationsDeps,
): Promise<RunRecommendationsOutcome> {
  if (params.jobs.length === 0) {
    return { ok: false, error: "Chưa có tin phù hợp để gợi ý" };
  }

  const promptJobs: RecommendationJob[] = params.jobs.map((j) => ({
    title: j.title,
    company: j.company,
    rawText: j.rawText,
  }));
  const prompt = buildRecommendationPrompt(params.cv, promptJobs);

  let ai: RecommendationResult;
  try {
    ai = await deps.requestRecommendations(prompt);
  } catch {
    return { ok: false, error: "AI gợi ý thất bại, vui lòng thử lại" };
  }

  const n = params.jobs.length;
  const seen = new Set<number>();
  const items: RecommendationItem[] = [];

  for (const r of ai.ranking) {
    const idx = r.ref - 1;
    if (idx < 0 || idx >= n) continue;
    if (seen.has(idx)) continue;
    seen.add(idx);
    const j = params.jobs[idx];
    items.push({
      jobId: j.jobId,
      title: j.title,
      company: j.company,
      score: r.score,
      reason: r.reason,
    });
  }

  return { ok: true, summary: ai.summary, items };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- jobs/__tests__/recommendations`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/recommendations.ts lib/jobs/__tests__/recommendations.test.ts
git commit -m "feat(jobs): runRecommendations core with ref mapping"
```

---

### Task 8: Action `recommendJobs` + trang gợi ý + client + link

**Files:**
- Create: `lib/jobs/recommend-actions.ts`
- Create: `app/jobs/recommendations/RecommendClient.tsx`
- Create: `app/jobs/recommendations/page.tsx`
- Modify: `app/jobs/page.tsx`

**Interfaces:**
- Consumes: `runRecommendations`/`MAX_RECOMMEND_JOBS`/`RunRecommendationsOutcome`/`RecommendationJobInput` (`@/lib/jobs/recommendations`), `requestRecommendations` (`@/lib/ai/request-recommendations`), `loadCvInput` (`@/lib/cv/load`), `createRateLimiter` (`@/lib/ai/rate-limit`), `toggleSaveJob`-driven `SaveJobButton` (`../SaveJobButton`), `prisma`, `auth`.
- Produces: `recommendJobs(cvId: string): Promise<RunRecommendationsOutcome>`

- [ ] **Step 1: Viết `lib/jobs/recommend-actions.ts`**

```ts
"use server";

import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import { loadCvInput } from "@/lib/cv/load";
import { requestRecommendations } from "@/lib/ai/request-recommendations";
import {
  runRecommendations,
  MAX_RECOMMEND_JOBS,
  type RecommendationJobInput,
  type RunRecommendationsOutcome,
} from "./recommendations";

const recommendLimiter = createRateLimiter({ max: 5, windowMs: 60000 });

export async function recommendJobs(
  cvId: string,
): Promise<RunRecommendationsOutcome> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE")
    return { ok: false, error: "Chỉ ứng viên mới được gợi ý việc" };

  if (!recommendLimiter.check(userId, Date.now()))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };

  const cv = await loadCvInput(cvId, userId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  const applied = await prisma.application.findMany({
    where: { candidateId: userId },
    select: { jobId: true },
  });
  const appliedJobIds = applied.map((a) => a.jobId);

  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true, id: { notIn: appliedJobIds } },
    orderBy: { createdAt: "desc" },
    take: MAX_RECOMMEND_JOBS,
    select: { id: true, title: true, company: true, rawText: true },
  });

  const jobs: RecommendationJobInput[] = rows.map((r) => ({
    jobId: r.id,
    title: r.title,
    company: r.company,
    rawText: r.rawText,
  }));

  return runRecommendations({ cv, jobs }, { requestRecommendations });
}
```

- [ ] **Step 2: Tạo `app/jobs/recommendations/RecommendClient.tsx` (client)**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SaveJobButton from "../SaveJobButton";
import { recommendJobs } from "@/lib/jobs/recommend-actions";
import type { RecommendationItem } from "@/lib/jobs/recommendations";

export default function RecommendClient({
  cvs,
}: {
  cvs: { id: string; title: string }[];
}) {
  const [cvId, setCvId] = useState(cvs[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    { summary: string; items: RecommendationItem[] } | null
  >(null);

  async function onRecommend() {
    if (!cvId) return;
    setLoading(true);
    setResult(null);
    const r = await recommendJobs(cvId);
    if (r.ok) {
      setResult({ summary: r.summary, items: r.items });
      if (r.items.length === 0) toast.info("Chưa tìm được tin phù hợp để gợi ý");
    } else {
      toast.error(r.error);
    }
    setLoading(false);
  }

  if (cvs.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        Bạn chưa có CV nào. Hãy tạo CV trước ở bảng điều khiển rồi quay lại.
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={cvId}
          onChange={(e) => setCvId(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          {cvs.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <Button onClick={onRecommend} disabled={loading || !cvId}>
          {loading ? "Đang gợi ý..." : "Gợi ý việc cho tôi"}
        </Button>
      </div>

      {result && (
        <>
          {result.summary && (
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-blue-700">Nhận xét</p>
              <p className="mt-1 whitespace-pre-wrap">{result.summary}</p>
            </div>
          )}
          {result.items.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa tìm được tin phù hợp để gợi ý.</p>
          ) : (
            <div className="grid gap-2">
              {result.items.map((it, i) => (
                <div key={it.jobId} className="relative rounded-lg border border-slate-200 bg-white p-3 pr-10 text-sm">
                  <p className="font-medium text-slate-800">
                    #{i + 1} ·{" "}
                    <Link href={`/jobs/${it.jobId}`} className="text-blue-700 hover:underline">
                      {it.title || "(chưa có tiêu đề)"}
                    </Link>{" "}
                    <span className="text-xs text-slate-400">{it.company || "—"}</span>
                  </p>
                  <p className="text-xs text-blue-600">Điểm phù hợp: {it.score}/100</p>
                  <p className="mt-1 text-slate-700">{it.reason}</p>
                  <div className="absolute right-2 top-2">
                    <SaveJobButton jobId={it.jobId} initialSaved={false} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Tạo `app/jobs/recommendations/page.tsx` (server)**

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import RecommendClient from "./RecommendClient";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "CANDIDATE") redirect("/jobs");

  const cvs = await prisma.cV.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/jobs" className="text-sm text-blue-600 hover:underline">← Về danh sách việc</Link>
        <h1 className="mb-1 mt-2 text-2xl font-bold text-slate-900">Gợi ý việc cho tôi</h1>
        <p className="text-sm text-slate-500">
          AI so khớp CV bạn chọn với các tin công khai bạn chưa ứng tuyển (tối đa 20 tin mới nhất) và xếp hạng theo mức phù hợp.
        </p>
        <RecommendClient cvs={cvs} />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Sửa `app/jobs/page.tsx` — thêm link "✨ Gợi ý việc cho tôi"**

Trong khối `{isCandidate && (...)}` chứa link "🔖 Tin đã lưu" (thêm ở Task 4), bổ sung link gợi ý cạnh nó:
```tsx
        {isCandidate && (
          <div className="mb-4 flex gap-4">
            <Link href="/jobs/saved" className="text-sm text-blue-600 hover:underline">
              🔖 Tin đã lưu
            </Link>
            <Link href="/jobs/recommendations" className="text-sm text-blue-600 hover:underline">
              ✨ Gợi ý việc cho tôi
            </Link>
          </div>
        )}
```
(Thay thế khối một-link ở Task 4 bằng khối hai-link này.)

- [ ] **Step 5: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 6: Kiểm tra thủ công (cho người dùng)**

Đăng nhập CANDIDATE có CV + có tin công khai chưa ứng tuyển: `/jobs` → "✨ Gợi ý việc cho tôi" → chọn CV → "Gợi ý việc cho tôi" → hiện danh sách tin xếp hạng (điểm + lý do + link + nút lưu). Ứng viên chưa có CV → báo cần tạo CV. Không có tin phù hợp → thông báo rỗng.

- [ ] **Step 7: Commit**

```bash
git add lib/jobs/recommend-actions.ts "app/jobs/recommendations/RecommendClient.tsx" "app/jobs/recommendations/page.tsx" app/jobs/page.tsx
git commit -m "feat(jobs): AI job recommendations page"
```

---

## Self-Review (đã thực hiện)

- **Bao phủ spec:** §2 tìm kiếm `?q` → Task 2. §3 SavedJob + toggle + nút + trang saved → Task 1/3/4. §4 gợi ý AI (schema/prompt/request/core/action/trang) → Task 5/6/7/8. §5 xử lý lỗi → lỗi mềm trong core (Task 7) + action (Task 8) + toggle (Task 3). §6 test → Task 5/6/7 (TDD thuần). §7 cấu trúc thư mục ↔ file trong các task. §8 thứ tự ↔ thứ tự task.
- **Placeholder:** không còn TBD/TODO; mọi bước có code hoặc lệnh cụ thể.
- **Nhất quán kiểu:** `toggleSaveJob` (Task 3) ↔ `SaveJobButton` (Task 4); `recommendationResultSchema`/`RecommendationResult` (Task 5) ↔ Task 6/7; `buildRecommendationPrompt(cv, jobs)`/`RecommendationJob` (Task 6) ↔ core (Task 7); `runRecommendations`/`RecommendationJobInput`/`RecommendationItem`/`RunRecommendationsOutcome`/`MAX_RECOMMEND_JOBS` (Task 7) ↔ action (Task 8); `recommendJobs(cvId)` (Task 8) ↔ `RecommendClient`. `isCandidate`/`savedIds` thêm ở Task 4 dùng lại trong Task 8's link block.
```
