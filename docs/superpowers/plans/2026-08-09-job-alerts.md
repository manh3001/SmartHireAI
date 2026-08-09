# Thông báo việc làm (Job Alerts) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho ứng viên lưu bộ lọc `/jobs` thành "thông báo"; khi NTD đăng tin công khai mới khớp tiêu chí, ứng viên nhận thông báo trong ứng dụng (tái dùng `Notification` + realtime poll).

**Architecture:** Model `JobAlert` lưu tiêu chí (đúng `JobsFilter`). Hàm thuần `matchesAlert(job, criteria)` (TDD) khớp trong bộ nhớ, ngữ nghĩa soi theo `buildJobsWhere`/`salaryWhere`. `notifyMatchingAlerts(job)` nạp mọi alert, lọc khớp, khử trùng theo user, tạo `Notification`; gọi từ `createJobDescription`. UI: nút "Lưu làm thông báo" ở `/jobs` + trang `/jobs/alerts` (liệt kê/xóa).

**Tech Stack:** Next.js 16, React 19, Prisma 6 (Neon), Tailwind v4, Vitest, next-auth v5.

## Global Constraints

- Prisma **pinned v6**; thay đổi schema DUY NHẤT là thêm `model JobAlert` + quan hệ `User.jobAlerts`; đồng bộ bằng `npm run db:push` (không migration tay).
- Vitest: unit-test **logic thuần** (`alerts.ts`); component/route/server action KHÔNG unit-test.
- `className` **nháy thẳng ASCII**; nội dung tiếng Việt; **SmartHire**.
- Không đổi `CvInput`, AI, auth, realtime, phân quyền.
- Tái dùng: `createNotification` (`lib/notifications/create.ts`), `JobsFilter` (`lib/jobs/job-query.ts`), `salaryWhere` ngữ nghĩa (`lib/jobs/salary.ts`), `JOB_CATEGORY_LABELS`/`normalizeCategory` (`lib/jobs/job-categories.ts`), `EMPLOYMENT_TYPE_LABELS`/`EXPERIENCE_LEVEL_LABELS`/enum (`lib/jobs/job-fields.ts`), `SALARY_FILTER_STEPS` (`lib/jobs/salary.ts`).
- **Kích hoạt chỉ khi tạo tin mới** (`createJobDescription`, luôn `isPublic: true`). Admin toggle công khai KHÔNG bắn (tránh trùng).
- **Khử trùng:** 1 người nhận 1 thông báo/tin dù trùng nhiều alert; **loại người đăng tin**.
- Windows: `npm test`, `npm run lint`, `npm run build`, `npm run db:push`.

## Điều chỉnh so với spec (YAGNI)

Spec nêu trường `location` riêng cho alert. Nhưng `/jobs` KHÔNG có bộ lọc location độc lập (location chỉ tìm qua `q`/term), mà alert chỉ tạo từ bộ lọc `/jobs` → trường `location` không bao giờ được set. **Bỏ `location` khỏi model/criteria.** `matchesAlert` vẫn khớp location qua `term` (contains trên `job.location`). Do đó `AlertCriteria` ≡ `JobsFilter`. Salary khớp soi **theo `salaryWhere`** (dựa `salaryMax`/`salaryMin`, KHÔNG dùng `negotiable`) để đồng nhất với trang duyệt.

## File Structure

**Tạo mới:**
- `lib/jobs/alerts.ts` + `lib/jobs/__tests__/alerts.test.ts` — type + hàm thuần (khớp, nhãn, chuyển đổi).
- `lib/jobs/alert-notify.ts` — `notifyMatchingAlerts(job)` (chạm DB, không unit-test).
- `lib/jobs/alert-actions.ts` — server actions `createJobAlert`/`deleteJobAlert`.
- `components/jobs/SaveAlertButton.tsx` — nút client lưu alert từ tiêu chí hiện tại.
- `components/jobs/DeleteAlertButton.tsx` — nút client xóa alert.
- `app/jobs/alerts/page.tsx` — trang liệt kê alert.

