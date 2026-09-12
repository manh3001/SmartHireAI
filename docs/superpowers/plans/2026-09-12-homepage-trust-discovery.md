# Trang chủ tin cậy & khám phá — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng trang chủ SmartHire về mức các web tuyển dụng thật (tường logo tin cậy, chip xu hướng + chọn địa điểm ngay hero, tag trên thẻ việc, hàng công cụ), chỉ dùng dữ liệu sẵn có.

**Architecture:** Toàn bộ logic thuần (tallySkills, jobBadges, mệnh đề lọc location) tách khỏi I/O để unit-test bằng vitest. Trang chủ (`app/page.tsx`, server component, `force-dynamic`) mở rộng `Promise.all` sẵn có để lấy thêm top skills + top companies rồi truyền xuống các component con mới. Backend chỉ chạm 1 điểm: thêm bộ lọc `location` tại choke point `appendFilters` (lan tự động sang cả search và facet).

**Tech Stack:** Next.js (App Router, phiên bản trong `node_modules/next/dist/docs/` — ĐỌC guide trước khi viết), React server components, Prisma 6, Tailwind, lucide-react, vitest.

## Global Constraints

- Prisma giữ v6 — KHÔNG nâng v7.
- Không thêm bảng / migration. Chỉ thêm 1 query param `location`.
- Trang chủ công khai; link sâu (`/jobs`, `/companies/[id]`) sau đăng nhập → khách chưa đăng nhập trỏ `/login` (đồng nhất `JobCard`).
- Tường logo: công ty không có logo → fallback `CompanyAvatar` (avatar gradient chữ cái). Section hiển thị khi có ≥1 công ty.
- Tiếng Việt cho mọi văn bản UI.
- Giữ toàn bộ test hiện có xanh (~373 test). Chạy test qua `npx vitest run <path>`.

---

### Task 1: Dọn rác

**Files:**
- Delete: thư mục `C:UsersMANHprojectcv-ai-platform.gitsdd/` (rỗng, không được git theo dõi)
- Modify: `.gitignore`

- [ ] **Step 1: Xóa thư mục rác**

Chạy (Bash tool):
```bash
rmdir "C:UsersMANHprojectcv-ai-platform.gitsdd" 2>/dev/null; ls -d "C:UsersMANHprojectcv-ai-platform.gitsdd" 2>/dev/null || echo "đã xóa"
```
Expected: in ra `đã xóa`.

- [ ] **Step 2: Thêm `.firecrawl/` vào `.gitignore`**

Thêm vào cuối `.gitignore`:
```
# Firecrawl (mockup/khảo sát tạm)
.firecrawl/
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: dọn thư mục rác + ignore .firecrawl/"
```

---

### Task 2: Helper `jobBadges` + tag trên thẻ việc

**Files:**
- Create: `lib/jobs/job-badges.ts`
- Create: `lib/jobs/__tests__/job-badges.test.ts`
- Modify: `components/JobCard.tsx` (thêm `createdAt` vào `JobCardData`, render badge)

**Interfaces:**
- Produces:
  - `export type JobBadge = { label: string; tone: "new" | "salary" }`
  - `export const HIGH_SALARY_VND = 40_000_000`
  - `export const NEW_JOB_DAYS = 7`
  - `export function jobBadges(job: { createdAt?: string | Date | null; salaryMax?: number | null }, now?: Date): JobBadge[]`

- [ ] **Step 1: Viết test thất bại**

