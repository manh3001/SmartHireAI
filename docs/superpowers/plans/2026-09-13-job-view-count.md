# Đếm lượt xem tin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đếm lượt xem mỗi tin (`/jobs/[id]`) qua beacon client + route handler chống trùng bằng cookie, hiển thị "N lượt xem" cho mọi người và cho recruiter.

**Architecture:** Cột `viewCount` trên JobDescription; client `ViewTracker` bắn `POST /api/jobs/[id]/view` một lần; route handler dùng helper thuần `recordView` (chống trùng theo cookie/ngày, loại chủ tin) rồi tăng đếm. Hiển thị ở trang tin + recruiter dashboard.

**Tech Stack:** Next.js 16 App Router (route handler `runtime nodejs`, `await params`, `await cookies()`), Prisma 6, vitest.

## Global Constraints

- Chỉ thêm 1 cột `viewCount Int @default(0)` (additive) qua `npm run db:push` + `npx prisma generate`.
- Logic `recordView` THUẦN (không prisma/next). Đếm qua beacon → route POST; render trang read-only.
- Chống trùng bằng MỘT cookie `viewed` dạng `YYYY-MM-DD|id1,id2,...` (reset theo ngày); loại lượt của chủ tin.
- Tiếng Việt; Tailwind tokens; prisma default import `@/lib/db/prisma`; `params` là Promise.
- Baseline 424 tests giữ xanh. Test `npx vitest run`; typecheck `npx tsc --noEmit`; lint `npm run lint` (0 error).

---

### Task 1: Schema `viewCount` + db push + generate

**Files:**
- Modify: `prisma/schema.prisma` (model `JobDescription`)

- [ ] **Step 1: Thêm cột**

Trong `model JobDescription`, thêm sau dòng `salaryNegotiable Boolean         @default(false)`:
```prisma
  viewCount        Int             @default(0)
```

- [ ] **Step 2: Áp DB**

Run: `npm run db:push`
Expected: "Your database is now in sync…". Nếu lỗi kết nối (P1001…), DỪNG, báo NEEDS_CONTEXT.

- [ ] **Step 3: Sinh client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client".

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` → Expected: không lỗi.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(views): thêm cột viewCount vào JobDescription"
```

---

### Task 2: Helper thuần `recordView`

**Files:**
- Create: `lib/jobs/view-count.ts`
- Create: `lib/jobs/__tests__/view-count.test.ts`

**Interfaces:**
- Produces: `export function recordView(cookieValue: string | undefined, jobId: string, today: string): { count: boolean; cookie: string }`

- [ ] **Step 1: Viết test thất bại**

`lib/jobs/__tests__/view-count.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { recordView } from "../view-count";

const TODAY = "2026-09-13";

describe("recordView", () => {
  it("cookie rỗng -> đếm, cookie mới today|jobId", () => {
    expect(recordView(undefined, "j1", TODAY)).toEqual({ count: true, cookie: "2026-09-13|j1" });
  });

  it("cùng ngày, cùng tin -> không đếm, giữ cookie", () => {
    const r = recordView("2026-09-13|j1", "j1", TODAY);
    expect(r).toEqual({ count: false, cookie: "2026-09-13|j1" });
  });

  it("cùng ngày, tin mới -> đếm, thêm id", () => {
    const r = recordView("2026-09-13|j1", "j2", TODAY);
    expect(r).toEqual({ count: true, cookie: "2026-09-13|j1,j2" });
  });

  it("ngày khác -> reset (đếm, cookie chỉ tin hiện tại)", () => {
    const r = recordView("2026-09-12|j1,j2", "j3", TODAY);
    expect(r).toEqual({ count: true, cookie: "2026-09-13|j3" });
  });

  it("cookie hỏng (không có '|') -> coi như mới, đếm", () => {
    const r = recordView("garbage", "j1", TODAY);
    expect(r).toEqual({ count: true, cookie: "2026-09-13|j1" });
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/jobs/__tests__/view-count.test.ts`
Expected: FAIL (`Cannot find module '../view-count'`).

- [ ] **Step 3: Viết implementation**

`lib/jobs/view-count.ts`:
```ts
export function recordView(
  cookieValue: string | undefined,
  jobId: string,
  today: string,
): { count: boolean; cookie: string } {
  const raw = cookieValue ?? "";
  const sep = raw.indexOf("|");
  const date = sep === -1 ? "" : raw.slice(0, sep);
  const ids = sep === -1 ? [] : raw.slice(sep + 1).split(",").filter(Boolean);

  if (date !== today) {
    return { count: true, cookie: `${today}|${jobId}` };
  }
  if (ids.includes(jobId)) {
    return { count: false, cookie: raw };
  }
  return { count: true, cookie: `${today}|${[...ids, jobId].join(",")}` };
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/jobs/__tests__/view-count.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 424 + 5 = 429 PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/jobs/view-count.ts lib/jobs/__tests__/view-count.test.ts
git commit -m "feat(views): recordView helper (chống trùng cookie/ngày)"
```

