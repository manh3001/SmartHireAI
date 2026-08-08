# Danh bạ công ty `/companies` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trang danh bạ công ty `/companies` liệt kê công ty đang tuyển (có hồ sơ + ≥1 tin công khai), tìm theo tên, sắp theo số tin; mỗi mục dẫn tới `/companies/[id]`.

**Architecture:** Server page `app/companies/page.tsx` chạy 2 truy vấn Prisma (groupBy đếm tin theo `userId` + `findMany` hồ sơ công ty lọc tên) rồi gộp/sắp xếp bằng hàm thuần `rankCompanies` (`lib/company/directory.ts`, có test). Thẻ dùng chung `components/companies/CompanyCard.tsx`. Thêm link "Công ty" vào `Navbar`.

**Tech Stack:** Next.js 16, React 19, Prisma 6 (Neon/Postgres), Tailwind v4, Vitest.

## Global Constraints

- Prisma **pinned v6**; KHÔNG đổi `prisma/schema.prisma` (chỉ dùng dữ liệu sẵn có).
- Vitest: **chỉ** unit-test hàm thuần `rankCompanies`; component/page/route không unit-test.
- Yêu cầu đăng nhập giống `/jobs` (`redirect("/login")` nếu chưa đăng nhập).
- `className` dùng **nháy thẳng ASCII**; dùng **design token** (`primary`, `muted-foreground`, `border`), không hardcode màu.
- Nội dung tiếng Việt; thương hiệu **SmartHire**. Windows: `npm test`, `npm run lint`, `npm run build`.
- KHÔNG lọc theo địa điểm (backlog); KHÔNG đụng AI/auth/realtime/schema.

## File Structure

**Tạo mới:**
- `lib/company/directory.ts` — hàm thuần `rankCompanies` + types `CompanyDirInput`/`CompanyDirItem`.
- `lib/company/__tests__/directory.test.ts` — test cho `rankCompanies`.
- `components/companies/CompanyCard.tsx` — thẻ 1 công ty (logo/avatar, tên, địa điểm, badge số tin, mô tả rút gọn).
- `app/companies/page.tsx` — trang danh bạ (query + tìm kiếm + lưới + empty state).

**Sửa:**
- `components/Navbar.tsx` — thêm 2 link "Công ty" (mobile + desktop).

---

### Task 1: Hàm thuần `rankCompanies` (TDD)

**Files:**
- Create: `lib/company/directory.ts`
- Test: `lib/company/__tests__/directory.test.ts`

**Interfaces:**
- Produces:
  - `type CompanyDirInput = { id: string; userId: string; name: string; description: string; location: string; logoUrl: string }`
  - `type CompanyDirItem = CompanyDirInput & { jobCount: number }`
  - `function rankCompanies(companies: CompanyDirInput[], countByUserId: Record<string, number>): CompanyDirItem[]`

- [ ] **Step 1: Viết test thất bại**

`lib/company/__tests__/directory.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rankCompanies, type CompanyDirInput } from "../directory";

function mk(over: Partial<CompanyDirInput> & { id: string; userId: string; name: string }): CompanyDirInput {
  return { description: "", location: "", logoUrl: "", ...over };
}

describe("rankCompanies", () => {
  it("sắp theo jobCount giảm dần", () => {
    const companies = [
      mk({ id: "a", userId: "u1", name: "Alpha" }),
      mk({ id: "b", userId: "u2", name: "Beta" }),
      mk({ id: "c", userId: "u3", name: "Gamma" }),
    ];
    const ranked = rankCompanies(companies, { u1: 1, u2: 5, u3: 3 });
    expect(ranked.map((c) => c.id)).toEqual(["b", "c", "a"]);
    expect(ranked.map((c) => c.jobCount)).toEqual([5, 3, 1]);
  });

  it("hòa jobCount thì sắp theo tên tăng dần (locale vi)", () => {
    const companies = [
      mk({ id: "z", userId: "u1", name: "Zeta" }),
      mk({ id: "a", userId: "u2", name: "Ánh Dương" }),
      mk({ id: "m", userId: "u3", name: "Mai" }),
    ];
    const ranked = rankCompanies(companies, { u1: 2, u2: 2, u3: 2 });
    expect(ranked.map((c) => c.name)).toEqual(["Ánh Dương", "Mai", "Zeta"]);
  });

  it("công ty thiếu trong countByUserId -> jobCount 0", () => {
    const companies = [mk({ id: "a", userId: "u1", name: "Alpha" })];
    const ranked = rankCompanies(companies, {});
    expect(ranked[0].jobCount).toBe(0);
  });

  it("mảng rỗng -> mảng rỗng, không đột biến đầu vào", () => {
    const input: CompanyDirInput[] = [];
    expect(rankCompanies(input, {})).toEqual([]);
  });

  it("không đột biến mảng đầu vào", () => {
    const companies = [
      mk({ id: "a", userId: "u1", name: "Alpha" }),
      mk({ id: "b", userId: "u2", name: "Beta" }),
    ];
    const copy = [...companies];
    rankCompanies(companies, { u1: 1, u2: 9 });
    expect(companies).toEqual(copy);
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npm test -- directory`
Expected: FAIL ("Cannot find module '../directory'").

