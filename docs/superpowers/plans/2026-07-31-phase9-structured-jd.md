# Structured JD (Phase 9 — Gói D1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trường có cấu trúc (địa điểm, loại hình, cấp bậc, kỹ năng) vào tin tuyển dụng: form nhập theo trường, hiển thị badge, lọc theo trường trên /jobs, và AI dùng thêm dữ liệu này.

**Architecture:** 4 trường tuỳ chọn + 2 enum trên `JobDescription` (tin cũ vẫn hợp lệ). Một module thuần `job-fields.ts` giữ nhãn tiếng Việt + `composeJdText(job)` (ghép trường cấu trúc + rawText thành text cho AI). Zod `jobSchema` validate form tạo tin. Component `JobMeta` render badge. `/jobs` thêm lọc type/level. Mọi call-site đưa JD vào AI chuyển sang `composeJdText(job)`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 + PostgreSQL (Neon), Auth.js, Zod 4, Vitest, Tailwind 4, AI qua OpenAI-compat client (Gemini).

## Global Constraints

- **Next.js là bản có breaking changes.** Trước khi viết route/page/server-action, đọc guide liên quan trong `node_modules/next/dist/docs/`. Pages `await params`/`await searchParams` (đều Promise).
- **Prisma giữ v6.** Đẩy schema bằng `npm run db:push` (đã bọc ipv4first), KHÔNG dùng `prisma db push` trần.
- **AI provider: Gemini** qua `@/lib/ai/client` — không đổi provider, không đổi prompt/schema AI (chỉ đổi nội dung text đầu vào).
- **Test:** `npm test` (vitest run). Toàn bộ UI copy **tiếng Việt**.
- **Server actions** dùng `auth()` từ `@/auth`, `prisma` từ `@/lib/db/prisma`; kiểm tra `session.user.role`.
- **Palette:** blue-700 tiêu đề, slate-50 nền, dùng `Card`/`Button`/`Input`/`Label` từ `@/components/ui`.
- Áp dụng **TDD** cho logic thuần (`job-fields`, `jobSchema`); glue/UI/filter/AI-wiring không unit-test (an toàn bằng `npx tsc --noEmit` + `npm test` xanh).
- Nhãn enum (verbatim): EmploymentType FULL_TIME "Toàn thời gian", PART_TIME "Bán thời gian", CONTRACT "Hợp đồng", INTERNSHIP "Thực tập". ExperienceLevel INTERN "Thực tập sinh", JUNIOR "Junior", MID "Middle", SENIOR "Senior", LEAD "Lead".

---

## File Structure

**Tạo mới:**
- `lib/jobs/job-fields.ts` — enum value arrays + label maps + type unions + `composeJdText`.
- `lib/jobs/schema.ts` — Zod `jobSchema` + type `JobInput`.
- `lib/jobs/__tests__/job-fields.test.ts`, `lib/jobs/__tests__/schema.test.ts`.
- `components/JobMeta.tsx` — badge các trường cấu trúc.

**Sửa:**
- `prisma/schema.prisma` — 2 enum + 4 trường trên JobDescription.
- `lib/jobs/actions.ts` — `createJobDescription` validate bằng `jobSchema` + lưu trường mới.
- `app/jobs/new/page.tsx` — thêm ô nhập.
- `app/jobs/page.tsx` — lọc type/level, q khớp location/skills, JobMeta trên thẻ, select thêm trường.
- `app/jobs/[id]/page.tsx` — hiển thị JobMeta + `composeJdText` cho EvaluateFromJob.
- `lib/applications/actions.ts`, `lib/applications/screening-actions.ts`, `lib/jobs/recommend-actions.ts` — dùng `composeJdText`.

---

### Task 1: Prisma enums + trường cấu trúc

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: enum `EmploymentType`, `ExperienceLevel`; trường `location String?`, `employmentType EmploymentType?`, `experienceLevel ExperienceLevel?`, `skills String @default("")` trên `JobDescription`.

- [ ] **Step 1: Thêm 2 enum + 4 trường**

Thêm hai enum (cạnh các enum khác trong `prisma/schema.prisma`):
```prisma
enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERNSHIP
}

enum ExperienceLevel {
  INTERN
  JUNIOR
  MID
  SENIOR
  LEAD
}
```
Trong `model JobDescription { ... }`, thêm 4 trường (cạnh `rawText`):
```prisma
  location        String?
  employmentType  EmploymentType?
  experienceLevel ExperienceLevel?
  skills          String           @default("")
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
git commit -m "feat(db): structured JD fields on JobDescription"
```

