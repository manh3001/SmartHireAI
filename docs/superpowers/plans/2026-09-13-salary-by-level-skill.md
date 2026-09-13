# Mở rộng /salaries — lương theo cấp bậc & top kỹ năng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bảng "lương theo cấp bậc" và "top kỹ năng lương cao" vào `/salaries`, tái dùng logic median sẵn có.

**Architecture:** Thêm 2 helper thuần (`computeSalaryByLevel`, `computeSalaryBySkill`) vào `lib/salary/insights.ts` (rút gọn phần gom min/max thành helper nội bộ dùng chung, giữ `computeSalaryInsights` bất biến). Lớp cache gộp 1 truy vấn tính cả 3 bảng. UI dùng một component bảng chung `SalaryTable`. Không schema mới.

**Tech Stack:** Next.js 16 App Router, Prisma 6, Tailwind, vitest.

## Global Constraints

- `lib/salary/insights.ts` PHẢI giữ thuần (không prisma/next). Cache qua `unstable_cache` (mẫu `lib/notifications/poll.ts`), tag `CACHE_TAGS.jobs`, revalidate 3600.
- `computeSalaryInsights` (theo ngành) giữ nguyên chữ ký + kết quả sau refactor.
- `MIN_SKILL_SAMPLE = 3`; top kỹ năng `limit = 8`. Cấp bậc sắp theo thứ tự `EXPERIENCE_LEVELS` (INTERN→JUNIOR→MID→SENIOR→LEAD). "ít dữ liệu" khi `sampleSize < 5`.
- Tiếng Việt; Tailwind tokens; prisma default import `@/lib/db/prisma`.
- Baseline 412 tests giữ xanh. Test: `npx vitest run <path>`; typecheck `npx tsc --noEmit`; lint `npm run lint` (0 error).

---

### Task 1: Helper `computeSalaryByLevel` + `computeSalaryBySkill` (+ refactor nội bộ)

**Files:**
- Modify: `lib/salary/insights.ts`
- Modify: `lib/salary/__tests__/insights.test.ts`

**Interfaces:**
- Consumes: `median` (sẵn có); `EXPERIENCE_LEVELS`, `EXPERIENCE_LEVEL_LABELS`, `ExperienceLevel` (`@/lib/jobs/job-fields`)
- Produces:
  - `export type SalaryBarRow = { label: string; sampleSize: number; medianMin: number | null; medianMax: number | null }`
  - `export const MIN_SKILL_SAMPLE = 3`
  - `export function computeSalaryByLevel(rows: { experienceLevel: string | null; salaryMin: number | null; salaryMax: number | null }[]): SalaryBarRow[]`
  - `export function computeSalaryBySkill(rows: { skills: string; salaryMin: number | null; salaryMax: number | null }[], limit?: number): SalaryBarRow[]`

- [ ] **Step 1: Viết test thất bại**

