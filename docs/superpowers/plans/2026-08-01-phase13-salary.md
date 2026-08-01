# Phase 13 — Lương cho JD (Salary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm thông tin lương (khoảng min–max VND/tháng + cờ "Thỏa thuận") cho tin tuyển dụng: nhập khi đăng JD, hiển thị badge, lọc theo lương, và đưa vào context AI gợi ý.

**Architecture:** 3 trường mới trên `JobDescription` (Prisma). Một module thuần `lib/jobs/salary.ts` lo format/parse/where-clause, có unit test. Zod validate min≤max. UI dùng lại `JobMeta` (badge lan ra mọi trang) và form `jobs/new`. Lọc qua query param ở `/jobs`. Lương chảy vào AI qua `composeJdText`.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 6 + Postgres (Neon), Zod 4, Vitest, Tailwind, shadcn/ui.

## Global Constraints

- Prisma pinned v6 — KHÔNG nâng v7.
- Áp dụng schema bằng `npm run db:push` (dự án không dùng thư mục migrations).
- Mọi lệnh Prisma/DB chạy qua script npm đã có `NODE_OPTIONS=--dns-result-order=ipv4first` (tránh P1001 Neon IPv4).
- Lương lưu **đầy đủ VND** (người dùng nhập theo **triệu**, hệ nhân 1.000.000). Đơn vị cố định VND/tháng — không currency/period.
- UI text tiếng Việt, theo style hiện có (Tailwind + shadcn).
- Test bằng Vitest: `npm test` (chạy 1 lần) — theo pattern các file `__tests__` sẵn có.

---

### Task 1: Schema Prisma — thêm 3 trường lương

**Files:**
- Modify: `prisma/schema.prisma` (model `JobDescription`)

**Interfaces:**
- Produces: các trường Prisma `salaryMin: Int?`, `salaryMax: Int?`, `salaryNegotiable: Boolean` trên `JobDescription`; client Prisma regenerate.

- [ ] **Step 1: Thêm trường vào model `JobDescription`**

Trong `prisma/schema.prisma`, ngay sau dòng `skills           String          @default("")` của model `JobDescription`, thêm:

```prisma
  salaryMin        Int?
  salaryMax        Int?
  salaryNegotiable Boolean         @default(false)
```

- [ ] **Step 2: Đẩy schema lên DB + regenerate client**