---

### Task 2: job-fields.ts — nhãn + composeJdText

**Files:**
- Create: `lib/jobs/job-fields.ts`
- Test: `lib/jobs/__tests__/job-fields.test.ts`

**Interfaces:**
- Produces:
  - `type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP"`
  - `type ExperienceLevel = "INTERN" | "JUNIOR" | "MID" | "SENIOR" | "LEAD"`
  - `EMPLOYMENT_TYPES: readonly EmploymentType[]`, `EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string>`
  - `EXPERIENCE_LEVELS: readonly ExperienceLevel[]`, `EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string>`
  - `type JobTextInput = { location?: string | null; employmentType?: EmploymentType | null; experienceLevel?: ExperienceLevel | null; skills?: string | null; rawText: string }`
  - `composeJdText(job: JobTextInput): string`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/jobs/__tests__/job-fields.test.ts
import { describe, it, expect } from "vitest";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  composeJdText,
} from "../job-fields";

describe("job-fields labels", () => {
  it("mọi loại hình có nhãn tiếng Việt", () => {
    expect(EMPLOYMENT_TYPES).toHaveLength(4);
    for (const t of EMPLOYMENT_TYPES) expect(EMPLOYMENT_TYPE_LABELS[t]).toBeTruthy();
    expect(EMPLOYMENT_TYPE_LABELS.FULL_TIME).toBe("Toàn thời gian");
  });
  it("mọi cấp bậc có nhãn", () => {
    expect(EXPERIENCE_LEVELS).toHaveLength(5);
    for (const l of EXPERIENCE_LEVELS) expect(EXPERIENCE_LEVEL_LABELS[l]).toBeTruthy();
    expect(EXPERIENCE_LEVEL_LABELS.SENIOR).toBe("Senior");
  });
});