`lib/jobs/__tests__/job-badges.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { jobBadges, HIGH_SALARY_VND } from "../job-badges";

const NOW = new Date("2026-09-12T00:00:00Z");

describe("jobBadges", () => {
  it("khong co createdAt va luong thap -> khong badge", () => {
    expect(jobBadges({ salaryMax: 10_000_000 }, NOW)).toEqual([]);
  });

  it("createdAt trong 7 ngay -> co badge Moi", () => {
    const b = jobBadges({ createdAt: new Date("2026-09-08T00:00:00Z") }, NOW);
    expect(b).toEqual([{ label: "Mới", tone: "new" }]);
  });

  it("createdAt dung 7 ngay van la Moi (bien)", () => {
    const b = jobBadges({ createdAt: new Date("2026-09-05T00:00:00Z") }, NOW);
    expect(b.some((x) => x.tone === "new")).toBe(true);
  });

  it("createdAt qua 7 ngay -> khong Moi", () => {
    const b = jobBadges({ createdAt: new Date("2026-09-04T00:00:00Z") }, NOW);
    expect(b.some((x) => x.tone === "new")).toBe(false);
  });

  it("salaryMax >= nguong -> badge Luong cao", () => {
    const b = jobBadges({ salaryMax: HIGH_SALARY_VND }, NOW);
    expect(b).toEqual([{ label: "Lương cao", tone: "salary" }]);
  });

  it("salaryMax duoi nguong -> khong Luong cao", () => {
    const b = jobBadges({ salaryMax: HIGH_SALARY_VND - 1 }, NOW);
    expect(b.some((x) => x.tone === "salary")).toBe(false);
  });

  it("ca hai dieu kien -> Moi truoc, Luong cao sau", () => {
    const b = jobBadges(
      { createdAt: new Date("2026-09-10T00:00:00Z"), salaryMax: 50_000_000 },
      NOW,
    );
    expect(b).toEqual([
      { label: "Mới", tone: "new" },
      { label: "Lương cao", tone: "salary" },
    ]);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/jobs/__tests__/job-badges.test.ts`
Expected: FAIL (`Cannot find module '../job-badges'`).

- [ ] **Step 3: Viết implementation tối thiểu**

`lib/jobs/job-badges.ts`:
```ts
export type JobBadge = { label: string; tone: "new" | "salary" };

export const HIGH_SALARY_VND = 40_000_000;
export const NEW_JOB_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function jobBadges(
  job: { createdAt?: string | Date | null; salaryMax?: number | null },
  now: Date = new Date(),
): JobBadge[] {
  const badges: JobBadge[] = [];

  if (job.createdAt != null) {
    const created = new Date(job.createdAt).getTime();
    const ageDays = (now.getTime() - created) / DAY_MS;
    if (ageDays >= 0 && ageDays <= NEW_JOB_DAYS) {
      badges.push({ label: "Mới", tone: "new" });
    }
  }

  if (job.salaryMax != null && job.salaryMax >= HIGH_SALARY_VND) {
    badges.push({ label: "Lương cao", tone: "salary" });
  }

  return badges;
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/jobs/__tests__/job-badges.test.ts`
Expected: PASS (7 test).

- [ ] **Step 5: Render badge trong `JobCard.tsx`**

Trong `components/JobCard.tsx`, thêm `createdAt` vào type và render badge. Sửa `JobCardData` (thêm dòng):
```ts
  rawText?: string | null;
  createdAt?: string | Date | null;
```
Thêm import đầu file:
```ts
import { jobBadges } from "@/lib/jobs/job-badges";
```
Trong hàm, trước `const inner`, tính:
```ts
  const badges = jobBadges(job);
```
Trong `inner`, ngay dưới dòng company (`<div className="truncate text-sm text-muted-foreground">{job.company || "—"}</div>`), thêm:
```tsx
          {badges.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className={
                    b.tone === "new"
                      ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                      : "rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                  }
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}
```

- [ ] **Step 6: Kiểm tra typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: toàn bộ PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/jobs/job-badges.ts lib/jobs/__tests__/job-badges.test.ts components/JobCard.tsx
git commit -m "feat(jobs): tag Mới/Lương cao trên thẻ việc (jobBadges)"
```

---

### Task 3: Helper `tallySkills` + `topSkills` (chip xu hướng)

**Files:**
- Create: `lib/jobs/top-skills.ts`
- Create: `lib/jobs/__tests__/top-skills.test.ts`

**Interfaces:**
- Consumes: `prisma` từ `@/lib/db/prisma`
- Produces:
  - `export function tallySkills(rows: { skills: string }[], limit?: number): string[]`
  - `export async function topSkills(limit?: number): Promise<string[]>`

- [ ] **Step 1: Viết test thất bại**

`lib/jobs/__tests__/top-skills.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { tallySkills } from "../top-skills";

