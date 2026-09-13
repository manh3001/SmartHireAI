# Insight lương theo ngành — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trang công khai `/salaries` thống kê khoảng lương phổ biến (trung vị) theo ngành từ dữ liệu tin sẵn có.

**Architecture:** Một helper thuần `lib/salary/insights.ts` (median + gom nhóm theo ngành) được unit-test đầy đủ; trang server component `app/salaries/page.tsx` đọc tin `isPublic` rồi render bảng; thêm route vào sitemap và link ở Footer. Không schema, không AI.

**Tech Stack:** Next.js App Router (ĐỌC guide trong `node_modules/next/dist/docs/` trước khi viết), React server components, Prisma 6, Tailwind, lucide-react, vitest.

## Global Constraints

- Không schema mới, không migration, không gọi AI. Chỉ đọc `JobDescription` (`category`, `salaryMin`, `salaryMax`) của tin `isPublic`.
- Trang `/salaries` CÔNG KHAI (không `auth()`/redirect), như `/jobs/[id]`.
- Tiếng Việt cho mọi văn bản UI; Tailwind tokens; prisma default import `@/lib/db/prisma`.
- Trung vị (median), không phải trung bình. "Ít dữ liệu" khi `sampleSize < 5`.
- Baseline 399 tests phải giữ xanh. Test: `npx vitest run <path>`; typecheck: `npx tsc --noEmit`.

---

### Task 1: Helper `median` + `computeSalaryInsights`

**Files:**
- Create: `lib/salary/insights.ts`
- Create: `lib/salary/__tests__/insights.test.ts`

**Interfaces:**
- Consumes: `JOB_CATEGORY_LABELS`, `normalizeCategory`, `JobCategory` từ `@/lib/jobs/job-categories`
- Produces:
  - `export function median(nums: number[]): number | null`
  - `export type CategorySalary = { category: JobCategory; label: string; sampleSize: number; medianMin: number | null; medianMax: number | null }`
  - `export function computeSalaryInsights(rows: { category: string | null; salaryMin: number | null; salaryMax: number | null }[]): CategorySalary[]`

- [ ] **Step 1: Viết test thất bại**

`lib/salary/__tests__/insights.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { median, computeSalaryInsights } from "../insights";

const M = 1_000_000;

describe("median", () => {
  it("rỗng -> null", () => {
    expect(median([])).toBeNull();
  });
  it("1 phần tử", () => {
    expect(median([5])).toBe(5);
  });
  it("lẻ -> phần tử giữa (không phụ thuộc thứ tự đầu vào)", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("chẵn -> trung bình 2 phần tử giữa", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("computeSalaryInsights", () => {
  it("gom theo ngành, tính median min/max + sampleSize", () => {
    const rows = [
      { category: "it", salaryMin: 10 * M, salaryMax: 20 * M },
      { category: "it", salaryMin: 20 * M, salaryMax: 40 * M },
    ];
    const out = computeSalaryInsights(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      category: "it",
      label: "Công nghệ thông tin",
      sampleSize: 2,
      medianMin: 15 * M,
      medianMax: 30 * M,
    });
  });

  it("tin chỉ-min hoặc chỉ-max: sampleSize đếm cả hai; median theo từng cột", () => {
    const rows = [
      { category: "design", salaryMin: 10 * M, salaryMax: null },
      { category: "design", salaryMin: null, salaryMax: 30 * M },
    ];
    const out = computeSalaryInsights(rows);
    expect(out[0].sampleSize).toBe(2);
    expect(out[0].medianMin).toBe(10 * M);
    expect(out[0].medianMax).toBe(30 * M);
  });

  it("category không nhận dạng/null -> gom vào 'other' (Khác)", () => {
    const rows = [
      { category: "xyz", salaryMin: 10 * M, salaryMax: null },
      { category: null, salaryMin: 12 * M, salaryMax: null },
    ];
    const out = computeSalaryInsights(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ category: "other", label: "Khác", sampleSize: 2 });
  });

  it("bỏ tin không có cả min lẫn max (thỏa thuận)", () => {
    const rows = [
      { category: "it", salaryMin: null, salaryMax: null },
      { category: "it", salaryMin: 10 * M, salaryMax: 20 * M },
    ];
    const out = computeSalaryInsights(rows);
    expect(out[0].sampleSize).toBe(1);
  });

  it("sắp theo medianMax giảm dần", () => {
    const rows = [
      { category: "hr", salaryMin: null, salaryMax: 15 * M },
      { category: "finance", salaryMin: null, salaryMax: 50 * M },
    ];
    const out = computeSalaryInsights(rows);
    expect(out.map((o) => o.category)).toEqual(["finance", "hr"]);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/salary/__tests__/insights.test.ts`
Expected: FAIL (`Cannot find module '../insights'`).

- [ ] **Step 3: Viết implementation**

`lib/salary/insights.ts`:
```ts
import { JOB_CATEGORY_LABELS, normalizeCategory, type JobCategory } from "@/lib/jobs/job-categories";

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export type CategorySalary = {
  category: JobCategory;
  label: string;
  sampleSize: number;
  medianMin: number | null;
  medianMax: number | null;
};

export function computeSalaryInsights(
  rows: { category: string | null; salaryMin: number | null; salaryMax: number | null }[],
): CategorySalary[] {
  const buckets = new Map<JobCategory, { mins: number[]; maxs: number[]; count: number }>();

  for (const r of rows) {
    if (r.salaryMin == null && r.salaryMax == null) continue;
    const cat = normalizeCategory(r.category) ?? "other";
    let b = buckets.get(cat);
    if (!b) {
      b = { mins: [], maxs: [], count: 0 };
      buckets.set(cat, b);
    }
    b.count += 1;
    if (r.salaryMin != null) b.mins.push(r.salaryMin);
    if (r.salaryMax != null) b.maxs.push(r.salaryMax);
  }

  const result: CategorySalary[] = [];
  for (const [category, b] of buckets) {
    result.push({
      category,
      label: JOB_CATEGORY_LABELS[category],
      sampleSize: b.count,
      medianMin: median(b.mins),
      medianMax: median(b.maxs),
    });
  }

  result.sort((a, b) => (b.medianMax ?? -1) - (a.medianMax ?? -1) || a.label.localeCompare(b.label, "vi"));
  return result;
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/salary/__tests__/insights.test.ts`
Expected: PASS (9 test).