describe("composeJdText", () => {
  it("ghép meta có mặt trước rawText", () => {
    const out = composeJdText({
      location: "Hà Nội",
      employmentType: "FULL_TIME",
      experienceLevel: "SENIOR",
      skills: "React, Node",
      rawText: "Mô tả chi tiết",
    });
    expect(out).toContain("Địa điểm: Hà Nội");
    expect(out).toContain("Loại hình: Toàn thời gian");
    expect(out).toContain("Cấp bậc: Senior");
    expect(out).toContain("Kỹ năng: React, Node");
    expect(out).toContain("Mô tả chi tiết");
  });

  it("bỏ trường trống/null", () => {
    const out = composeJdText({
      location: "",
      employmentType: null,
      experienceLevel: null,
      skills: "  ",
      rawText: "Chỉ mô tả",
    });
    expect(out).toBe("Chỉ mô tả");
  });

  it("có ít nhất một meta thì kèm rawText phía sau", () => {
    const out = composeJdText({ location: "Remote", rawText: "ND" });
    expect(out).toBe("Địa điểm: Remote\nND");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- job-fields`
Expected: FAIL — không import được `../job-fields`.

- [ ] **Step 3: Viết `lib/jobs/job-fields.ts`**

```ts
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP";
export type ExperienceLevel = "INTERN" | "JUNIOR" | "MID" | "SENIOR" | "LEAD";

export const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERNSHIP",
] as const satisfies readonly EmploymentType[];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian",
  CONTRACT: "Hợp đồng",
  INTERNSHIP: "Thực tập",
};

export const EXPERIENCE_LEVELS = [
  "INTERN",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
] as const satisfies readonly ExperienceLevel[];

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  INTERN: "Thực tập sinh",
  JUNIOR: "Junior",
  MID: "Middle",
  SENIOR: "Senior",
  LEAD: "Lead",
};

export type JobTextInput = {
  location?: string | null;
  employmentType?: EmploymentType | null;
  experienceLevel?: ExperienceLevel | null;
  skills?: string | null;
  rawText: string;
};

// Ghép các trường cấu trúc có mặt thành một dòng meta rồi tới rawText, để đưa
// vào AI. Không có trường cấu trúc nào -> trả nguyên rawText.
export function composeJdText(job: JobTextInput): string {
  const meta: string[] = [];
  if (job.location?.trim()) meta.push(`Địa điểm: ${job.location.trim()}`);
  if (job.employmentType)
    meta.push(`Loại hình: ${EMPLOYMENT_TYPE_LABELS[job.employmentType]}`);
  if (job.experienceLevel)
    meta.push(`Cấp bậc: ${EXPERIENCE_LEVEL_LABELS[job.experienceLevel]}`);
  if (job.skills?.trim()) meta.push(`Kỹ năng: ${job.skills.trim()}`);
  if (meta.length === 0) return job.rawText;
  return `${meta.join(" | ")}\n${job.rawText}`;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- job-fields`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/job-fields.ts lib/jobs/__tests__/job-fields.test.ts
git commit -m "feat(jobs): job field labels and composeJdText"
```

---

### Task 3: Zod jobSchema

**Files:**
- Create: `lib/jobs/schema.ts`
- Test: `lib/jobs/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: `EMPLOYMENT_TYPES`, `EXPERIENCE_LEVELS` (`./job-fields`).
- Produces: `jobSchema` (Zod); `type JobInput = { title: string; company: string; rawText: string; location: string; skills: string; employmentType: EmploymentType | null; experienceLevel: ExperienceLevel | null }`.

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/jobs/__tests__/schema.test.ts
import { describe, it, expect } from "vitest";
import { jobSchema } from "../schema";

const base = {
  title: "Frontend",
  company: "ACME",
  rawText: "Mô tả",
  location: "Hà Nội",
  skills: "React",
  employmentType: "FULL_TIME",
  experienceLevel: "SENIOR",
};

describe("jobSchema", () => {
  it("chấp nhận input hợp lệ", () => {
    const r = jobSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.employmentType).toBe("FULL_TIME");
      expect(r.data.experienceLevel).toBe("SENIOR");
    }
  });

  it("enum rỗng -> null", () => {
    const r = jobSchema.safeParse({ ...base, employmentType: "", experienceLevel: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.employmentType).toBeNull();
      expect(r.data.experienceLevel).toBeNull();
    }
  });

  it("thiếu title -> lỗi", () => {
    expect(jobSchema.safeParse({ ...base, title: "" }).success).toBe(false);
  });

  it("thiếu rawText -> lỗi", () => {
    expect(jobSchema.safeParse({ ...base, rawText: "" }).success).toBe(false);
  });

  it("enum sai -> lỗi", () => {
    expect(jobSchema.safeParse({ ...base, employmentType: "BOGUS" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- jobs/__tests__/schema`
Expected: FAIL — không import được `../schema`.

- [ ] **Step 3: Viết `lib/jobs/schema.ts`**

```ts
import { z } from "zod";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "./job-fields";

const emptyToNull = (v: unknown) => (v === "" || v == null ? null : v);

export const jobSchema = z.object({
  title: z.string().min(1, "Vui lòng nhập tiêu đề"),
  company: z.string(),
  rawText: z.string().min(1, "Vui lòng nhập mô tả công việc"),
  location: z.string(),
  skills: z.string(),
  employmentType: z.preprocess(emptyToNull, z.enum(EMPLOYMENT_TYPES).nullable()),
  experienceLevel: z.preprocess(emptyToNull, z.enum(EXPERIENCE_LEVELS).nullable()),
});

export type JobInput = z.infer<typeof jobSchema>;
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- jobs/__tests__/schema`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/schema.ts lib/jobs/__tests__/schema.test.ts
git commit -m "feat(jobs): zod schema for job create with structured fields"
```

---

### Task 4: Form đăng tin + action

**Files:**
- Modify: `lib/jobs/actions.ts`
- Modify: `app/jobs/new/page.tsx`

**Interfaces:**
- Consumes: `jobSchema` (`./schema`), `EMPLOYMENT_TYPES`/`EMPLOYMENT_TYPE_LABELS`/`EXPERIENCE_LEVELS`/`EXPERIENCE_LEVEL_LABELS` (`./job-fields`).

Glue/UI: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: Sửa `createJobDescription` trong `lib/jobs/actions.ts`**

Thêm import ở đầu file:
```ts
import { jobSchema } from "./schema";
```
Thay toàn bộ hàm `createJobDescription` bằng:
```ts
export async function createJobDescription(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const parsed = jobSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    company: String(formData.get("company") ?? "").trim(),
    rawText: String(formData.get("rawText") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    skills: String(formData.get("skills") ?? "").trim(),
    employmentType: String(formData.get("employmentType") ?? ""),
    experienceLevel: String(formData.get("experienceLevel") ?? ""),
  });
  if (!parsed.success) redirect("/jobs/new");

  await prisma.jobDescription.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      company: parsed.data.company,
      rawText: parsed.data.rawText,
      location: parsed.data.location,
      skills: parsed.data.skills,
      employmentType: parsed.data.employmentType,
      experienceLevel: parsed.data.experienceLevel,
      isPublic: true,
    },
  });
  redirect("/dashboard");
}
```
(Giữ nguyên `deleteJobDescription` và các import hiện có như `redirect`, `prisma`, `auth`, `revalidatePath`.)

- [ ] **Step 2: Sửa `app/jobs/new/page.tsx` — thêm ô nhập**

Thêm import:
```tsx
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
} from "@/lib/jobs/job-fields";
```
Trong `<form action={createJobDescription} className="grid gap-3">`, thêm các ô này giữa ô "Công ty" và ô "Mô tả công việc (JD)":
```tsx
              <div><Label>Địa điểm</Label>
                <Input name="location" placeholder="VD: Hà Nội, Remote" /></div>
              <div><Label>Loại hình làm việc</Label>
                <select name="employmentType" className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="">— Chọn —</option>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>
                  ))}
                </select></div>
              <div><Label>Cấp bậc</Label>
                <select name="experienceLevel" className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="">— Chọn —</option>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l} value={l}>{EXPERIENCE_LEVEL_LABELS[l]}</option>
                  ))}
                </select></div>
              <div><Label>Kỹ năng yêu cầu</Label>
                <Input name="skills" placeholder="VD: React, Node, SQL (cách nhau bởi phẩy)" /></div>