**Sửa:**
- `prisma/schema.prisma` (model `JobAlert` + `User.jobAlerts`)
- `lib/jobs/actions.ts` (`createJobDescription` gọi `notifyMatchingAlerts`)
- `app/jobs/page.tsx` (nút lưu + link "Thông báo đã lưu" cho ứng viên)

---

### Task 1: Hàm thuần `alerts.ts` (TDD) + model `JobAlert`

**Files:**
- Create: `lib/jobs/alerts.ts`, `lib/jobs/__tests__/alerts.test.ts`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: `JobsFilter` (`lib/jobs/job-query.ts`); `JobCategory`/`JOB_CATEGORY_LABELS` (`lib/jobs/job-categories.ts`); `EmploymentType`/`ExperienceLevel`/`EMPLOYMENT_TYPE_LABELS`/`EXPERIENCE_LEVEL_LABELS` (`lib/jobs/job-fields.ts`).
- Produces:
  - `type AlertCriteria = { term?: string; category?: JobCategory; employmentType?: EmploymentType; experienceLevel?: ExperienceLevel; salaryMillions?: number | null }`
  - `type MatchableJob = { title: string; company: string; rawText: string; location: string | null; skills: string; category: string | null; employmentType: EmploymentType | null; experienceLevel: ExperienceLevel | null; salaryMin: number | null; salaryMax: number | null }`
  - `matchesAlert(job: MatchableJob, c: AlertCriteria): boolean`
  - `alertLabel(c: AlertCriteria): string`
  - `criteriaFromFilter(f: JobsFilter): AlertCriteria`
  - `criteriaToQuery(c: AlertCriteria): Record<string, string>`

- [ ] **Step 1: Viết test thất bại**

`lib/jobs/__tests__/alerts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  matchesAlert,
  alertLabel,
  criteriaFromFilter,
  criteriaToQuery,
  type MatchableJob,
} from "../alerts";

const base: MatchableJob = {
  title: "Lập trình viên React",
  company: "FPT Software",
  rawText: "Cần React, TypeScript. Làm tại Hà Nội.",
  location: "Hà Nội",
  skills: "React, TS",
  category: "it",
  employmentType: "FULL_TIME",
  experienceLevel: "MID",
  salaryMin: 20_000_000,
  salaryMax: 30_000_000,
};

describe("matchesAlert", () => {
  it("tiêu chí rỗng -> khớp mọi tin", () => {
    expect(matchesAlert(base, {})).toBe(true);
  });
  it("term khớp không phân biệt hoa/thường trên nhiều trường (kể cả location)", () => {
    expect(matchesAlert(base, { term: "react" })).toBe(true);
    expect(matchesAlert(base, { term: "hà nội" })).toBe(true);
    expect(matchesAlert(base, { term: "python" })).toBe(false);
  });
  it("category/employmentType/experienceLevel so bằng đúng", () => {
    expect(matchesAlert(base, { category: "it" })).toBe(true);
    expect(matchesAlert(base, { category: "design" })).toBe(false);
    expect(matchesAlert(base, { employmentType: "PART_TIME" })).toBe(false);
    expect(matchesAlert(base, { experienceLevel: "MID" })).toBe(true);
  });
  it("nhiều tiêu chí phải cùng đúng (AND)", () => {
    expect(matchesAlert(base, { term: "react", category: "it" })).toBe(true);
    expect(matchesAlert(base, { term: "react", category: "design" })).toBe(false);
  });
  it("salary: khớp khi salaryMax >= ngưỡng", () => {
    expect(matchesAlert(base, { salaryMillions: 25 })).toBe(true);
    expect(matchesAlert(base, { salaryMillions: 40 })).toBe(false);
  });
  it("salary: salaryMax null thì soi salaryMin (theo salaryWhere)", () => {
    const j = { ...base, salaryMax: null, salaryMin: 50_000_000 };
    expect(matchesAlert(j, { salaryMillions: 40 })).toBe(true);
    const j2 = { ...base, salaryMax: null, salaryMin: null };
    expect(matchesAlert(j2, { salaryMillions: 10 })).toBe(false);
  });
});

describe("alertLabel", () => {
  it("rỗng -> Tất cả việc làm", () => {
    expect(alertLabel({})).toBe("Tất cả việc làm");
  });
  it("nối các tiêu chí bằng ' · '", () => {
    expect(alertLabel({ term: "React", category: "it", employmentType: "FULL_TIME" }))
      .toBe("React · Công nghệ thông tin · Toàn thời gian");
  });
  it("gồm cấp bậc và lương", () => {
    expect(alertLabel({ experienceLevel: "SENIOR", salaryMillions: 30 }))
      .toBe("Senior · Từ 30 triệu");
  });
});

describe("criteriaFromFilter / criteriaToQuery", () => {
  it("bỏ term rỗng, giữ tiêu chí có mặt", () => {
    expect(criteriaFromFilter({ term: "  ", category: "it" })).toEqual({ category: "it" });
    expect(criteriaFromFilter({ term: "react", salaryMillions: 20 }))
      .toEqual({ term: "react", salaryMillions: 20 });
  });
  it("criteriaToQuery ánh xạ đúng key của /jobs", () => {
    expect(criteriaToQuery({ term: "react", category: "it", employmentType: "FULL_TIME", experienceLevel: "MID", salaryMillions: 20 }))
      .toEqual({ q: "react", category: "it", type: "FULL_TIME", level: "MID", salary: "20" });
    expect(criteriaToQuery({})).toEqual({});
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npm test -- alerts`
Expected: FAIL ("Cannot find module '../alerts'").