Run: `npm run db:push`
Expected: kết thúc bằng "Your database is now in sync with your Prisma schema." và "Generated Prisma Client". Không lỗi P1001.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add salary fields to JobDescription"
```

---

### Task 2: Module `lib/jobs/salary.ts` (format / parse / where)

**Files:**
- Create: `lib/jobs/salary.ts`
- Test: `lib/jobs/__tests__/salary.test.ts`

**Interfaces:**
- Produces:
  - `formatSalary(min: number | null, max: number | null, negotiable: boolean): string | null` — nhận VND, trả chuỗi hiển thị theo **triệu** hoặc `null`.
  - `parseSalaryInput(raw: string): number | null` — nhận chuỗi số **triệu**, trả VND (int) hoặc `null`.
  - `salaryWhere(minMillions: number | null): Record<string, unknown>` — mảnh Prisma `where` lọc "từ minMillions triệu trở lên"; `null` → `{}`.
  - `SALARY_FILTER_STEPS: readonly number[]` — các mốc triệu cho bộ lọc.

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/jobs/__tests__/salary.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  formatSalary,
  parseSalaryInput,
  salaryWhere,
  SALARY_FILTER_STEPS,
} from "../salary";

describe("formatSalary", () => {
  it("đủ khoảng min–max", () => {
    expect(formatSalary(15_000_000, 25_000_000, false)).toBe("15 – 25 triệu");
  });
  it("chỉ sàn", () => {
    expect(formatSalary(15_000_000, null, false)).toBe("Từ 15 triệu");
  });
  it("chỉ trần", () => {
    expect(formatSalary(null, 25_000_000, false)).toBe("Tới 25 triệu");
  });
  it("không số + thỏa thuận -> Thỏa thuận", () => {
    expect(formatSalary(null, null, true)).toBe("Thỏa thuận");
  });
  it("không số + không thỏa thuận -> null", () => {
    expect(formatSalary(null, null, false)).toBeNull();
  });
  it("số lẻ triệu hiển thị 1 chữ số thập phân", () => {
    expect(formatSalary(12_500_000, null, false)).toBe("Từ 12.5 triệu");
  });
  it("có số thì bỏ qua cờ thỏa thuận", () => {
    expect(formatSalary(20_000_000, 30_000_000, true)).toBe("20 – 30 triệu");
  });
});

describe("parseSalaryInput", () => {
  it("số triệu -> VND", () => {
    expect(parseSalaryInput("20")).toBe(20_000_000);
  });
  it("chấp nhận dấu phẩy thập phân", () => {
    expect(parseSalaryInput("12,5")).toBe(12_500_000);
  });
  it("rỗng -> null", () => {
    expect(parseSalaryInput("")).toBeNull();
    expect(parseSalaryInput("   ")).toBeNull();
  });
  it("rác -> null", () => {
    expect(parseSalaryInput("abc")).toBeNull();
  });
  it("số âm -> null", () => {
    expect(parseSalaryInput("-5")).toBeNull();
  });
});

describe("salaryWhere", () => {
  it("null -> rỗng", () => {
    expect(salaryWhere(null)).toEqual({});
  });
  it("dựng OR theo salaryMax, fallback salaryMin", () => {
    expect(salaryWhere(15)).toEqual({
      OR: [
        { salaryMax: { gte: 15_000_000 } },
        { AND: [{ salaryMax: null }, { salaryMin: { gte: 15_000_000 } }] },
      ],
    });
  });
});

describe("SALARY_FILTER_STEPS", () => {
  it("có các mốc tăng dần", () => {
    expect(SALARY_FILTER_STEPS).toEqual([10, 15, 20, 25, 30, 40, 50]);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- salary`
Expected: FAIL — "Failed to resolve import ../salary" hoặc "formatSalary is not a function".

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `lib/jobs/salary.ts`:

```ts
export const SALARY_FILTER_STEPS = [10, 15, 20, 25, 30, 40, 50] as const;

const MILLION = 1_000_000;

// VND -> chuỗi triệu, bỏ ".0" thừa, giữ tối đa 1 chữ số thập phân.
function toMillions(vnd: number): string {
  const m = Math.round((vnd / MILLION) * 10) / 10;
  return Number.isInteger(m) ? String(m) : m.toFixed(1);
}

export function formatSalary(
  min: number | null,
  max: number | null,
  negotiable: boolean,
): string | null {
  if (min != null && max != null) return `${toMillions(min)} – ${toMillions(max)} triệu`;
  if (min != null) return `Từ ${toMillions(min)} triệu`;
  if (max != null) return `Tới ${toMillions(max)} triệu`;
  if (negotiable) return "Thỏa thuận";
  return null;
}

// Chuỗi số triệu người dùng nhập -> VND (int). Rỗng/không hợp lệ/âm -> null.
export function parseSalaryInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * MILLION);
}

// Mảnh Prisma where: job có thể trả >= minMillions triệu.
export function salaryWhere(minMillions: number | null): Record<string, unknown> {
  if (minMillions == null) return {};
  const vnd = minMillions * MILLION;
  return {
    OR: [
      { salaryMax: { gte: vnd } },
      { AND: [{ salaryMax: null }, { salaryMin: { gte: vnd } }] },
    ],
  };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- salary`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/salary.ts lib/jobs/__tests__/salary.test.ts
git commit -m "feat(jobs): salary format/parse/where module"
```

---

### Task 3: Zod validate lương trong `jobSchema`

**Files:**
- Modify: `lib/jobs/schema.ts`
- Test: `lib/jobs/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: không có (chỉ mở rộng `jobSchema`).
- Produces: `jobSchema` nhận thêm `salaryMin: number|null`, `salaryMax: number|null`, `salaryNegotiable: boolean`; refine `min <= max` khi cả hai có mặt. `JobInput` cập nhật theo.

- [ ] **Step 1: Cập nhật test (thêm base + ca mới)**

