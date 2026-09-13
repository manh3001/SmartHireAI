# Dọn nợ kỹ thuật (lint + cache /salaries) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xóa 3 lỗi lint tồn đọng và cache truy vấn dữ liệu lương của `/salaries` (giảm tải DB), không đổi hành vi người dùng.

**Architecture:** Sửa lint tại chỗ (type-cast đúng cho test; eslint-disable có chú thích cho mounted-gate). Tách lớp I/O có cache (`unstable_cache`) ra file kề `lib/salary/insights-data.ts` để `lib/salary/insights.ts` giữ thuần (test không kéo theo prisma/next).

**Tech Stack:** Next.js 16 App Router (`unstable_cache` đã dùng trong repo), Prisma 6, TypeScript, vitest, eslint.

## Global Constraints

- Không đổi hành vi người dùng — chỉ lint sạch + giảm tải DB cho /salaries.
- Prisma v6; prisma default import `@/lib/db/prisma`; theo mẫu cache ở `lib/notifications/poll.ts`.
- `lib/salary/insights.ts` (median/computeSalaryInsights) PHẢI giữ thuần (không import prisma/next).
- Baseline 412 tests giữ xanh; sau vòng này `npm run lint` KHÔNG còn 3 lỗi (ThemeToggle set-state-in-effect; recruiter-analytics.test no-explicit-any x2).
- Test: `npx vitest run`; typecheck: `npx tsc --noEmit`; lint: `npm run lint`.

---

### Task 1: Xóa 3 lỗi lint

**Files:**
- Modify: `lib/dashboard/__tests__/recruiter-analytics.test.ts`
- Modify: `components/ThemeToggle.tsx`

- [ ] **Step 1: Sửa `as any` trong test recruiter-analytics**

Trong `lib/dashboard/__tests__/recruiter-analytics.test.ts`:
1. Thêm import type ở đầu file (nếu chưa có):
```ts
import type { ApplicationStatus } from "@/lib/applications/status";
```
2. Thay `status: status as any` (trong `makeApp`) thành:
```ts
    status: status as ApplicationStatus,
```
3. Thay `{ ...makeApp("a3", "j1", "REJECTED"), status: "REJECTED" as any }` thành:
```ts
      { ...makeApp("a3", "j1", "REJECTED"), status: "REJECTED" as ApplicationStatus },
```
(Nếu còn chỗ `as any` nào khác trên `status` trong file, thay tương tự sang `as ApplicationStatus`.)

- [ ] **Step 2: Sửa lint ThemeToggle (mounted gate)**

Trong `components/ThemeToggle.tsx`, thay dòng 18:
```tsx
  React.useEffect(() => setMounted(true), []);
```
bằng:
```tsx
  // Pattern "mounted gate" của next-themes để tránh hydration mismatch (chạy 1 lần khi mount).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);
```

- [ ] **Step 3: Xác minh lint + typecheck + test**

Run: `npm run lint` → Expected: **0 error** (3 lỗi trên biến mất; các warning cũ không tính là error). 
Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 412 PASS (không đổi).

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard/__tests__/recruiter-analytics.test.ts components/ThemeToggle.tsx
git commit -m "chore(lint): sửa 3 lỗi lint tồn đọng (ThemeToggle + recruiter-analytics.test)"
```

---

### Task 2: Cache dữ liệu lương cho /salaries

**Files:**
- Create: `lib/salary/insights-data.ts`
- Modify: `app/salaries/page.tsx`

**Interfaces:**
- Consumes: `computeSalaryInsights`, `CategorySalary` (`@/lib/salary/insights`); `CACHE_TAGS` (`@/lib/cache/tags`); `prisma`
- Produces: `export async function getCachedSalaryInsights(): Promise<CategorySalary[]>`

- [ ] **Step 1: Tạo lớp I/O có cache**

`lib/salary/insights-data.ts`:
```ts
import { unstable_cache } from "next/cache";
import prisma from "@/lib/db/prisma";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { computeSalaryInsights, type CategorySalary } from "./insights";

async function fetchSalaryInsightsRaw(): Promise<CategorySalary[]> {
  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { category: true, salaryMin: true, salaryMax: true },
  });
  return computeSalaryInsights(rows);
}

const getCached = unstable_cache(
  fetchSalaryInsightsRaw,
  ["salary-insights"],
  { tags: [CACHE_TAGS.jobs], revalidate: 3600 },
);

export async function getCachedSalaryInsights(): Promise<CategorySalary[]> {
  return getCached();
}
```

- [ ] **Step 2: Dùng helper cache trong `app/salaries/page.tsx`**

Sửa `app/salaries/page.tsx`:
1. Xóa dòng `export const dynamic = "force-dynamic";`.
2. Xóa 2 import không còn dùng trực tiếp: `import prisma from "@/lib/db/prisma";` và `import { computeSalaryInsights } from "@/lib/salary/insights";`.
3. Thêm import: `import { getCachedSalaryInsights } from "@/lib/salary/insights-data";`.
4. Thay 3 dòng lấy dữ liệu:
```tsx
  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { category: true, salaryMin: true, salaryMax: true },
  });
  const insights = computeSalaryInsights(rows);
```
bằng:
```tsx
  const insights = await getCachedSalaryInsights();
```
(Giữ nguyên dòng `const maxMedian = Math.max(1, ...insights.map((i) => i.medianMax ?? 0));` và phần render.)

- [ ] **Step 3: Typecheck + test + lint**

Run: `npx tsc --noEmit` → Expected: không lỗi (không còn import thừa).
Run: `npx vitest run` → Expected: 412 PASS (helper thuần `insights.ts` không đổi).
Run: `npm run lint` → Expected: 0 error, không cảnh báo "unused import" ở `app/salaries/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add lib/salary/insights-data.ts app/salaries/page.tsx
git commit -m "perf(salary): cache dữ liệu /salaries (unstable_cache 1h, tag jobs)"
```

---

### Task 3: Kiểm chứng cuối

**Files:** (không sửa; chỉ chạy)

- [ ] **Step 1: Lint + typecheck + test đầy đủ**

Run:
```bash
npm run lint
npx tsc --noEmit
npx vitest run
```
Expected: `npm run lint` **0 error** (có thể còn vài warning không phải error, chấp nhận); tsc sạch; vitest 412 PASS.

- [ ] **Step 2: Soát mắt (khuyến nghị)**

Run: `npm run dev`, mở `/salaries` — bảng lương hiển thị đúng như trước (không đổi giao diện); đổi theme ở Navbar vẫn hoạt động.

## Self-Review

- **Spec coverage:** lint recruiter-analytics.test (Task 1) ✅ · lint ThemeToggle (Task 1) ✅ · cache /salaries + bỏ force-dynamic (Task 2) ✅ · giữ insights.ts thuần (Task 2 tách file insights-data.ts) ✅ · kiểm chứng lint/tsc/test (Task 3) ✅.
- **Placeholder scan:** không có TBD/TODO; mọi step có lệnh/code cụ thể.
- **Type consistency:** `getCachedSalaryInsights(): Promise<CategorySalary[]>` khớp `CategorySalary` từ insights.ts; page dùng `insights` y như trước; `ApplicationStatus` import đúng từ `@/lib/applications/status`.