- [ ] **Step 3: Cài đặt `lib/jobs/alerts.ts`**

```ts
import type { JobsFilter } from "./job-query";
import type { JobCategory } from "./job-categories";
import { JOB_CATEGORY_LABELS } from "./job-categories";
import type { EmploymentType, ExperienceLevel } from "./job-fields";
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from "./job-fields";

const MILLION = 1_000_000;

export type AlertCriteria = {
  term?: string;
  category?: JobCategory;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  salaryMillions?: number | null;
};

export type MatchableJob = {
  title: string;
  company: string;
  rawText: string;
  location: string | null;
  skills: string;
  category: string | null;
  employmentType: EmploymentType | null;
  experienceLevel: ExperienceLevel | null;
  salaryMin: number | null;
  salaryMax: number | null;
};

function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function matchesAlert(job: MatchableJob, c: AlertCriteria): boolean {
  const term = (c.term ?? "").trim();
  if (term) {
    const hay = [job.title, job.company, job.rawText, job.location ?? "", job.skills].join(" ");
    if (!includesCI(hay, term)) return false;
  }
  if (c.category && job.category !== c.category) return false;
  if (c.employmentType && job.employmentType !== c.employmentType) return false;
  if (c.experienceLevel && job.experienceLevel !== c.experienceLevel) return false;
  if (c.salaryMillions != null) {
    const vnd = c.salaryMillions * MILLION;
    const ok =
      (job.salaryMax != null && job.salaryMax >= vnd) ||
      (job.salaryMax == null && job.salaryMin != null && job.salaryMin >= vnd);
    if (!ok) return false;
  }
  return true;
}

export function alertLabel(c: AlertCriteria): string {
  const parts: string[] = [];
  const term = (c.term ?? "").trim();
  if (term) parts.push(term);
  if (c.category) parts.push(JOB_CATEGORY_LABELS[c.category]);
  if (c.employmentType) parts.push(EMPLOYMENT_TYPE_LABELS[c.employmentType]);
  if (c.experienceLevel) parts.push(EXPERIENCE_LEVEL_LABELS[c.experienceLevel]);
  if (c.salaryMillions != null) parts.push(`Từ ${c.salaryMillions} triệu`);
  return parts.length > 0 ? parts.join(" · ") : "Tất cả việc làm";
}

export function criteriaFromFilter(f: JobsFilter): AlertCriteria {
  const c: AlertCriteria = {};
  const term = (f.term ?? "").trim();
  if (term) c.term = term;
  if (f.category) c.category = f.category;
  if (f.employmentType) c.employmentType = f.employmentType;
  if (f.experienceLevel) c.experienceLevel = f.experienceLevel;
  if (f.salaryMillions != null) c.salaryMillions = f.salaryMillions;
  return c;
}

export function criteriaToQuery(c: AlertCriteria): Record<string, string> {
  const q: Record<string, string> = {};
  const term = (c.term ?? "").trim();
  if (term) q.q = term;
  if (c.category) q.category = c.category;
  if (c.employmentType) q.type = c.employmentType;
  if (c.experienceLevel) q.level = c.experienceLevel;
  if (c.salaryMillions != null) q.salary = String(c.salaryMillions);
  return q;
}
```

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npm test -- alerts`
Expected: PASS.

- [ ] **Step 5: Thêm model `JobAlert` + quan hệ**

Trong `prisma/schema.prisma`, thêm dòng vào `model User` (cạnh `notifications Notification[]`):

```prisma
  jobAlerts       JobAlert[]