Trong `lib/jobs/__tests__/schema.test.ts`, sửa `base` để có trường lương và thêm các ca. Thay object `base` hiện tại thành:

```ts
const base = {
  title: "Frontend",
  company: "ACME",
  rawText: "Mô tả",
  location: "Hà Nội",
  skills: "React",
  employmentType: "FULL_TIME",
  experienceLevel: "SENIOR",
  salaryMin: 15_000_000,
  salaryMax: 25_000_000,
  salaryNegotiable: false,
};
```

Thêm vào trong `describe("jobSchema", ...)` các ca:

```ts
  it("min > max -> lỗi", () => {
    const r = jobSchema.safeParse({ ...base, salaryMin: 30_000_000, salaryMax: 10_000_000 });
    expect(r.success).toBe(false);
  });

  it("lương âm -> lỗi", () => {
    expect(jobSchema.safeParse({ ...base, salaryMin: -1 }).success).toBe(false);
  });

  it("chỉ có một đầu lương vẫn hợp lệ", () => {
    expect(jobSchema.safeParse({ ...base, salaryMin: 15_000_000, salaryMax: null }).success).toBe(true);
    expect(jobSchema.safeParse({ ...base, salaryMin: null, salaryMax: 25_000_000 }).success).toBe(true);
  });

  it("không lương (null cả hai) vẫn hợp lệ", () => {
    const r = jobSchema.safeParse({ ...base, salaryMin: null, salaryMax: null, salaryNegotiable: true });
    expect(r.success).toBe(true);
  });
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- jobs/__tests__/schema`
Expected: FAIL — các ca "min > max", "lương âm" chưa được chặn (safeParse trả success=true).

- [ ] **Step 3: Cập nhật `jobSchema`**

Trong `lib/jobs/schema.ts`, thêm 3 field và refine. Sửa object schema thành:

```ts
export const jobSchema = z
  .object({
    title: z.string().min(1, "Vui lòng nhập tiêu đề"),
    company: z.string(),
    rawText: z.string().min(1, "Vui lòng nhập mô tả công việc"),
    location: z.string(),
    skills: z.string(),
    employmentType: z.preprocess(emptyToNull, z.enum(EMPLOYMENT_TYPES).nullable()),
    experienceLevel: z.preprocess(emptyToNull, z.enum(EXPERIENCE_LEVELS).nullable()),
    salaryMin: z.number().int().nonnegative().nullable(),
    salaryMax: z.number().int().nonnegative().nullable(),
    salaryNegotiable: z.boolean(),
  })
  .refine(
    (d) => d.salaryMin == null || d.salaryMax == null || d.salaryMin <= d.salaryMax,
    { message: "Lương tối thiểu không được lớn hơn tối đa", path: ["salaryMax"] },
  );
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- jobs/__tests__/schema`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/schema.ts lib/jobs/__tests__/schema.test.ts
git commit -m "feat(jobs): validate salary min<=max in jobSchema"
```

---

### Task 4: Lương vào `composeJdText` (AI context)

**Files:**
- Modify: `lib/jobs/job-fields.ts`
- Test: `lib/jobs/__tests__/job-fields.test.ts`

**Interfaces:**
- Consumes: `formatSalary` từ `./salary` (Task 2).
- Produces: `JobTextInput` thêm optional `salaryMin?`, `salaryMax?`, `salaryNegotiable?`; `composeJdText` chèn dòng `"Mức lương: <formatSalary>"` khi có.

- [ ] **Step 1: Thêm test thất bại**

Trong `lib/jobs/__tests__/job-fields.test.ts`, thêm vào `describe("composeJdText", ...)`:

```ts
  it("chèn dòng lương khi có", () => {
    const out = composeJdText({
      rawText: "Mô tả",
      salaryMin: 15_000_000,
      salaryMax: 25_000_000,
      salaryNegotiable: false,
    });
    expect(out).toContain("Mức lương: 15 – 25 triệu");
  });

  it("không có lương thì không chèn dòng lương", () => {
    const out = composeJdText({ rawText: "Mô tả" });
    expect(out).not.toContain("Mức lương");
  });
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- job-fields`
Expected: FAIL — "Mức lương: 15 – 25 triệu" không có trong output.

- [ ] **Step 3: Cập nhật `job-fields.ts`**

Thêm import ở đầu file:

```ts
import { formatSalary } from "./salary";
```

Mở rộng type `JobTextInput` (thêm 3 dòng optional):

```ts
export type JobTextInput = {
  location?: string | null;
  employmentType?: EmploymentType | null;
  experienceLevel?: ExperienceLevel | null;
  skills?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean | null;
  rawText: string;
};
```

Trong `composeJdText`, ngay trước dòng `if (job.skills?.trim())` (giữ thứ tự meta), thêm:

```ts
  const salary = formatSalary(
    job.salaryMin ?? null,
    job.salaryMax ?? null,
    !!job.salaryNegotiable,
  );
  if (salary) meta.push(`Mức lương: ${salary}`);
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- job-fields`
Expected: PASS toàn bộ (kể cả các test cũ).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/job-fields.ts lib/jobs/__tests__/job-fields.test.ts
git commit -m "feat(jobs): include salary in composeJdText for AI"
```