---

### Task 3: Route handler + beacon + hiển thị

**Files:**
- Create: `app/api/jobs/[id]/view/route.ts`
- Create: `components/jobs/ViewTracker.tsx`
- Modify: `app/jobs/[id]/page.tsx`
- Modify: `app/dashboard/page.tsx` (nhánh RECRUITER)

**Interfaces:**
- Consumes: `recordView` (`@/lib/jobs/view-count`), `auth` (`@/auth`), `prisma`, `cookies` (`next/headers`)

- [ ] **Step 1: Route handler `app/api/jobs/[id]/view/route.ts`**

```ts
import { cookies } from "next/headers";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { recordView } from "@/lib/jobs/view-count";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.jobDescription.findFirst({
    where: { id, isPublic: true },
    select: { userId: true },
  });
  if (!job) return new Response(null, { status: 204 });

  const session = await auth();
  if (session?.user?.id === job.userId) return new Response(null, { status: 204 }); // chủ tin, không đếm

  const store = await cookies();
  const today = new Date().toISOString().slice(0, 10);
  const { count, cookie } = recordView(store.get("viewed")?.value, id, today);
  if (count) {
    await prisma.jobDescription.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    store.set("viewed", cookie, {
      maxAge: 60 * 60 * 24 * 2,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2: Client beacon `components/jobs/ViewTracker.tsx`**

```tsx
"use client";

import { useEffect } from "react";

export default function ViewTracker({ jobId }: { jobId: string }) {
  useEffect(() => {
    fetch(`/api/jobs/${jobId}/view`, { method: "POST" }).catch(() => {});
  }, [jobId]);
  return null;
}
```

- [ ] **Step 3: Hiển thị + beacon trong `app/jobs/[id]/page.tsx`**

Thêm import (cùng nhóm import đầu file):
```ts
import ViewTracker from "@/components/jobs/ViewTracker";
```
Trong `prisma.jobDescription.findFirst` (biến `job`, KHÔNG phải trong `generateMetadata`), thêm `viewCount: true` vào `select`.
Trong JSX, ngay SAU dòng `<Link href="/jobs" ...>← Về danh sách</Link>`, thêm:
```tsx
        <p className="mt-2 text-xs text-muted-foreground">{job.viewCount} lượt xem</p>
        <ViewTracker jobId={job.id} />
```

- [ ] **Step 4: viewCount trên recruiter dashboard `app/dashboard/page.tsx`**

Trong nhánh `if (isRecruiter)`, `prisma.jobDescription.findMany` — thêm `viewCount: true` vào `select`. Sửa dòng meta:
```tsx
                        {j.company || "—"} · {new Date(j.createdAt).toLocaleDateString("vi-VN")} · {j._count.applications} ứng tuyển
```
thành:
```tsx
                        {j.company || "—"} · {new Date(j.createdAt).toLocaleDateString("vi-VN")} · {j._count.applications} ứng tuyển · {j.viewCount} lượt xem
```

- [ ] **Step 5: Typecheck + test + lint**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 429.
Run: `npm run lint` → Expected: 0 error.

- [ ] **Step 6: Chạy app soát mắt**

Run: `npm run dev`:
- Mở `/jobs/[id]` bằng tài khoản ứng viên/khách → sau khi tải, reload lại (cùng ngày) số "lượt xem" KHÔNG tăng lần 2; mở tin khác thì tăng.
- Recruiter mở tin của chính mình → không tăng.
- Dashboard recruiter hiện "· N lượt xem".
Nếu beacon/route lỗi → DỪNG, báo NEEDS_CONTEXT.

- [ ] **Step 7: Commit**

```bash
git add app/api/jobs/[id]/view/route.ts components/jobs/ViewTracker.tsx app/jobs/[id]/page.tsx app/dashboard/page.tsx
git commit -m "feat(views): route đếm lượt xem + ViewTracker + hiển thị (tin + dashboard)"
```

---

### Task 4: Kiểm chứng cuối

**Files:** (không sửa; chỉ chạy)

- [ ] **Step 1: Lint + typecheck + test đầy đủ**

Run:
```bash
npx tsc --noEmit
npm run lint
npx vitest run
```
Expected: tsc sạch; `npm run lint` 0 error; vitest 429 PASS.

## Self-Review

- **Spec coverage:** schema viewCount (Task 1) ✅ · recordView thuần + test (Task 2) ✅ · route handler chống trùng + loại chủ tin (Task 3) ✅ · ViewTracker beacon (Task 3) ✅ · hiển thị trang tin cho mọi người + dashboard recruiter (Task 3) ✅ · kiểm chứng (Task 4) ✅.
- **Placeholder scan:** không có TBD/TODO; mọi step có code/lệnh.
- **Type consistency:** `recordView(cookieValue, jobId, today) → {count, cookie}` khớp cách route dùng; `viewCount` select ở cả job detail + dashboard; `ViewTracker` prop `jobId`; route `await params` + `await cookies()` đúng Next 16.