```

- [ ] **Step 3: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 4: Commit**

```bash
git add lib/jobs/actions.ts app/jobs/new/page.tsx
git commit -m "feat(jobs): job create form with structured fields"
```

---

### Task 5: JobMeta + hiển thị

**Files:**
- Create: `components/JobMeta.tsx`
- Modify: `app/jobs/[id]/page.tsx`
- Modify: `app/jobs/page.tsx`

**Interfaces:**
- Consumes: `EMPLOYMENT_TYPE_LABELS`, `EXPERIENCE_LEVEL_LABELS`, `EmploymentType`, `ExperienceLevel` (`@/lib/jobs/job-fields`).
- Produces: `JobMeta({ location, employmentType, experienceLevel, skills })` (default export).

- [ ] **Step 1: Tạo `components/JobMeta.tsx`**

```tsx
import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  type EmploymentType,
  type ExperienceLevel,
} from "@/lib/jobs/job-fields";

export default function JobMeta({
  location,
  employmentType,
  experienceLevel,
  skills,
}: {
  location?: string | null;
  employmentType?: EmploymentType | null;
  experienceLevel?: ExperienceLevel | null;
  skills?: string | null;
}) {
  const skillList = (skills ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const hasAny =
    !!location?.trim() || !!employmentType || !!experienceLevel || skillList.length > 0;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {location?.trim() && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">📍 {location.trim()}</span>
      )}
      {employmentType && (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{EMPLOYMENT_TYPE_LABELS[employmentType]}</span>
      )}
      {experienceLevel && (
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{EXPERIENCE_LEVEL_LABELS[experienceLevel]}</span>
      )}
      {skillList.map((s) => (
        <span key={s} className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">{s}</span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Sửa `app/jobs/[id]/page.tsx` — nạp trường + render JobMeta**

Thêm import:
```tsx
import JobMeta from "@/components/JobMeta";
```
Sửa `select` của truy vấn `job` để lấy thêm trường cấu trúc:
```tsx
    select: {
      id: true, title: true, company: true, rawText: true, userId: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
    },
```
Trong phần render, ngay dưới `<p className="text-sm text-slate-500">{job.company || "—"}</p>` (trong `CardHeader`), thêm:
```tsx
            <div className="mt-2">
              <JobMeta
                location={job.location}
                employmentType={job.employmentType}
                experienceLevel={job.experienceLevel}
                skills={job.skills}
              />
            </div>
```

- [ ] **Step 3: Sửa `app/jobs/page.tsx` — nạp trường + JobMeta trên thẻ**

Thêm import:
```tsx
import JobMeta from "@/components/JobMeta";
```
Sửa `select` của `jobs` để lấy thêm trường cấu trúc:
```tsx
    select: {
      id: true, title: true, company: true, rawText: true, createdAt: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
    },
```
Trong thẻ job, ngay dưới `<p className="mt-1 line-clamp-2 text-sm text-slate-600">{j.rawText}</p>`, thêm:
```tsx
                      <div className="mt-2">
                        <JobMeta
                          location={j.location}
                          employmentType={j.employmentType}
                          experienceLevel={j.experienceLevel}
                          skills={j.skills}
                        />
                      </div>
```

- [ ] **Step 4: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add components/JobMeta.tsx "app/jobs/[id]/page.tsx" app/jobs/page.tsx
git commit -m "feat(jobs): JobMeta badges on job detail and list"
```

---

### Task 6: Lọc theo loại hình / cấp bậc trên /jobs

**Files:**
- Modify: `app/jobs/page.tsx`

**Interfaces:**
- Consumes: `EMPLOYMENT_TYPES`/`EMPLOYMENT_TYPE_LABELS`/`EXPERIENCE_LEVELS`/`EXPERIENCE_LEVEL_LABELS` (`@/lib/jobs/job-fields`).

- [ ] **Step 1: Đọc thêm `type`/`level` từ searchParams + lọc**

Thêm import:
```tsx
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
} from "@/lib/jobs/job-fields";
```
Sửa chữ ký + đọc param + xây `where` (thay khối nạp `jobs` hiện tại):
```tsx
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; level?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q, type, level } = await searchParams;
  const term = (q ?? "").trim();
  const typeFilter = EMPLOYMENT_TYPES.includes(type as never) ? (type as (typeof EMPLOYMENT_TYPES)[number]) : undefined;
  const levelFilter = EXPERIENCE_LEVELS.includes(level as never) ? (level as (typeof EXPERIENCE_LEVELS)[number]) : undefined;

  const jobs = await prisma.jobDescription.findMany({
    where: {
      isPublic: true,
      ...(typeFilter ? { employmentType: typeFilter } : {}),
      ...(levelFilter ? { experienceLevel: levelFilter } : {}),
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: "insensitive" } },
              { company: { contains: term, mode: "insensitive" } },
              { rawText: { contains: term, mode: "insensitive" } },
              { location: { contains: term, mode: "insensitive" } },
              { skills: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, company: true, rawText: true, createdAt: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
    },
  });
```

- [ ] **Step 2: Thêm 2 dropdown vào form tìm kiếm**

Thay `<form method="get" ...>` (ô tìm kiếm) bằng phiên bản có dropdown (giữ ô `q` + nút "Tìm"):
```tsx
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            name="q"
            defaultValue={term}
            placeholder="Tìm theo tiêu đề, công ty, nội dung..."
            className="min-w-[12rem] flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <select name="type" defaultValue={typeFilter ?? ""} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">Mọi loại hình</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <select name="level" defaultValue={levelFilter ?? ""} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">Mọi cấp bậc</option>
            {EXPERIENCE_LEVELS.map((l) => (
              <option key={l} value={l}>{EXPERIENCE_LEVEL_LABELS[l]}</option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Tìm</button>
        </form>
```

- [ ] **Step 3: Cập nhật thông báo rỗng khi có filter**

Thay điều kiện empty-state (khối `{jobs.length === 0 && (...)}`) để phản ánh cả filter:
```tsx
          {jobs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-slate-500">
                {term || typeFilter || levelFilter
                  ? "Không tìm thấy tin nào khớp bộ lọc."
                  : "Chưa có tin tuyển dụng nào."}
              </CardContent>
            </Card>
          )}
```

- [ ] **Step 4: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 5: Kiểm tra thủ công (cho người dùng)**

Đăng tin mới có loại hình/cấp bậc; mở `/jobs`, chọn dropdown loại hình/cấp bậc + gõ từ khóa → danh sách lọc đúng; badge hiện trên thẻ.

- [ ] **Step 6: Commit**

```bash
git add app/jobs/page.tsx
git commit -m "feat(jobs): filter jobs by employment type and experience level"
```

---

### Task 7: AI dùng composeJdText

**Files:**
- Modify: `app/jobs/[id]/page.tsx`
- Modify: `lib/applications/actions.ts`
- Modify: `lib/applications/screening-actions.ts`
- Modify: `lib/jobs/recommend-actions.ts`

**Interfaces:**
- Consumes: `composeJdText` (`@/lib/jobs/job-fields`).

Glue: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: `app/jobs/[id]/page.tsx` — truyền composeJdText cho EvaluateFromJob**

Thêm import:
```tsx
import { composeJdText } from "@/lib/jobs/job-fields";
```
(Select đã có trường cấu trúc từ Task 5.) Thay prop `jdText` của `<EvaluateFromJob .../>`:
```tsx
            jdText={composeJdText(job)}
```
(Giữ `jdTitle={job.title}` và `jdCompany={job.company}` như cũ.)

- [ ] **Step 2: `lib/applications/actions.ts` — previewMatch + submitApplication**

Thêm import:
```ts
import { composeJdText } from "@/lib/jobs/job-fields";
```
Trong `previewMatch`, sửa select của `job` để lấy thêm trường cấu trúc và dùng `composeJdText`:
```ts
  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, isPublic: true },
    select: {
      id: true, rawText: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
    },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };

  const cv = await loadCvInput(cvId, userId);
  if (!cv) return { ok: false, error: "Không tìm thấy CV" };

  try {
    const result = await requestEvaluation(buildEvaluationPrompt(cv, composeJdText(job)));
```
Trong `submitApplication`, sửa select của `job`:
```ts
  const job = await prisma.jobDescription.findFirst({
    where: { id: input.jobId, isPublic: true },
    select: {
      id: true, rawText: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
    },
  });
```
và trong `createApplication`, thay chỗ dựng prompt:
```ts
      const result = await requestEvaluation(
        buildEvaluationPrompt(data.cvSnapshot, composeJdText(job!)),
      );
```
(Bỏ biến `rawText` cũ nếu không còn dùng ở nơi khác; giữ nguyên phần còn lại.)

- [ ] **Step 3: `lib/applications/screening-actions.ts` — jdText = composeJdText(job)**

Thêm import:
```ts
import { composeJdText } from "@/lib/jobs/job-fields";
```
Sửa select của `job` và lời gọi `runScreening`:
```ts
  const job = await prisma.jobDescription.findFirst({
    where: { id: jobId, userId },
    select: {
      id: true, rawText: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
    },
  });
  if (!job) return { ok: false, error: "Không tìm thấy tin tuyển dụng" };
```
Tại chỗ gọi `runScreening({ jobId: job.id, jdText: job.rawText, applicants }, deps)` đổi `jdText`:
```ts
  const outcome = await runScreening(
    { jobId: job.id, jdText: composeJdText(job), applicants },
    deps,
  );
```
(Nếu code hiện tại truyền `jdText: job.rawText` ở đúng chỗ gọi `runScreening`, chỉ đổi giá trị đó thành `composeJdText(job)`.)

- [ ] **Step 4: `lib/jobs/recommend-actions.ts` — rawText per job = composeJdText**

Thêm import:
```ts
import { composeJdText } from "@/lib/jobs/job-fields";
```
Sửa select của `findMany` job + map:
```ts
  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true, id: { notIn: appliedJobIds } },
    orderBy: { createdAt: "desc" },
    take: MAX_RECOMMEND_JOBS,
    select: {
      id: true, title: true, company: true, rawText: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
    },
  });

  const jobs: RecommendationJobInput[] = rows.map((r) => ({
    jobId: r.id,
    title: r.title,
    company: r.company,
    rawText: composeJdText(r),
  }));
