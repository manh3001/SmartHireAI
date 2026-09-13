# Ma trận lương ngành × cấp bậc — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bảng ma trận (cross-tab) lương ngành × cấp bậc vào /salaries, tính một lần và cache.

**Architecture:** Helper thuần `computeSalaryMatrix` (unit-test) đưa vào `getCachedSalaryData`; component bảng `SalaryMatrix` render cross-tab với overflow ngang. Không schema/DB, không dynamic.

**Tech Stack:** Next.js 16 App Router, React server components, Tailwind, vitest.

## Global Constraints

- Không schema/DB. Dùng lại query + cache `getCachedSalaryData` (đã select category/experienceLevel/salaryMin/salaryMax).
- `lib/salary/insights.ts` giữ THUẦN. Ô ma trận = `median` của `salaryMax ?? salaryMin`; cột theo `EXPERIENCE_LEVELS` (INTERN→LEAD); hàng theo `JOB_CATEGORIES` (đã gồm "other"/"Khác"), bỏ hàng toàn null.
- Tiếng Việt; Tailwind tokens; prisma default `@/lib/db/prisma`.
- Baseline 434 tests giữ xanh. Test `npx vitest run`; typecheck `npx tsc --noEmit`; lint `npm run lint` (0 error).

---

### Task 1: Helper `computeSalaryMatrix`

**Files:**
- Modify: `lib/salary/insights.ts`
- Modify: `lib/salary/__tests__/insights.test.ts`

**Interfaces:**
- Consumes: `median`, `EXPERIENCE_LEVELS`, `EXPERIENCE_LEVEL_LABELS`, `ExperienceLevel`, `JOB_CATEGORIES`, `JOB_CATEGORY_LABELS`, `normalizeCategory`, `JobCategory`
- Produces:
  - `export type SalaryMatrix = { levels: { level: ExperienceLevel; label: string }[]; rows: { label: string; cells: (number | null)[] }[] }`
  - `export function computeSalaryMatrix(rows: { category: string | null; experienceLevel: string | null; salaryMin: number | null; salaryMax: number | null }[]): SalaryMatrix`

- [ ] **Step 1: Viết test thất bại**

Trong `lib/salary/__tests__/insights.test.ts`, cập nhật import (thêm `computeSalaryMatrix` vào import từ `../insights`, và thêm `JOB_CATEGORY_LABELS`):
```ts
import { median, computeSalaryInsights, computeSalaryByLevel, computeSalaryBySkill, computeSalaryMatrix } from "../insights";
import { EXPERIENCE_LEVEL_LABELS } from "@/lib/jobs/job-fields";
import { JOB_CATEGORY_LABELS } from "@/lib/jobs/job-categories";
```
(Giữ các import cũ; `EXPERIENCE_LEVEL_LABELS` có thể đã import — nếu trùng thì gộp, không khai báo lại. `const M = 1_000_000;` đã có ở đầu file.)
Thêm vào cuối file:
```ts
describe("computeSalaryMatrix", () => {
  it("levels đúng thứ tự INTERN->LEAD; rỗng -> không hàng", () => {
    const m = computeSalaryMatrix([]);
    expect(m.levels.map((l) => l.level)).toEqual(["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD"]);
    expect(m.rows).toEqual([]);
  });

  it("gom theo ngành×cấp, median rep = salaryMax ?? salaryMin; ô rỗng = null", () => {
    const rows = [
      { category: "it", experienceLevel: "SENIOR", salaryMin: null, salaryMax: 40 * M },
      { category: "it", experienceLevel: "SENIOR", salaryMin: 20 * M, salaryMax: null },
    ];
    const m = computeSalaryMatrix(rows);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].label).toBe(JOB_CATEGORY_LABELS.it);
    const seniorIdx = m.levels.findIndex((l) => l.level === "SENIOR");
    const internIdx = m.levels.findIndex((l) => l.level === "INTERN");
    expect(m.rows[0].cells[seniorIdx]).toBe(30 * M);
    expect(m.rows[0].cells[internIdx]).toBeNull();
  });

  it("loại tin cấp bậc null/không hợp lệ + tin không lương; ngành lạ -> Khác", () => {
    const rows = [
      { category: "xyz", experienceLevel: "MID", salaryMin: null, salaryMax: 25 * M },
      { category: "it", experienceLevel: null, salaryMin: 10 * M, salaryMax: null },
      { category: "it", experienceLevel: "MID", salaryMin: null, salaryMax: null },
    ];
    const m = computeSalaryMatrix(rows);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].label).toBe(JOB_CATEGORY_LABELS.other);
    const midIdx = m.levels.findIndex((l) => l.level === "MID");
    expect(m.rows[0].cells[midIdx]).toBe(25 * M);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/salary/__tests__/insights.test.ts`