- [ ] **Step 5: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: toàn bộ PASS (399 + 9 = 408).

- [ ] **Step 6: Commit**

```bash
git add lib/salary/insights.ts lib/salary/__tests__/insights.test.ts
git commit -m "feat(salary): median + computeSalaryInsights (thống kê lương theo ngành)"
```

---

### Task 2: Trang `/salaries` + Footer link + sitemap

**Files:**
- Create: `app/salaries/page.tsx`
- Modify: `components/Footer.tsx`
- Modify: `app/sitemap.ts`

**Interfaces:**
- Consumes: `computeSalaryInsights` (`@/lib/salary/insights`), `formatSalary` (`@/lib/jobs/salary`), `absoluteUrl` (`@/lib/seo/url`)

- [ ] **Step 1: Tạo trang `app/salaries/page.tsx`**

```tsx
import type { Metadata } from "next";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import { computeSalaryInsights } from "@/lib/salary/insights";
import { formatSalary } from "@/lib/jobs/salary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lương theo ngành | SmartHire",
  description: "Khoảng lương phổ biến theo ngành nghề, tổng hợp từ tin tuyển dụng trên SmartHire.",
  alternates: { canonical: "/salaries" },
};

export default async function SalariesPage() {
  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { category: true, salaryMin: true, salaryMax: true },
  });
  const insights = computeSalaryInsights(rows);
  const maxMedian = Math.max(1, ...insights.map((i) => i.medianMax ?? 0));

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-foreground">Lương theo ngành</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Khoảng lương phổ biến (trung vị) theo ngành, tổng hợp từ các tin tuyển dụng công khai.
        </p>
        {insights.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<BarChart3 className="h-10 w-10" />}
              title="Chưa đủ dữ liệu lương"
              description="Chưa có tin tuyển dụng nào có mức lương để thống kê."
            />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {insights.map((i) => (
              <div key={i.category} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{i.label}</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatSalary(i.medianMin, i.medianMax, false) ?? "—"}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-brand-gradient"
                    style={{ width: `${((i.medianMax ?? 0) / maxMedian) * 100}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {i.sampleSize} tin{i.sampleSize < 5 ? " · ít dữ liệu" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Thêm link ở Footer**

Trong `components/Footer.tsx`, cột "Ứng viên" (`<ul>` chứa link `/jobs` và `/dashboard`), thêm mục đầu tiên:
```tsx
            <li><Link href="/salaries" className="hover:text-foreground">Lương theo ngành</Link></li>
```

- [ ] **Step 3: Thêm route vào sitemap**

Trong `app/sitemap.ts`, mảng `staticRoutes`, thêm sau dòng `/jobs`:
```ts
    { url: absoluteUrl("/salaries"), changeFrequency: "weekly", priority: 0.6 },
```

- [ ] **Step 4: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: toàn bộ PASS (408, không đổi).

- [ ] **Step 5: Commit**

```bash
git add app/salaries/page.tsx components/Footer.tsx app/sitemap.ts
git commit -m "feat(salary): trang /salaries + link Footer + sitemap"
```

---

### Task 3: Kiểm chứng cuối

**Files:** (không sửa; chỉ chạy)

- [ ] **Step 1: Lint + typecheck + test đầy đủ**

Run:
```bash
npx tsc --noEmit
npm run lint
npx vitest run
```
Expected: tsc sạch; vitest 408 PASS. Lint: KHÔNG có lỗi MỚI so với baseline (đã tồn đọng sẵn 3 errors: ThemeToggle set-state-in-effect, recruiter-analytics.test no-explicit-any x2 — ngoài phạm vi). Nếu có lỗi lint ở file vòng này tạo/sửa, phải sửa.

- [ ] **Step 2: Chạy app soát mắt (khuyến nghị)**

Run: `npm run dev`, mở `/salaries` (kể cả khi CHƯA đăng nhập — trang công khai):
- Bảng ngành hiện khoảng lương trung vị + thanh bar + số tin (nhãn "ít dữ liệu" nếu <5).
- Nếu chưa có tin nào có lương → EmptyState.
- Link "Lương theo ngành" ở Footer trỏ đúng.

## Self-Review

- **Spec coverage:** helper median + computeSalaryInsights (Task 1) ✅ · trang /salaries công khai + metadata + bar + "ít dữ liệu" + EmptyState (Task 2) ✅ · sitemap (Task 2) ✅ · Footer link (Task 2) ✅ · unit test median + insights (Task 1) ✅ · kiểm chứng cuối (Task 3) ✅.
- **Placeholder scan:** không có TBD/TODO; mọi step code đầy đủ.
- **Type consistency:** `median`, `CategorySalary`, `computeSalaryInsights` dùng nhất quán; trang dùng đúng `formatSalary(min, max, negotiable)` (bậc 3 tham số) và `i.category`/`i.label`/`i.medianMin`/`i.medianMax`/`i.sampleSize` khớp type. `normalizeCategory(...) ?? "other"` hợp lệ vì "other" ∈ JobCategory và có trong JOB_CATEGORY_LABELS.