- [ ] **Step 3: Cài đặt `lib/company/directory.ts`**

```ts
export type CompanyDirInput = {
  id: string;
  userId: string;
  name: string;
  description: string;
  location: string;
  logoUrl: string;
};

export type CompanyDirItem = CompanyDirInput & { jobCount: number };

export function rankCompanies(
  companies: CompanyDirInput[],
  countByUserId: Record<string, number>,
): CompanyDirItem[] {
  return companies
    .map((c) => ({ ...c, jobCount: countByUserId[c.userId] ?? 0 }))
    .sort((a, b) => b.jobCount - a.jobCount || a.name.localeCompare(b.name, "vi"));
}
```

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npm test -- directory`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add lib/company/directory.ts lib/company/__tests__/directory.test.ts
git commit -m "feat(companies): rankCompanies pure helper + tests"
```

---

### Task 2: Thẻ công ty `CompanyCard`

**Files:**
- Create: `components/companies/CompanyCard.tsx`

**Interfaces:**
- Consumes: `CompanyDirItem` (Task 1); `CompanyAvatar` (`@/components/CompanyAvatar`); `Card`, `CardContent`, `CardHeader` (`@/components/ui/card`).
- Produces: `export default function CompanyCard({ company }: { company: CompanyDirItem }): JSX.Element`.

- [ ] **Step 1: Tạo `components/companies/CompanyCard.tsx`**

```tsx
import Link from "next/link";
import type { CompanyDirItem } from "@/lib/company/directory";
import CompanyAvatar from "@/components/CompanyAvatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CompanyCard({ company }: { company: CompanyDirItem }) {
  return (
    <Link href={`/companies/${company.id}`} className="block">
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.name} className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <CompanyAvatar name={company.name} className="h-12 w-12" />
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{company.name}</p>
              {company.location && (
                <p className="truncate text-sm text-muted-foreground">📍 {company.location}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {company.jobCount} tin đang tuyển
          </span>
          {company.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{company.description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: không lỗi mới ở `components/companies/CompanyCard.tsx`.

Ghi chú: chưa có nơi dùng `CompanyCard` nên `npm run build` sẽ được verify ở Task 3 khi trang import nó.

- [ ] **Step 3: Commit**

```bash
git add components/companies/CompanyCard.tsx
git commit -m "feat(companies): CompanyCard component"
```

---

### Task 3: Trang `/companies` (query + tìm kiếm + lưới)

**Files:**
- Create: `app/companies/page.tsx`

**Interfaces:**
- Consumes: `rankCompanies` + `CompanyDirInput` (Task 1); `CompanyCard` (Task 2); `prisma` (`@/lib/db/prisma`); `auth` (`@/auth`); `Navbar` (`@/components/Navbar`).

- [ ] **Step 1: Tạo `app/companies/page.tsx`**

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import CompanyCard from "@/components/companies/CompanyCard";
import { rankCompanies, type CompanyDirInput } from "@/lib/company/directory";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q } = await searchParams;
  const term = (q ?? "").trim();

  const counts = await prisma.jobDescription.groupBy({
    by: ["userId"],
    where: { isPublic: true },
    _count: { _all: true },
  });
  const countByUserId: Record<string, number> = {};
  for (const c of counts) countByUserId[c.userId] = c._count._all;
  const userIds = counts.map((c) => c.userId);

  const companies: CompanyDirInput[] =
    userIds.length === 0
      ? []
      : await prisma.companyProfile.findMany({
          where: {
            userId: { in: userIds },
            ...(term ? { name: { contains: term, mode: "insensitive" as const } } : {}),
          },
          select: { id: true, userId: true, name: true, description: true, location: true, logoUrl: true },
        });

  const ranked = rankCompanies(companies, countByUserId);

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <h1 className="text-2xl font-bold text-foreground">Danh bạ công ty</h1>
        <p className="mt-1 text-sm text-muted-foreground">Các công ty đang tuyển dụng trên SmartHire.</p>

        <form method="GET" className="mt-4 flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={term}
            placeholder="Tìm theo tên công ty..."
            className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tìm
          </button>
        </form>

        {ranked.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
            {term
              ? `Không tìm thấy công ty khớp "${term}".`
              : "Chưa có công ty nào đang tuyển."}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run lint` rồi `npm run build`