```

Thêm model mới ở cuối file:

```prisma
model JobAlert {
  id              String           @id @default(cuid())
  userId          String
  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  label           String           @default("")
  term            String?
  category        String?
  employmentType  EmploymentType?
  experienceLevel ExperienceLevel?
  salaryMillions  Int?
  createdAt       DateTime         @default(now())

  @@index([userId])
}
```

- [ ] **Step 6: Đồng bộ DB**

Run: `npm run db:push`
Expected: "Your database is now in sync" (chỉ thêm bảng, an toàn).

- [ ] **Step 7: Commit**

```bash
git add lib/jobs/alerts.ts lib/jobs/__tests__/alerts.test.ts prisma/schema.prisma
git commit -m "feat(jobs): job alert matching logic + JobAlert model"
```

---

### Task 2: `notifyMatchingAlerts` + hook vào `createJobDescription`

**Files:**
- Create: `lib/jobs/alert-notify.ts`
- Modify: `lib/jobs/actions.ts`

**Interfaces:**
- Consumes: `matchesAlert`/`MatchableJob`/`AlertCriteria` (Task 1); `createNotification` (`lib/notifications/create.ts`); `prisma` (`lib/db/prisma`).
- Produces: `notifyMatchingAlerts(job: NotifyJob): Promise<void>` với
  `type NotifyJob = MatchableJob & { id: string; userId: string }`.

- [ ] **Step 1: Cài đặt `lib/jobs/alert-notify.ts`**

```ts
import prisma from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/create";
import { matchesAlert, type AlertCriteria, type MatchableJob } from "./alerts";
import type { EmploymentType, ExperienceLevel } from "./job-fields";
import type { JobCategory } from "./job-categories";

export type NotifyJob = MatchableJob & { id: string; userId: string };

// Khi tạo tin công khai mới: tìm mọi JobAlert khớp, tạo thông báo cho các
// ứng viên (khử trùng theo user, loại người đăng tin). Nuốt lỗi để không làm
// hỏng luồng đăng tin.
export async function notifyMatchingAlerts(job: NotifyJob): Promise<void> {
  try {
    const alerts = await prisma.jobAlert.findMany({
      select: {
        userId: true,
        term: true,
        category: true,
        employmentType: true,
        experienceLevel: true,
        salaryMillions: true,
      },
    });

    const recipients = new Set<string>();
    for (const a of alerts) {
      if (a.userId === job.userId) continue;
      if (recipients.has(a.userId)) continue;
      const criteria: AlertCriteria = {
        term: a.term ?? undefined,
        category: (a.category as JobCategory | null) ?? undefined,
        employmentType: (a.employmentType as EmploymentType | null) ?? undefined,
        experienceLevel: (a.experienceLevel as ExperienceLevel | null) ?? undefined,
        salaryMillions: a.salaryMillions,
      };
      if (matchesAlert(job, criteria)) recipients.add(a.userId);
    }

    const message = `Tin mới khớp thông báo của bạn: ${job.title} — ${job.company}`;
    const link = `/jobs/${job.id}`;
    await Promise.all(
      [...recipients].map((userId) => createNotification(userId, { message, link })),
    );
  } catch {
    // Bỏ qua: thông báo lỗi không được cản trở việc đăng tin.
  }
}
```

- [ ] **Step 2: Gọi trong `createJobDescription`**

Trong `lib/jobs/actions.ts`:
- Thêm import cạnh các import hiện có:

```ts
import { notifyMatchingAlerts } from "./alert-notify";
```

- Đổi khối `await prisma.jobDescription.create({...})` để giữ bản ghi rồi bắn thông báo. Thay:

```ts
  await prisma.jobDescription.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      company: parsed.data.company,
      rawText: parsed.data.rawText,
      location: parsed.data.location,
      skills: parsed.data.skills,
      category: parsed.data.category,
      employmentType: parsed.data.employmentType,
      experienceLevel: parsed.data.experienceLevel,
      salaryMin: parsed.data.salaryMin,
      salaryMax: parsed.data.salaryMax,
      salaryNegotiable: parsed.data.salaryNegotiable,
      isPublic: true,
    },
  });
  redirect("/dashboard");