Trong `lib/salary/__tests__/insights.test.ts`, cập nhật dòng import và thêm import labels + test. Sửa import đầu file:
```ts
import { median, computeSalaryInsights, computeSalaryByLevel, computeSalaryBySkill } from "../insights";
import { EXPERIENCE_LEVEL_LABELS } from "@/lib/jobs/job-fields";
```
Thêm vào cuối file (giữ `const M = 1_000_000;` đã có ở đầu file):
```ts
describe("computeSalaryByLevel", () => {
  it("gom theo cấp, sắp theo thứ tự cấp bậc (không theo median)", () => {
    const rows = [
      { experienceLevel: "SENIOR", salaryMin: null, salaryMax: 50 * M },
      { experienceLevel: "INTERN", salaryMin: null, salaryMax: 10 * M },
    ];
    const out = computeSalaryByLevel(rows);
    expect(out).toHaveLength(2);
    expect(out[0].label).toBe(EXPERIENCE_LEVEL_LABELS.INTERN);
    expect(out[0].medianMax).toBe(10 * M);
    expect(out[1].label).toBe(EXPERIENCE_LEVEL_LABELS.SENIOR);
  });

  it("bỏ tin cấp bậc null/không hợp lệ và tin không có lương", () => {
    const rows = [
      { experienceLevel: null, salaryMin: 10 * M, salaryMax: null },
      { experienceLevel: "XXX", salaryMin: 10 * M, salaryMax: null },
      { experienceLevel: "MID", salaryMin: null, salaryMax: null },
      { experienceLevel: "MID", salaryMin: 20 * M, salaryMax: 30 * M },
    ];
    const out = computeSalaryByLevel(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ label: EXPERIENCE_LEVEL_LABELS.MID, sampleSize: 1, medianMin: 20 * M, medianMax: 30 * M });
  });
});

describe("computeSalaryBySkill", () => {
  it("tách + dedupe trong tin, gộp không phân biệt hoa thường", () => {
    const rows = [
      { skills: "React, React, node", salaryMin: null, salaryMax: 30 * M },
      { skills: "REACT", salaryMin: null, salaryMax: 40 * M },
      { skills: "react", salaryMin: null, salaryMax: 50 * M },
    ];
    const out = computeSalaryBySkill(rows);
    const react = out.find((r) => r.label.toLowerCase() === "react");
    expect(react?.sampleSize).toBe(3);
    expect(react?.label).toBe("React"); // dạng hiển thị lần đầu
  });

  it("loại kỹ năng dưới ngưỡng mẫu (>=3)", () => {
    const rows = [
      { skills: "Go", salaryMin: null, salaryMax: 40 * M },
      { skills: "Go", salaryMin: null, salaryMax: 40 * M },
    ];
    expect(computeSalaryBySkill(rows)).toEqual([]);
  });

  it("sắp theo medianMax giảm dần và cắt theo limit", () => {
    const rows = [
      { skills: "A", salaryMin: null, salaryMax: 10 * M },
      { skills: "A", salaryMin: null, salaryMax: 10 * M },
      { skills: "A", salaryMin: null, salaryMax: 10 * M },
      { skills: "B", salaryMin: null, salaryMax: 90 * M },
      { skills: "B", salaryMin: null, salaryMax: 90 * M },
      { skills: "B", salaryMin: null, salaryMax: 90 * M },
    ];
    const out = computeSalaryBySkill(rows, 1);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("B");
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/salary/__tests__/insights.test.ts`
Expected: FAIL (`computeSalaryByLevel`/`computeSalaryBySkill` chưa export).

- [ ] **Step 3: Refactor + thêm helper trong `lib/salary/insights.ts`**

Thay toàn bộ `lib/salary/insights.ts` bằng:
```ts
import { JOB_CATEGORY_LABELS, normalizeCategory, type JobCategory } from "@/lib/jobs/job-categories";
import { EXPERIENCE_LEVELS, EXPERIENCE_LEVEL_LABELS, type ExperienceLevel } from "@/lib/jobs/job-fields";

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

export type SalaryBarRow = {
  label: string;
  sampleSize: number;
  medianMin: number | null;
  medianMax: number | null;
};

export const MIN_SKILL_SAMPLE = 3;

type SalaryRow = { salaryMin: number | null; salaryMax: number | null };
type Bucket = { mins: number[]; maxs: number[]; count: number };

function newBucket(): Bucket {
  return { mins: [], maxs: [], count: 0 };
}

function hasSalary(row: SalaryRow): boolean {
  return row.salaryMin != null || row.salaryMax != null;
}

function addRow(b: Bucket, row: SalaryRow): void {
  b.count += 1;
  if (row.salaryMin != null) b.mins.push(row.salaryMin);
  if (row.salaryMax != null) b.maxs.push(row.salaryMax);
}

function bySalaryDesc(a: SalaryBarRow, b: SalaryBarRow): number {
  return (b.medianMax ?? -1) - (a.medianMax ?? -1) || a.label.localeCompare(b.label, "vi");
}

export function computeSalaryInsights(
  rows: { category: string | null; salaryMin: number | null; salaryMax: number | null }[],
): CategorySalary[] {
  const buckets = new Map<JobCategory, Bucket>();
  for (const r of rows) {
    if (!hasSalary(r)) continue;
    const cat = normalizeCategory(r.category) ?? "other";
    let b = buckets.get(cat);
    if (!b) {
      b = newBucket();
      buckets.set(cat, b);
    }
    addRow(b, r);
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
  result.sort(bySalaryDesc);
  return result;
}

export function computeSalaryByLevel(
  rows: { experienceLevel: string | null; salaryMin: number | null; salaryMax: number | null }[],
): SalaryBarRow[] {
  const buckets = new Map<ExperienceLevel, Bucket>();
  for (const r of rows) {
    if (!hasSalary(r)) continue;
    if (r.experienceLevel == null || !(EXPERIENCE_LEVELS as readonly string[]).includes(r.experienceLevel)) continue;
    const level = r.experienceLevel as ExperienceLevel;
    let b = buckets.get(level);
    if (!b) {
      b = newBucket();
      buckets.set(level, b);
    }
    addRow(b, r);
  }

  const result: SalaryBarRow[] = [];
  for (const level of EXPERIENCE_LEVELS) {
    const b = buckets.get(level);
    if (!b) continue;
    result.push({
      label: EXPERIENCE_LEVEL_LABELS[level],
      sampleSize: b.count,
      medianMin: median(b.mins),
      medianMax: median(b.maxs),
    });
  }
  return result;
}

export function computeSalaryBySkill(
  rows: { skills: string; salaryMin: number | null; salaryMax: number | null }[],
  limit = 8,
): SalaryBarRow[] {
  const buckets = new Map<string, { label: string; bucket: Bucket }>();
  for (const r of rows) {
    if (!hasSalary(r)) continue;
    const seen = new Set<string>();
    for (const raw of (r.skills ?? "").split(",")) {
      const skill = raw.trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      let entry = buckets.get(key);
      if (!entry) {
        entry = { label: skill, bucket: newBucket() };
        buckets.set(key, entry);
      }
      addRow(entry.bucket, r);
    }
  }

  const result: SalaryBarRow[] = [];
  for (const { label, bucket } of buckets.values()) {
    if (bucket.count < MIN_SKILL_SAMPLE) continue;
    result.push({
      label,
      sampleSize: bucket.count,
      medianMin: median(bucket.mins),
      medianMax: median(bucket.maxs),
    });
  }
  result.sort(bySalaryDesc);
  return result.slice(0, limit);
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/salary/__tests__/insights.test.ts`
Expected: PASS (test cũ computeSalaryInsights/median + 5 test mới).