Expected: thành công. Nếu Prisma báo type cho `mode` không khớp, giữ `mode: "insensitive" as const` (đã dùng ở `buildJobsWhere`/`/jobs` — pattern hợp lệ).

- [ ] **Step 3: Commit**

```bash
git add app/companies/page.tsx
git commit -m "feat(companies): /companies directory page with name search"
```

---

### Task 4: Link "Công ty" trên Navbar

**Files:**
- Modify: `components/Navbar.tsx`

**Interfaces:**
- Consumes: (không có interface mới; chỉ thêm `<Link>`.)

- [ ] **Step 1: Thêm link mobile**

Trong `components/Navbar.tsx`, ngay SAU khối link "Việc làm" ở cụm mobile:

```tsx
              <Link href="/jobs" className="text-sm font-medium text-muted-foreground hover:text-foreground sm:hidden">
                Việc làm
              </Link>
```

thêm:

```tsx
              <Link href="/companies" className="text-sm font-medium text-muted-foreground hover:text-foreground sm:hidden">
                Công ty
              </Link>
```

- [ ] **Step 2: Thêm link desktop**

Trong cụm desktop (`<div className="hidden items-center gap-2 sm:flex">`), ngay SAU link "Việc làm":

```tsx
                <Link href="/jobs" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Việc làm
                </Link>
```

thêm:

```tsx
                <Link href="/companies" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Công ty
                </Link>
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint` rồi `npm run build`
Expected: thành công.

- [ ] **Step 4: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat(companies): add Cong ty link to Navbar"
```

---

### Task 5: Rà soát & kiểm thử tổng

**Files:** (rà soát)

- [ ] **Step 1: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS (gồm `directory` mới; các test cũ vẫn xanh).

- [ ] **Step 2: Build production**

Run: `npm run build`
Expected: thành công, không lỗi type.

- [ ] **Step 3: Chạy thử thủ công (khuyến nghị)**

Run: `npm run dev` — mở `/companies`: thấy công ty có tin công khai, sắp theo số tin; gõ tên vào ô tìm → lọc đúng; bấm 1 thẻ → sang `/companies/[id]`; kiểm link "Công ty" trên Navbar (desktop + mobile). Đăng xuất → vào `/companies` phải chuyển tới `/login`.

- [ ] **Step 4: Commit dọn dẹp nếu có**

```bash
git add -A
git commit -m "chore(companies): finalize directory feature"
```

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** hàm thuần `rankCompanies` → Task 1; `CompanyCard` → Task 2; trang `/companies` (query groupBy + findMany lọc tên + empty state 2 nhánh) → Task 3; link Navbar (mobile+desktop) → Task 4; kiểm thử → Task 5. Yêu cầu "chỉ công ty có hồ sơ + ≥1 tin" thực hiện qua `userId in [groupBy isPublic]` (Task 3). Sắp xếp/tie-break vi (Task 1). ✅
- **Placeholder scan:** không có TODO/TBD; mọi bước có code hoặc lệnh cụ thể.
- **Type consistency:** `CompanyDirInput`/`CompanyDirItem`/`rankCompanies` (Task 1) dùng nhất quán ở Task 2 (`CompanyCard` nhận `CompanyDirItem`) và Task 3 (`companies: CompanyDirInput[]` từ `select` khớp đúng 6 trường; `rankCompanies` trả `CompanyDirItem[]` cho `CompanyCard`). `select` ở Task 3 (id/userId/name/description/location/logoUrl) khớp đúng `CompanyDirInput`.
- **Ràng buộc không đổi schema:** chỉ dùng `CompanyProfile` + `JobDescription` sẵn có; `mode: "insensitive"` theo pattern `/jobs`.
- **Thứ tự an toàn:** Task 1→2→3 theo phụ thuộc (hàm → thẻ → trang dùng cả hai); Task 4 độc lập (Navbar). Build chỉ verify được đầy đủ ở Task 3 khi trang import `CompanyCard` (ghi rõ ở Task 2).