```

bằng:

```ts
  const job = await prisma.jobDescription.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      company: parsed.data.company,
      rawText: parsed.data.rawText,
      location: parsed.data.location,
      skills: parsed.data.skills,
      category: parsed.data.category,
      employmentType: parsed.data.employmentType,
      experienceLevel: parsed.data.experienceLevel,
      salaryMin: parsed.data.salaryMin,
      salaryMax: parsed.data.salaryMax,
      salaryNegotiable: parsed.data.salaryNegotiable,
      isPublic: true,
    },
  });

  await notifyMatchingAlerts({
    id: job.id,
    userId: job.userId,
    title: job.title,
    company: job.company,
    rawText: job.rawText,
    location: job.location,
    skills: job.skills,
    category: job.category,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
  });

  redirect("/dashboard");
```

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công (không lỗi type; `redirect` sau `await` giữ nguyên hành vi).

- [ ] **Step 4: Commit**

```bash
git add lib/jobs/alert-notify.ts lib/jobs/actions.ts
git commit -m "feat(jobs): notify matching alerts on new job post"
```

---

### Task 3: Server actions tạo/xóa alert

**Files:**
- Create: `lib/jobs/alert-actions.ts`

**Interfaces:**
- Consumes: `AlertCriteria`/`alertLabel` (Task 1); `normalizeCategory` (`lib/jobs/job-categories.ts`); `EMPLOYMENT_TYPES`/`EXPERIENCE_LEVELS` (`lib/jobs/job-fields.ts`); `SALARY_FILTER_STEPS` (`lib/jobs/salary.ts`); `auth`, `prisma`.
- Produces:
  - `createJobAlert(input: AlertCriteria): Promise<{ ok: boolean; error?: string }>`
  - `deleteJobAlert(id: string): Promise<void>`

- [ ] **Step 1: Cài đặt `lib/jobs/alert-actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { alertLabel, type AlertCriteria } from "./alerts";
import { normalizeCategory } from "./job-categories";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, type EmploymentType, type ExperienceLevel } from "./job-fields";
import { SALARY_FILTER_STEPS } from "./salary";

export async function createJobAlert(
  input: AlertCriteria,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE") return { ok: false, error: "Chỉ ứng viên dùng được" };

  const term = (input.term ?? "").trim();
  const category = normalizeCategory(input.category);
  const employmentType = EMPLOYMENT_TYPES.includes(input.employmentType as never)
    ? (input.employmentType as EmploymentType)
    : null;
  const experienceLevel = EXPERIENCE_LEVELS.includes(input.experienceLevel as never)
    ? (input.experienceLevel as ExperienceLevel)
    : null;
  const salaryMillions = SALARY_FILTER_STEPS.includes(input.salaryMillions as never)
    ? (input.salaryMillions as number)
    : null;

  const criteria: AlertCriteria = {
    ...(term ? { term } : {}),
    ...(category ? { category } : {}),
    ...(employmentType ? { employmentType } : {}),
    ...(experienceLevel ? { experienceLevel } : {}),
    ...(salaryMillions != null ? { salaryMillions } : {}),
  };

  await prisma.jobAlert.create({
    data: {
      userId,
      label: alertLabel(criteria),
      term: term || null,
      category,
      employmentType,
      experienceLevel,
      salaryMillions,
    },
  });

  revalidatePath("/jobs/alerts");
  return { ok: true };
}