- [ ] **Step 5: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: toàn bộ PASS (412 + 5 = 417).

- [ ] **Step 6: Commit**

```bash
git add lib/salary/insights.ts lib/salary/__tests__/insights.test.ts
git commit -m "feat(salary): computeSalaryByLevel + computeSalaryBySkill (refactor bucket dùng chung)"
```

---

### Task 2: Cache gộp + UI 3 bảng

**Files:**
- Modify: `lib/salary/insights-data.ts`
- Create: `components/salary/SalaryTable.tsx`
- Modify: `app/salaries/page.tsx`
- Modify: `components/Footer.tsx`

**Interfaces:**
- Consumes: `computeSalaryInsights`, `computeSalaryByLevel`, `computeSalaryBySkill`, `CategorySalary`, `SalaryBarRow` (`@/lib/salary/insights`)
- Produces:
  - `export type SalaryData = { byCategory: CategorySalary[]; byLevel: SalaryBarRow[]; bySkill: SalaryBarRow[] }`
  - `export async function getCachedSalaryData(): Promise<SalaryData>`
  - `SalaryTable` (component, prop `rows: SalaryBarRow[]`)

- [ ] **Step 1: Cache gộp trong `lib/salary/insights-data.ts`**

Thay toàn bộ file bằng:
```ts
import { unstable_cache } from "next/cache";
import prisma from "@/lib/db/prisma";
import { CACHE_TAGS } from "@/lib/cache/tags";
import {
  computeSalaryInsights,
  computeSalaryByLevel,
  computeSalaryBySkill,
  type CategorySalary,
  type SalaryBarRow,
} from "./insights";

export type SalaryData = {
  byCategory: CategorySalary[];
  byLevel: SalaryBarRow[];
  bySkill: SalaryBarRow[];
};

async function fetchSalaryDataRaw(): Promise<SalaryData> {
  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { category: true, experienceLevel: true, skills: true, salaryMin: true, salaryMax: true },
  });
  return {
    byCategory: computeSalaryInsights(rows),
    byLevel: computeSalaryByLevel(rows),
    bySkill: computeSalaryBySkill(rows),
  };
}

const getCached = unstable_cache(
  fetchSalaryDataRaw,
  ["salary-data"],
  { tags: [CACHE_TAGS.jobs], revalidate: 3600 },
);

export async function getCachedSalaryData(): Promise<SalaryData> {
  return getCached();
}
```

- [ ] **Step 2: Component bảng dùng chung `components/salary/SalaryTable.tsx`**