Expected: FAIL (`computeSalaryMatrix` chưa export).

- [ ] **Step 3: Viết implementation trong `lib/salary/insights.ts`**

Sửa dòng import job-categories để thêm `JOB_CATEGORIES`:
```ts
import { JOB_CATEGORIES, JOB_CATEGORY_LABELS, normalizeCategory, type JobCategory } from "@/lib/jobs/job-categories";
```
(`EXPERIENCE_LEVELS, EXPERIENCE_LEVEL_LABELS, type ExperienceLevel` đã import sẵn từ vòng trước.)
Thêm vào cuối file:
```ts
export type SalaryMatrix = {
  levels: { level: ExperienceLevel; label: string }[];
  rows: { label: string; cells: (number | null)[] }[];
};

export function computeSalaryMatrix(
  rows: { category: string | null; experienceLevel: string | null; salaryMin: number | null; salaryMax: number | null }[],
): SalaryMatrix {
  const buckets = new Map<JobCategory, Map<ExperienceLevel, number[]>>();
  for (const r of rows) {
    const rep = r.salaryMax ?? r.salaryMin;
    if (rep == null) continue;
    if (r.experienceLevel == null || !(EXPERIENCE_LEVELS as readonly string[]).includes(r.experienceLevel)) continue;
    const level = r.experienceLevel as ExperienceLevel;
    const cat = normalizeCategory(r.category) ?? "other";
    let byLevel = buckets.get(cat);
    if (!byLevel) {
      byLevel = new Map();
      buckets.set(cat, byLevel);
    }
    const arr = byLevel.get(level);
    if (arr) arr.push(rep);
    else byLevel.set(level, [rep]);
  }

  const levels = EXPERIENCE_LEVELS.map((level) => ({ level, label: EXPERIENCE_LEVEL_LABELS[level] }));

  const resultRows: { label: string; cells: (number | null)[] }[] = [];
  for (const c of JOB_CATEGORIES) {
    const byLevel = buckets.get(c.slug);
    if (!byLevel) continue;
    const cells = EXPERIENCE_LEVELS.map((level) => {
      const arr = byLevel.get(level);
      return arr ? median(arr) : null;
    });
    if (cells.every((x) => x === null)) continue;
    resultRows.push({ label: JOB_CATEGORY_LABELS[c.slug], cells });
  }

  return { levels, rows: resultRows };
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/salary/__tests__/insights.test.ts`
Expected: PASS (test cũ + 3 test matrix).

- [ ] **Step 5: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 434 + 3 = 437 PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/salary/insights.ts lib/salary/__tests__/insights.test.ts
git commit -m "feat(salary): computeSalaryMatrix (cross-tab ngành × cấp bậc)"
```

---

### Task 2: Cache + component + trang

**Files:**
- Modify: `lib/salary/insights-data.ts`
- Create: `components/salary/SalaryMatrix.tsx`
- Modify: `app/salaries/page.tsx`

**Interfaces:**
- Consumes: `computeSalaryMatrix`, `SalaryMatrix` (`@/lib/salary/insights`)
- Produces: `SalaryData` thêm `matrix: SalaryMatrix`; `SalaryMatrix` component (prop `{ matrix: SalaryMatrix }`)

- [ ] **Step 1: Thêm `matrix` vào cache `lib/salary/insights-data.ts`**

Sửa import từ `./insights` để thêm `computeSalaryMatrix` và type `SalaryMatrix`:
```ts
import {
  computeSalaryInsights,
  computeSalaryByLevel,
  computeSalaryBySkill,
  computeSalaryMatrix,
  type CategorySalary,
  type SalaryBarRow,
  type SalaryMatrix,
} from "./insights";
```
Sửa type `SalaryData` thêm `matrix`:
```ts
export type SalaryData = {
  byCategory: CategorySalary[];
  byLevel: SalaryBarRow[];
  bySkill: SalaryBarRow[];
  matrix: SalaryMatrix;
};
```
Trong `fetchSalaryDataRaw` return, thêm:
```ts
    matrix: computeSalaryMatrix(rows),