---

### Task 5: Badge lương trong `JobMeta` + truyền dữ liệu

**Files:**
- Modify: `components/JobMeta.tsx`
- Modify: `app/jobs/page.tsx` (select + prop)
- Modify: `app/jobs/[id]/page.tsx` (select + prop)
- Modify: `app/companies/[id]/page.tsx` (select + prop)

**Interfaces:**
- Consumes: `formatSalary` từ `@/lib/jobs/salary` (Task 2).
- Produces: `JobMeta` nhận thêm props `salaryMin?`, `salaryMax?`, `salaryNegotiable?` và render chip amber khi có lương.

- [ ] **Step 1: Cập nhật `JobMeta.tsx`**

Thêm import:

```ts
import { formatSalary } from "@/lib/jobs/salary";
```

Thêm 3 prop vào signature (sau `skills`):

```ts
  salaryMin,
  salaryMax,
  salaryNegotiable,
}: {
  location?: string | null;
  employmentType?: EmploymentType | null;
  experienceLevel?: ExperienceLevel | null;
  skills?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean | null;
}) {
```

Ngay sau dòng `const skillList = ...` khối tính toán, thêm:

```ts
  const salary = formatSalary(salaryMin ?? null, salaryMax ?? null, !!salaryNegotiable);
```

Sửa `hasAny` để tính cả lương:

```ts
  const hasAny =
    !!location?.trim() || !!employmentType || !!experienceLevel || skillList.length > 0 || !!salary;
```

Thêm chip lương làm phần tử ĐẦU trong `<div className="flex flex-wrap gap-1.5">` (ngay trước chip location):

```tsx
      {salary && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">💰 {salary}</span>
      )}
```

- [ ] **Step 2: Truyền select + prop ở `app/jobs/page.tsx`**

Trong khối `select:` của `prisma.jobDescription.findMany` (quanh dòng 48-51), thêm sau `skills: true,`:

```ts
      salaryMin: true, salaryMax: true, salaryNegotiable: true,
```

Trong JSX `<JobMeta ... />` (quanh dòng 126-131), thêm props:

```tsx
                          salaryMin={j.salaryMin}
                          salaryMax={j.salaryMax}
                          salaryNegotiable={j.salaryNegotiable}
```

- [ ] **Step 3: Truyền select + prop ở `app/jobs/[id]/page.tsx`**

Đọc file, thêm `salaryMin/salaryMax/salaryNegotiable: true` vào `select` của truy vấn `jobDescription`, và thêm 3 props tương ứng vào chỗ render `<JobMeta ... />`. (Cùng khuôn với Step 2.)

- [ ] **Step 4: Truyền select + prop ở `app/companies/[id]/page.tsx`**

Đọc file, thêm `salaryMin/salaryMax/salaryNegotiable: true` vào `select` truy vấn JD, và 3 props vào `<JobMeta ... />`.

- [ ] **Step 5: Kiểm tra biên dịch + lint**

Run: `npm run lint`
Expected: không lỗi mới. (Nếu chưa `db:push` ở Task 1, Prisma type sẽ báo thiếu field — đảm bảo Task 1 đã xong.)

- [ ] **Step 6: Commit**