describe("tallySkills", () => {
  it("chuoi rong/khoang trang -> []", () => {
    expect(tallySkills([{ skills: "" }, { skills: "   " }])).toEqual([]);
  });

  it("dem tan suat, sap xep giam dan", () => {
    const rows = [
      { skills: "React, Node" },
      { skills: "react, TypeScript" },
      { skills: "React" },
    ];
    // React xuat hien 3 (khong phan biet hoa thuong) -> dau tien
    expect(tallySkills(rows)[0]).toBe("React");
  });

  it("gop trung khong phan biet hoa thuong, giu dang hien thi lan dau", () => {
    const rows = [{ skills: "react" }, { skills: "REACT" }];
    expect(tallySkills(rows)).toEqual(["react"]);
  });

  it("dedupe trong cung mot tin", () => {
    const rows = [{ skills: "React, React, Node" }];
    const out = tallySkills(rows);
    expect(out.filter((s) => s.toLowerCase() === "react")).toHaveLength(1);
  });

  it("gioi han limit", () => {
    const rows = [{ skills: "a, b, c, d, e" }];
    expect(tallySkills(rows, 3)).toHaveLength(3);
  });

  it("tie-break theo alphabet khi cung tan suat", () => {
    const rows = [{ skills: "Zebra, Apple" }];
    expect(tallySkills(rows)).toEqual(["Apple", "Zebra"]);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/jobs/__tests__/top-skills.test.ts`
Expected: FAIL (`Cannot find module '../top-skills'`).

- [ ] **Step 3: Viết implementation**

`lib/jobs/top-skills.ts`:
```ts
import prisma from "@/lib/db/prisma";

export function tallySkills(rows: { skills: string }[], limit = 8): string[] {
  const counts = new Map<string, { display: string; count: number }>();

  for (const row of rows) {
    const seen = new Set<string>();
    for (const raw of (row.skills ?? "").split(",")) {
      const skill = raw.trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { display: skill, count: 1 });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display, "vi"))
    .slice(0, limit)
    .map((e) => e.display);
}

export async function topSkills(limit = 8): Promise<string[]> {
  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { skills: true },
  });
  return tallySkills(rows, limit);
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/jobs/__tests__/top-skills.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/top-skills.ts lib/jobs/__tests__/top-skills.test.ts
git commit -m "feat(jobs): tallySkills/topSkills cho chip xu hướng"
```

---

### Task 4: Bộ lọc `location` (backend + wiring)

**Files:**
- Modify: `lib/jobs/job-sql.ts` (thêm `location` vào `JobFilterInput` + `appendFilters`)
- Modify: `lib/jobs/__tests__/job-sql.test.ts` (thêm test)
- Modify: `app/jobs/page.tsx` (đọc + truyền param)
- Modify: `components/jobs/JobFilters.tsx` (giữ giá trị location khi lọc)
- Create: `lib/jobs/locations.ts`

**Interfaces:**
- Produces:
  - `JobFilterInput` có thêm `location?: string`
  - `export const LOCATION_OPTIONS: { value: string; label: string }[]`

- [ ] **Step 1: Viết test thất bại (appendFilters có location)**

Thêm vào `lib/jobs/__tests__/job-sql.test.ts` (trong `describe("appendFilters", ...)`):
```ts
  it("location -> them clause ILIKE voi param", () => {
    const params: unknown[] = [];
    const { clauses } = appendFilters({ location: "Hà Nội" }, makePush(params));
    expect(clauses).toContain(`location ILIKE '%'||$1||'%'`);
    expect(params).toEqual(["Hà Nội"]);
  });

  it("location rong/khoang trang -> bo qua", () => {
    const params: unknown[] = [];
    const { clauses } = appendFilters({ location: "   " }, makePush(params));
    expect(clauses.some((c) => c.includes("location ILIKE"))).toBe(false);
    expect(params).toEqual([]);
  });
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/jobs/__tests__/job-sql.test.ts`
Expected: FAIL (clause location chưa tồn tại).

- [ ] **Step 3: Thêm `location` vào `job-sql.ts`**

Trong `lib/jobs/job-sql.ts`, sửa type:
```ts
export type JobFilterInput = {
  term?: string;
  employmentType?: string;
  experienceLevel?: string;
  category?: string;
  salaryMillions?: number | null;
  location?: string;
};
```
Trong `appendFilters`, ngay trước `if (input.salaryMillions != null) {`, thêm:
```ts
  const location = (input.location ?? "").trim();
  if (location) {
    clauses.push(`location ILIKE '%'||${push(location)}||'%'`);
  }
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/jobs/__tests__/job-sql.test.ts`
Expected: PASS (test cũ + 2 test mới).

- [ ] **Step 5: Tạo danh sách địa điểm**

`lib/jobs/locations.ts`:
```ts
// value = phần lõi để ILIKE khớp cột location (chuỗi tự do); label = nhãn hiển thị.
export const LOCATION_OPTIONS: { value: string; label: string }[] = [
  { value: "Hà Nội", label: "Hà Nội" },
  { value: "Hồ Chí Minh", label: "TP. Hồ Chí Minh" },
  { value: "Đà Nẵng", label: "Đà Nẵng" },
  { value: "Remote", label: "Remote" },
];
```

- [ ] **Step 6: Đọc + truyền `location` ở `app/jobs/page.tsx`**

Sửa kiểu `searchParams`:
```ts
  searchParams: Promise<{ q?: string; type?: string; level?: string; salary?: string; category?: string; location?: string }>;
```
Sửa destructure:
```ts
  const { q, type, level, salary, category, location } = await searchParams;
```
Sau dòng `const categoryFilter = ...`, thêm:
```ts
  const locationFilter = (location ?? "").trim() || undefined;
```
Thêm vào `filterInput`:
```ts
  const filterInput = {
    term,
    employmentType: typeFilter,
    experienceLevel: levelFilter,
    salaryMillions: salaryFilter,
    category: categoryFilter,
    location: locationFilter,
  };
```
Thêm `location` vào `defaults` truyền cho `JobFilters`:
```tsx
            <JobFilters defaults={{ q: term, type: typeFilter, level: levelFilter, salary: salary ?? "", category: categoryFilter, location: locationFilter }} facets={facets} />
```

- [ ] **Step 7: Giữ location trong `JobFilters.tsx`**

Trong `components/jobs/JobFilters.tsx`, thêm import:
```ts
import { LOCATION_OPTIONS } from "@/lib/jobs/locations";
```
Sửa type `Defaults`:
```ts
type Defaults = { q?: string; type?: string; level?: string; salary?: string; category?: string; location?: string };
```
Sau `<select name="category" ...>...</select>`, thêm select địa điểm:
```tsx
      <select name="location" defaultValue={defaults.location ?? ""} className={sel}>
        <option value="">Mọi địa điểm</option>
        {LOCATION_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
```

- [ ] **Step 8: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: toàn bộ PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/jobs/job-sql.ts lib/jobs/__tests__/job-sql.test.ts lib/jobs/locations.ts app/jobs/page.tsx components/jobs/JobFilters.tsx
git commit -m "feat(jobs): bộ lọc địa điểm (location) ở /jobs"
```

---

### Task 5: Hero search nâng cấp (địa điểm + chip xu hướng)

**Files:**
- Modify: `components/home/HomeSearch.tsx`
- Modify: `app/page.tsx` (gọi `topSkills`, truyền prop)

**Interfaces:**
- Consumes: `LOCATION_OPTIONS` (`lib/jobs/locations.ts`), `topSkills` (`lib/jobs/top-skills.ts`)
- Produces: `HomeSearch` nhận prop `trendingSkills: string[]`

- [ ] **Step 1: Nâng cấp `HomeSearch.tsx`**

Thay toàn bộ `components/home/HomeSearch.tsx`:
```tsx
import Link from "next/link";
import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LOCATION_OPTIONS } from "@/lib/jobs/locations";

export default function HomeSearch({ trendingSkills = [] }: { trendingSkills?: string[] }) {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <form
        action="/jobs"
        method="get"
        className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm sm:flex-row"
      >
        <div className="flex flex-1 items-center gap-2 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            placeholder="Vị trí, công ty, kỹ năng..."
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        <select
          name="location"
          defaultValue=""
          aria-label="Địa điểm"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground sm:border-0 sm:bg-transparent"
        >
          <option value="">Mọi địa điểm</option>
          {LOCATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button type="submit" className={buttonVariants({ size: "lg", className: "bg-brand-gradient" })}>
          Tìm việc
        </button>
      </form>

      {trendingSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Xu hướng:</span>
          {trendingSkills.map((skill) => (
            <Link
              key={skill}
              href={`/jobs?q=${encodeURIComponent(skill)}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {skill}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Gọi `topSkills` và truyền prop ở `app/page.tsx`**

Thêm import:
```ts
import { topSkills } from "@/lib/jobs/top-skills";
```
Thêm `topSkills(8)` vào `Promise.all` (thêm biến `trendingSkills`):
```ts
  const [latestJobs, jobCount, companyGroups, cvCount, trendingSkills] = await Promise.all([
```
(giữ nguyên 4 lời gọi cũ, thêm cuối mảng:)
```ts
    topSkills(8),
```
Sửa dùng `<HomeSearch />` thành:
```tsx
            <HomeSearch trendingSkills={trendingSkills} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → Expected: không lỗi.

- [ ] **Step 4: Chạy app kiểm tra bằng mắt (tùy chọn nhưng khuyến nghị)**

Run: `npm run dev` rồi mở `/` — thấy dropdown địa điểm + hàng chip xu hướng dưới ô tìm; bấm chip → `/jobs?q=<skill>` (khách chưa đăng nhập → `/login`).

- [ ] **Step 5: Commit**

```bash
git add components/home/HomeSearch.tsx app/page.tsx
git commit -m "feat(home): hero search có chọn địa điểm + chip xu hướng"
```

---

### Task 6: Tường "Nhà tuyển dụng tiêu biểu"

**Files:**
- Create: `lib/company/top-companies.ts`
- Create: `components/home/TrustedCompanies.tsx`
- Modify: `app/page.tsx` (fetch + render)

**Interfaces:**
- Consumes: `rankCompanies`, `CompanyDirItem` (`lib/company/directory`); `prisma`
- Produces:
  - `export async function fetchTopCompanies(limit?: number): Promise<CompanyDirItem[]>`
  - `TrustedCompanies` nhận `{ companies: CompanyDirItem[]; loggedIn: boolean }`

- [ ] **Step 1: Data helper `fetchTopCompanies`**

`lib/company/top-companies.ts` (tái dùng mẫu truy vấn của `app/companies/page.tsx`):
```ts
import prisma from "@/lib/db/prisma";
import { rankCompanies, type CompanyDirInput, type CompanyDirItem, type CompanyRating } from "@/lib/company/directory";

export async function fetchTopCompanies(limit = 12): Promise<CompanyDirItem[]> {
  const counts = await prisma.jobDescription.groupBy({
    by: ["userId"],
    where: { isPublic: true },
    _count: { _all: true },
  });
  const countByUserId: Record<string, number> = {};
  for (const c of counts) countByUserId[c.userId] = c._count._all;
  const userIds = counts.map((c) => c.userId);
  if (userIds.length === 0) return [];

  const companies: CompanyDirInput[] = await prisma.companyProfile.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true, name: true, description: true, location: true, logoUrl: true },
  });

  const companyIds = companies.map((c) => c.id);
  const ratingRows = companyIds.length === 0 ? [] : await prisma.companyReview.groupBy({
    by: ["companyId"],
    where: { companyId: { in: companyIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const ratingByCompanyId: Record<string, CompanyRating> = {};
  for (const row of ratingRows) {
    ratingByCompanyId[row.companyId] = {
      average: Math.round((row._avg.rating ?? 0) * 10) / 10,
      count: row._count.rating,
    };
  }

  return rankCompanies(companies, countByUserId, ratingByCompanyId).slice(0, limit);
}
```

- [ ] **Step 2: Component `TrustedCompanies.tsx`**

`components/home/TrustedCompanies.tsx`:
```tsx
import Link from "next/link";
import Image from "next/image";
import type { CompanyDirItem } from "@/lib/company/directory";
import CompanyAvatar from "@/components/CompanyAvatar";

export default function TrustedCompanies({
  companies,
  loggedIn,
}: {
  companies: CompanyDirItem[];
  loggedIn: boolean;
}) {
  if (companies.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="mb-6 text-center text-2xl font-bold text-foreground">Nhà tuyển dụng tiêu biểu</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {companies.map((c) => (
          <Link
            key={c.id}
            href={loggedIn ? `/companies/${c.id}` : "/login"}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            {c.logoUrl ? (
              <Image
                src={c.logoUrl}
                alt={c.name}
                width={40}
                height={40}
                className="h-10 w-10 flex-none rounded-lg object-cover"
              />
            ) : (
              <CompanyAvatar name={c.name} className="h-10 w-10" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">{c.jobCount} tin đang tuyển</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Fetch + render trong `app/page.tsx`**

Thêm import:
```ts
import TrustedCompanies from "@/components/home/TrustedCompanies";
import { fetchTopCompanies } from "@/lib/company/top-companies";
```
Thêm `fetchTopCompanies(12)` vào `Promise.all` (thêm biến `topCompanies`):
```ts
    fetchTopCompanies(12),
```
(cập nhật destructure mảng cho khớp thứ tự.)
Chèn `<TrustedCompanies companies={topCompanies} loggedIn={loggedIn} />` ngay sau khối `{/* Ngành nghề */}` (trước khối "Việc mới").

- [ ] **Step 4: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: toàn bộ PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/company/top-companies.ts components/home/TrustedCompanies.tsx app/page.tsx
git commit -m "feat(home): tường Nhà tuyển dụng tiêu biểu"
```

---

### Task 7: Hàng "Công cụ nổi bật"

**Files:**
- Create: `components/home/FeatureTools.tsx`
- Modify: `app/page.tsx` (render)

**Interfaces:**
- Produces: `FeatureTools` (không prop)

- [ ] **Step 1: Component `FeatureTools.tsx`**

`components/home/FeatureTools.tsx`:
```tsx
import Link from "next/link";
import { FileText, Building2, Sparkles, Bell } from "lucide-react";

const tools = [
  { href: "/cv", icon: FileText, title: "Tạo CV", desc: "Dựng CV chuẩn, AI đọc PDF cũ giúp bạn." },
  { href: "/companies", icon: Building2, title: "Đánh giá công ty", desc: "Xem nhận xét & rating trước khi ứng tuyển." },
  { href: "/jobs/recommendations", icon: Sparkles, title: "Việc gợi ý cho tôi", desc: "AI gợi ý tin phù hợp với hồ sơ." },
  { href: "/jobs/alerts", icon: Bell, title: "Thông báo việc làm", desc: "Nhận email khi có tin khớp tiêu chí." },
];

export default function FeatureTools() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="mb-6 text-center text-2xl font-bold text-foreground">Công cụ nổi bật</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <t.icon className="h-5 w-5" />
            </span>
            <div className="font-semibold text-foreground">{t.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render trong `app/page.tsx`**

Thêm import:
```ts
import FeatureTools from "@/components/home/FeatureTools";
```
Chèn `<FeatureTools />` ngay trước khối `{/* 3 bước */}` (Cách hoạt động).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → Expected: không lỗi.

- [ ] **Step 4: Commit**

```bash
git add components/home/FeatureTools.tsx app/page.tsx
git commit -m "feat(home): hàng Công cụ nổi bật"
```

---

### Task 8: Kiểm chứng cuối

**Files:** (không sửa; chỉ chạy)

- [ ] **Step 1: Lint + typecheck + test đầy đủ**

Run:
```bash
npx tsc --noEmit
npm run lint
npx vitest run
```
Expected: cả ba sạch; toàn bộ test PASS.

- [ ] **Step 2: Chạy app soát bằng mắt**

Run: `npm run dev`, mở `/`:
- Hero có dropdown địa điểm + chip xu hướng.
- Section "Nhà tuyển dụng tiêu biểu" hiện logo/avatar.
- Thẻ việc "Việc làm mới nhất" có tag Mới/Lương cao (nếu dữ liệu thỏa).
- Section "Công cụ nổi bật" hiện 4 thẻ.
- Vào `/jobs`, chọn địa điểm trong bộ lọc → danh sách lọc đúng; đổi trang giữ được địa điểm.

- [ ] **Step 3: Cập nhật memory (tùy)**

Ghi 1 memory `project` tóm tắt Gói A đã xong + link `[[ui-overhaul-roadmap]]`.

## Self-Review

- **Spec coverage:** Hero+địa điểm (Task 4,5) ✅ · filter location (Task 4) ✅ · chip xu hướng (Task 3,5) ✅ · tường logo (Task 6) ✅ · tag thẻ việc (Task 2) ✅ · công cụ nổi bật (Task 7) ✅ · dọn rác (Task 1) ✅ · kiểm thử (Task 2,3,4 + Task 8) ✅.
- **Placeholder scan:** không có TBD/TODO; mọi step code đều đầy đủ.
- **Type consistency:** `JobFilterInput.location`, `LOCATION_OPTIONS`, `jobBadges`, `JobBadge`, `tallySkills/topSkills`, `fetchTopCompanies`, `CompanyDirItem` dùng nhất quán giữa các task.