```

- [ ] **Step 2: Component `components/salary/SalaryMatrix.tsx`**

```tsx
import type { SalaryMatrix as SalaryMatrixData } from "@/lib/salary/insights";

export default function SalaryMatrix({ matrix }: { matrix: SalaryMatrixData }) {
  if (matrix.rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="p-2 text-left font-semibold text-foreground">Ngành</th>
            {matrix.levels.map((l) => (
              <th key={l.level} className="p-2 text-right font-medium text-muted-foreground">
                {l.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.label} className="border-b border-border/60">
              <td className="p-2 text-left font-medium text-foreground">{row.label}</td>
              {row.cells.map((cell, i) => (
                <td key={i} className="p-2 text-right text-foreground">
                  {cell == null ? "—" : `${Math.round(cell / 1_000_000)} tr`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Render mục ma trận trong `app/salaries/page.tsx`**

Thêm import:
```ts
import SalaryMatrix from "@/components/salary/SalaryMatrix";
```
Sửa destructure lấy thêm `matrix`:
```ts
  const { byCategory, byLevel, bySkill, matrix } = await getCachedSalaryData();
```
Trong khối `<div className="mt-6 flex flex-col gap-8">` (nhánh không rỗng), SAU section "Top kỹ năng lương cao" (`bySkill`), thêm:
```tsx
            {matrix.rows.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground">Ma trận lương theo ngành × cấp bậc</h2>
                <p className="mt-1 text-xs text-muted-foreground">Trung vị lương (triệu VND) theo ngành và cấp bậc.</p>
                <div className="mt-4">
                  <SalaryMatrix matrix={matrix} />
                </div>
              </section>
            )}
```

- [ ] **Step 4: Typecheck + test + lint**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 437 (không đổi).
Run: `npm run lint` → Expected: 0 error.

- [ ] **Step 5: Commit**

```bash
git add lib/salary/insights-data.ts components/salary/SalaryMatrix.tsx app/salaries/page.tsx
git commit -m "feat(salary): mục ma trận lương ngành × cấp bậc ở /salaries"
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
Expected: tsc sạch; `npm run lint` 0 error; vitest 437 PASS.

- [ ] **Step 2: Soát mắt (khuyến nghị)**

Run: `npm run dev`, mở `/salaries` (không đăng nhập): sau 3 bảng có mục "Ma trận lương theo ngành × cấp bậc" — bảng ngành×cấp bậc, ô là số triệu hoặc "—"; cuộn ngang được trên màn nhỏ; ẩn nếu không đủ dữ liệu.

## Self-Review

- **Spec coverage:** computeSalaryMatrix + type (Task 1) ✅ · rep salaryMax??salaryMin + loại level null + ngành lạ→Khác + bỏ hàng rỗng + levels order (Task 1 tests) ✅ · matrix vào getCachedSalaryData (Task 2) ✅ · SalaryMatrix component overflow-x-auto + ô "X tr"/"—" + ẩn khi rỗng (Task 2) ✅ · mục trên trang (Task 2) ✅ · kiểm chứng (Task 3) ✅.
- **Placeholder scan:** không có TBD/TODO; mọi step có code/lệnh.
- **Type consistency:** `SalaryMatrix` type dùng ở insights/insights-data/component (component alias `SalaryMatrixData` để tránh trùng tên default export); `computeSalaryMatrix` chữ ký khớp; page destructure `matrix` từ `getCachedSalaryData`.