```bash
git add components/JobMeta.tsx app/jobs/page.tsx app/jobs/[id]/page.tsx app/companies/[id]/page.tsx
git commit -m "feat(jobs): salary badge in JobMeta across listings"
```

---

### Task 6: Nhập lương ở form đăng JD + lưu

**Files:**
- Modify: `app/jobs/new/page.tsx` (thêm ô nhập)
- Modify: `lib/jobs/actions.ts` (`createJobDescription`)

**Interfaces:**
- Consumes: `parseSalaryInput` từ `@/lib/jobs/salary` (Task 2); `jobSchema` mở rộng (Task 3).
- Produces: form gửi `salaryMin`, `salaryMax` (chuỗi triệu), `salaryNegotiable` (checkbox); action ghi 3 trường vào DB.

- [ ] **Step 1: Thêm ô nhập vào form `app/jobs/new/page.tsx`**

Đọc file để lấy đúng khuôn `<div>...<label>...</div>`. Ngay sau block field `skills` (dòng ~53) và trước block `rawText`, thêm:

```tsx
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mức lương (triệu VND / tháng)</label>
                  <div className="flex items-center gap-2">
                    <Input name="salaryMin" type="number" min="0" step="0.5" placeholder="Từ" className="w-28" />
                    <span className="text-slate-400">–</span>
                    <Input name="salaryMax" type="number" min="0" step="0.5" placeholder="Đến" className="w-28" />
                    <label className="ml-2 flex items-center gap-1 text-sm text-slate-600">
                      <input type="checkbox" name="salaryNegotiable" value="1" /> Thỏa thuận
                    </label>
                  </div>
                </div>
```

- [ ] **Step 2: Cập nhật `createJobDescription` trong `lib/jobs/actions.ts`**

Thêm import ở đầu file:

```ts
import { parseSalaryInput } from "./salary";
```

Trong `createJobDescription`, sửa lời gọi `jobSchema.safeParse({...})` để thêm 3 trường (sau `experienceLevel: ...`):

```ts
    salaryMin: parseSalaryInput(String(formData.get("salaryMin") ?? "")),
    salaryMax: parseSalaryInput(String(formData.get("salaryMax") ?? "")),
    salaryNegotiable: formData.get("salaryNegotiable") === "1",
```

Trong `prisma.jobDescription.create({ data: {...} })`, thêm sau `experienceLevel: parsed.data.experienceLevel,`:

```ts
      salaryMin: parsed.data.salaryMin,
      salaryMax: parsed.data.salaryMax,
      salaryNegotiable: parsed.data.salaryNegotiable,
```

- [ ] **Step 3: Kiểm tra lint + test tổng**

Run: `npm run lint && npm test`
Expected: lint sạch; toàn bộ test PASS.

- [ ] **Step 4: Commit**

```bash
git add app/jobs/new/page.tsx lib/jobs/actions.ts
git commit -m "feat(jobs): salary inputs on new JD form and persist"
```

---

### Task 7: Bộ lọc theo lương ở `/jobs`

**Files:**
- Modify: `app/jobs/page.tsx`

**Interfaces:**
- Consumes: `salaryWhere`, `SALARY_FILTER_STEPS` từ `@/lib/jobs/salary` (Task 2).
- Produces: query param `salary` (số triệu) lọc danh sách; `select` dropdown mới trong form lọc.

- [ ] **Step 1: Thêm import**

Trong `app/jobs/page.tsx`:

```ts
import { salaryWhere, SALARY_FILTER_STEPS } from "@/lib/jobs/salary";
```

- [ ] **Step 2: Đọc + validate param `salary`**

Sửa kiểu `searchParams` thành:

```ts
  searchParams: Promise<{ q?: string; type?: string; level?: string; salary?: string }>;
```

Sau dòng `const { q, type, level } = await searchParams;` đổi thành lấy cả `salary`, và thêm:

```ts
  const salaryNum = Number(salary);
  const salaryFilter = SALARY_FILTER_STEPS.includes(salaryNum as never) ? salaryNum : null;
```

- [ ] **Step 3: Áp where lương vào truy vấn**

Trong `where` của `findMany`, thêm spread (sau nhánh `levelFilter`):