```

- [ ] **Step 5: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add "app/jobs/[id]/page.tsx" lib/applications/actions.ts lib/applications/screening-actions.ts lib/jobs/recommend-actions.ts
git commit -m "feat(ai): feed structured JD fields to AI via composeJdText"
```

---

## Self-Review (đã thực hiện)

- **Bao phủ spec:** §2 trường/enum → Task 1. §3 job-fields + composeJdText → Task 2. §4 jobSchema + form + action → Task 3/4. §5 JobMeta hiển thị → Task 5. §6 lọc type/level + q khớp location/skills → Task 6. §7 AI dùng composeJdText → Task 7. §8 phân quyền/lỗi → gate trong action (Task 4) + filter bỏ qua giá trị sai (Task 6). §9 test → Task 2/3 (TDD thuần).
- **Placeholder:** không còn TBD/TODO; mọi bước có code hoặc lệnh cụ thể.
- **Nhất quán kiểu:** `EmploymentType`/`ExperienceLevel`/`EMPLOYMENT_TYPES`/`EXPERIENCE_LEVELS`/`*_LABELS`/`composeJdText` (Task 2) dùng ở Task 3/4/5/6/7; `jobSchema` (Task 3) dùng ở Task 4; `JobMeta` props (Task 5) khớp trường select; `composeJdText(job)` nhận `JobTextInput` — mọi select ở Task 7 lấy đúng `location/employmentType/experienceLevel/skills/rawText` để khớp.
```