```tsx
import { formatSalary } from "@/lib/jobs/salary";
import type { SalaryBarRow } from "@/lib/salary/insights";

export default function SalaryTable({ rows }: { rows: SalaryBarRow[] }) {
  if (rows.length === 0) return null;
  const maxMedian = Math.max(1, ...rows.map((r) => r.medianMax ?? 0));
  return (
    <div className="mt-4 flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground">{r.label}</span>
            <span className="text-sm font-medium text-foreground">
              {formatSalary(r.medianMin, r.medianMax, false) ?? "—"}
            </span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-brand-gradient"
              style={{ width: `${((r.medianMax ?? 0) / maxMedian) * 100}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {r.sampleSize} tin{r.sampleSize < 5 ? " · ít dữ liệu" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Trang 3 mục — thay toàn bộ `app/salaries/page.tsx`**

```tsx
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import { getCachedSalaryData } from "@/lib/salary/insights-data";
import SalaryTable from "@/components/salary/SalaryTable";
import type { SalaryBarRow } from "@/lib/salary/insights";

export const metadata: Metadata = {
  title: "Thống kê lương theo ngành, cấp bậc & kỹ năng | SmartHire",
  description: "Khoảng lương phổ biến theo ngành nghề, cấp bậc và kỹ năng, tổng hợp từ tin tuyển dụng trên SmartHire.",
  alternates: { canonical: "/salaries" },
};

export default async function SalariesPage() {
  const { byCategory, byLevel, bySkill } = await getCachedSalaryData();
  const categoryRows: SalaryBarRow[] = byCategory.map((c) => ({
    label: c.label,
    sampleSize: c.sampleSize,
    medianMin: c.medianMin,
    medianMax: c.medianMax,
  }));
  const empty = byCategory.length === 0 && byLevel.length === 0 && bySkill.length === 0;

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-foreground">Thống kê lương</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Khoảng lương phổ biến (trung vị) theo ngành, cấp bậc và kỹ năng, tổng hợp từ các tin tuyển dụng công khai.
        </p>
        {empty ? (
          <div className="mt-8">
            <EmptyState
              icon={<BarChart3 className="h-10 w-10" />}
              title="Chưa đủ dữ liệu lương"
              description="Chưa có tin tuyển dụng nào có mức lương để thống kê."
            />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-8">
            {categoryRows.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground">Theo ngành</h2>
                <SalaryTable rows={categoryRows} />
              </section>
            )}
            {byLevel.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground">Theo cấp bậc</h2>
                <SalaryTable rows={byLevel} />
              </section>
            )}
            {bySkill.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground">Top kỹ năng lương cao</h2>
                <SalaryTable rows={bySkill} />
              </section>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 4: Cập nhật nhãn link Footer**

Trong `components/Footer.tsx`, đổi text link `/salaries` từ "Lương theo ngành" thành "Thống kê lương":
```tsx
            <li><Link href="/salaries" className="hover:text-foreground">Thống kê lương</Link></li>
```

- [ ] **Step 5: Typecheck + test + lint**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 417 PASS (không đổi).
Run: `npm run lint` → Expected: 0 error (không import thừa).

- [ ] **Step 6: Commit**

```bash
git add lib/salary/insights-data.ts components/salary/SalaryTable.tsx app/salaries/page.tsx components/Footer.tsx
git commit -m "feat(salary): /salaries thêm bảng theo cấp bậc & top kỹ năng"
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
Expected: tsc sạch; `npm run lint` 0 error; vitest 417 PASS.

- [ ] **Step 2: Soát mắt (khuyến nghị)**

Run: `npm run dev`, mở `/salaries` (không cần đăng nhập):
- 3 mục "Theo ngành", "Theo cấp bậc" (thứ tự Intern→Lead), "Top kỹ năng lương cao" hiển thị đúng; mục nào rỗng thì ẩn; nếu không có dữ liệu nào → EmptyState.
- Link Footer "Thống kê lương" trỏ `/salaries`.

## Self-Review

- **Spec coverage:** computeSalaryByLevel (Task 1) ✅ · computeSalaryBySkill + ngưỡng 3 + top 8 (Task 1) ✅ · refactor giữ computeSalaryInsights (Task 1) ✅ · cache gộp getCachedSalaryData (Task 2) ✅ · SalaryTable dùng chung + trang 3 mục + EmptyState (Task 2) ✅ · Footer (Task 2) ✅ · unit test 2 helper (Task 1) ✅ · kiểm chứng (Task 3) ✅.
- **Placeholder scan:** không có TBD/TODO; mọi step code đầy đủ.
- **Type consistency:** `SalaryBarRow` dùng thống nhất ở helper/insights-data/SalaryTable/page; `getCachedSalaryData(): Promise<SalaryData>`; category map sang `SalaryBarRow` trước khi đưa vào `SalaryTable`; `EXPERIENCE_LEVELS`/`EXPERIENCE_LEVEL_LABELS` import đúng.