```ts
      ...salaryWhere(salaryFilter),
```

- [ ] **Step 4: Thêm dropdown vào form lọc**

Ngay sau `<select name="level" ...>...</select>` trong form, thêm:

```tsx
          <select name="salary" defaultValue={salaryFilter ?? ""} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">Mọi mức lương</option>
            {SALARY_FILTER_STEPS.map((s) => (
              <option key={s} value={s}>Từ {s} triệu</option>
            ))}
          </select>
```

- [ ] **Step 5: Cập nhật thông báo rỗng**

Sửa điều kiện hiển thị "Không tìm thấy..." (quanh dòng 107) để tính cả salaryFilter:

```tsx
                {term || typeFilter || levelFilter || salaryFilter
                  ? "Không tìm thấy tin nào khớp bộ lọc."
                  : "Chưa có tin tuyển dụng nào."}
```

- [ ] **Step 6: Kiểm tra lint**

Run: `npm run lint`
Expected: không lỗi mới.

- [ ] **Step 7: Commit**

```bash
git add app/jobs/page.tsx
git commit -m "feat(jobs): filter listings by minimum salary"
```

---

### Task 8: Đưa lương vào các caller AI (select thật)

**Files:**
- Modify: `lib/jobs/recommend-actions.ts`
- Modify: `lib/applications/actions.ts`
- Modify: `lib/applications/screening-actions.ts`

**Interfaces:**
- Consumes: `composeJdText` đã hỗ trợ lương (Task 4).
- Produces: các truy vấn JD ở 3 caller `select` thêm `salaryMin/salaryMax/salaryNegotiable` và truyền vào `composeJdText`, để AI thấy lương.

- [ ] **Step 1: `lib/jobs/recommend-actions.ts`**

Đọc file. Ở truy vấn `jobDescription` cấp dữ liệu cho `composeJdText`, thêm `salaryMin: true, salaryMax: true, salaryNegotiable: true` vào `select`. Đảm bảo object truyền vào `composeJdText(...)` bao gồm các field này (nếu truyền cả object JD thì tự có; nếu tách field, thêm `salaryMin/salaryMax/salaryNegotiable`).

- [ ] **Step 2: `lib/applications/actions.ts`**

Đọc file. Làm tương tự Step 1 cho truy vấn JD dùng trong `composeJdText`.

- [ ] **Step 3: `lib/applications/screening-actions.ts`**

Đọc file. Làm tương tự Step 1.

- [ ] **Step 4: Kiểm tra lint + test tổng**

Run: `npm run lint && npm test`
Expected: lint sạch; toàn bộ test PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/recommend-actions.ts lib/applications/actions.ts lib/applications/screening-actions.ts
git commit -m "feat(ai): pass salary into JD text for recommend/eval/screening"
```

---

## Self-Review

**Spec coverage:**
- §1 Data model → Task 1. ✓
- §2 salary.ts (format/parse/where) + Zod → Task 2 + Task 3. ✓
- §3 Nhập & hiển thị → Task 6 (form) + Task 5 (badge, threading). ✓
- §4 Bộ lọc → Task 7. ✓
- §5 AI → Task 4 (composeJdText) + Task 8 (caller selects). ✓
- §6 Test → mỗi task có test/kiểm tra. ✓

**Ghi chú lệch spec (chấp nhận):** dòng AI dùng `"Mức lương: 15 – 25 triệu"` (không hậu tố "VND/tháng") để tránh sai khi giá trị là "Thỏa thuận"; dùng lại `formatSalary`.

**Placeholder scan:** Task 5 Step 3/4 và Task 8 yêu cầu "đọc file rồi áp cùng khuôn" — đây là thao tác lặp lại y hệt Step 2/Step 1 đã có code đầy đủ, không phải placeholder logic mới.

**Type consistency:** `formatSalary(min,max,negotiable)`, `parseSalaryInput(raw)`, `salaryWhere(minMillions)`, `SALARY_FILTER_STEPS` dùng nhất quán ở Task 2/3/4/5/7/8. Trường Prisma `salaryMin/salaryMax/salaryNegotiable` nhất quán mọi nơi.