export async function deleteJobAlert(id: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.jobAlert.deleteMany({ where: { id, userId } });
  revalidatePath("/jobs/alerts");
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công.

- [ ] **Step 3: Commit**

```bash
git add lib/jobs/alert-actions.ts
git commit -m "feat(jobs): server actions to create/delete job alerts"
```

---

### Task 4: UI — nút lưu ở `/jobs` + trang `/jobs/alerts`

**Files:**
- Create: `components/jobs/SaveAlertButton.tsx`, `components/jobs/DeleteAlertButton.tsx`, `app/jobs/alerts/page.tsx`
- Modify: `app/jobs/page.tsx`

**Interfaces:**
- Consumes: `createJobAlert`/`deleteJobAlert` (Task 3); `AlertCriteria`/`alertLabel`/`criteriaToQuery` (Task 1); `auth`, `prisma`; `Navbar`.
- Produces: (thành phần UI; không có API cho task sau).

- [ ] **Step 1: `components/jobs/SaveAlertButton.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createJobAlert } from "@/lib/jobs/alert-actions";
import type { AlertCriteria } from "@/lib/jobs/alerts";

export default function SaveAlertButton({ criteria }: { criteria: AlertCriteria }) {
  const [pending, startTransition] = useTransition();
  function onSave() {
    startTransition(async () => {
      const res = await createJobAlert(criteria);
      if (res.ok) toast.success("Đã lưu thông báo việc làm");
      else toast.error(res.error ?? "Lưu thất bại");
    });
  }
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={pending}
      className="text-primary hover:underline disabled:opacity-50"
    >
      🔔 Lưu bộ lọc làm thông báo
    </button>
  );
}
```

- [ ] **Step 2: `components/jobs/DeleteAlertButton.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { deleteJobAlert } from "@/lib/jobs/alert-actions";

export default function DeleteAlertButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => deleteJobAlert(id))}
      disabled={pending}
      className="text-sm text-destructive hover:underline disabled:opacity-50"
    >
      Xóa
    </button>
  );
}
```

- [ ] **Step 3: `app/jobs/alerts/page.tsx`**

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { criteriaToQuery, type AlertCriteria } from "@/lib/jobs/alerts";
import type { JobCategory } from "@/lib/jobs/job-categories";
import type { EmploymentType, ExperienceLevel } from "@/lib/jobs/job-fields";
import DeleteAlertButton from "@/components/jobs/DeleteAlertButton";

export default async function JobAlertsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const alerts = await prisma.jobAlert.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Thông báo việc làm</h1>
          <Link href="/jobs" className="text-sm text-primary hover:underline">← Về tin tuyển dụng</Link>
        </div>
        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Chưa có thông báo nào. Vào <Link href="/jobs" className="text-primary hover:underline">Tin tuyển dụng</Link>, chọn bộ lọc rồi bấm &quot;Lưu bộ lọc làm thông báo&quot;.
          </div>
        ) : (
          <ul className="space-y-3">
            {alerts.map((a) => {
              const criteria: AlertCriteria = {
                term: a.term ?? undefined,
                category: (a.category as JobCategory | null) ?? undefined,
                employmentType: (a.employmentType as EmploymentType | null) ?? undefined,
                experienceLevel: (a.experienceLevel as ExperienceLevel | null) ?? undefined,
                salaryMillions: a.salaryMillions,
              };
              const query = new URLSearchParams(criteriaToQuery(criteria)).toString();
              return (
                <li key={a.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
                  <div>
                    <div className="font-medium text-foreground">{a.label || "Tất cả việc làm"}</div>
                    <Link href={query ? `/jobs?${query}` : "/jobs"} className="text-sm text-primary hover:underline">
                      Xem việc khớp →
                    </Link>
                  </div>
                  <DeleteAlertButton id={a.id} />
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Nối nút lưu + link vào `app/jobs/page.tsx`**

Thêm import cạnh các import hiện có:

```tsx
import { criteriaFromFilter } from "@/lib/jobs/alerts";
import SaveAlertButton from "@/components/jobs/SaveAlertButton";
```

Thay khối `{isCandidate && (...)}` (dải link "Tin đã lưu"/"Gợi ý việc cho tôi") bằng:

```tsx
        {isCandidate && (
          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
            <Link href="/jobs/saved" className="text-primary hover:underline">Tin đã lưu</Link>
            <Link href="/jobs/recommendations" className="text-primary hover:underline">Gợi ý việc cho tôi</Link>
            <Link href="/jobs/alerts" className="text-primary hover:underline">Thông báo đã lưu</Link>
            <SaveAlertButton
              criteria={criteriaFromFilter({
                term,
                employmentType: typeFilter,
                experienceLevel: levelFilter,
                salaryMillions: salaryFilter,
                category: categoryFilter,
              })}
            />
          </div>
        )}
```

- [ ] **Step 5: Verify lint + build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công. `/jobs/alerts` render; nút lưu chỉ hiện cho ứng viên.

- [ ] **Step 6: Commit**

```bash
git add components/jobs/SaveAlertButton.tsx components/jobs/DeleteAlertButton.tsx app/jobs/alerts/page.tsx app/jobs/page.tsx
git commit -m "feat(jobs): save-alert button + /jobs/alerts management page"
```

---

### Task 5: Rà soát & kiểm thử tổng

**Files:** (rà soát)

- [ ] **Step 1: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS (gồm `alerts`).

- [ ] **Step 2: Build production**

Run: `npm run build`
Expected: thành công, không lỗi type.

- [ ] **Step 3: Chạy thử thủ công (khuyến nghị)**

Run: `npm run dev` — đăng nhập ứng viên, vào `/jobs`, chọn bộ lọc, bấm "Lưu bộ lọc làm thông báo" (thấy toast). Vào `/jobs/alerts` xác nhận alert + "Xem việc khớp". Đăng nhập tài khoản NTD (trình duyệt khác), đăng tin khớp tiêu chí → ứng viên thấy badge/thông báo mới + toast (realtime poll). Đăng tin KHÔNG khớp → không có thông báo. Xóa alert.

- [ ] **Step 4: Commit dọn dẹp nếu có**

```bash
git add -A
git commit -m "chore(jobs): finalize job alerts feature"
```

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** model `JobAlert` → Task 1; khớp thuần + nhãn + chuyển đổi → Task 1; kích hoạt khi tạo tin + khử trùng/loại người đăng → Task 2; server actions tạo/xóa → Task 3; nút lưu ở `/jobs` + trang `/jobs/alerts` + điều hướng → Task 4; kiểm thử → Task 5. ✅ (Trường `location` bị bỏ có chủ đích — xem mục "Điều chỉnh so với spec".)
- **Placeholder scan:** không TODO/TBD; mọi bước có code/lệnh cụ thể.
- **Type consistency:** `AlertCriteria`/`MatchableJob` (Task 1) dùng nhất quán ở `notifyMatchingAlerts` (Task 2, `NotifyJob = MatchableJob & {id,userId}`), `createJobAlert(input: AlertCriteria)` (Task 3), `SaveAlertButton`/trang alerts (Task 4). `criteriaFromFilter`/`criteriaToQuery`/`alertLabel` khớp chữ ký giữa các task. Salary khớp soi `salaryWhere` (dựa `salaryMax`/`salaryMin`), đồng nhất trang duyệt. Các cột `JobAlert` (term/category/employmentType/experienceLevel/salaryMillions) khớp select ở Task 2 & 4 và data ở Task 3.
- **Thứ tự an toàn:** Task 2/3/4 phụ thuộc Task 1 (model + hàm). Task 2 độc lập với UI; Task 4 phụ thuộc Task 3 (actions). Mỗi task tự build/lint xanh.
