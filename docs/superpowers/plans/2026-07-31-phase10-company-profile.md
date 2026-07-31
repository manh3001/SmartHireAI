# Company Profile (Phase 10 — Gói D2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi nhà tuyển dụng có hồ sơ công ty (tên, mô tả, website, địa điểm, logo URL), chỉnh qua form; trang công ty công khai liệt kê tin của công ty; liên kết từ tin và dashboard.

**Architecture:** Model `CompanyProfile` (một / mỗi NTD, `userId @unique`). Zod `companySchema` validate form. Action `upsertCompanyProfile` upsert theo userId. Trang `/company/edit` (NTD chỉnh) và `/companies/[id]` (công khai, liệt kê tin `isPublic` của chủ hồ sơ, dùng lại `JobMeta`). Trang chi tiết tin + dashboard NTD thêm link.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 + PostgreSQL (Neon), Auth.js, Zod 4, Vitest, Tailwind 4, lucide-react.

## Global Constraints

- **Next.js là bản có breaking changes.** Trước khi viết route/page/server-action, đọc guide liên quan trong `node_modules/next/dist/docs/`. Pages `await params`.
- **Prisma giữ v6.** Đẩy schema bằng `npm run db:push` (đã bọc ipv4first), KHÔNG dùng `prisma db push` trần.
- **Test:** `npm test` (vitest run). Toàn bộ UI copy **tiếng Việt**.
- **Server actions** dùng `auth()` từ `@/auth`, `prisma` từ `@/lib/db/prisma`; kiểm tra `session.user.role`.
- **Palette:** blue-700 tiêu đề, slate-50 nền, dùng `Card`/`Button`/`Input`/`Label`/`Textarea` từ `@/components/ui`, icon `lucide-react`.
- Áp dụng **TDD** cho logic thuần (`companySchema`); glue/UI/trang không unit-test (an toàn bằng `npx tsc --noEmit` + `npm test` xanh).
- **YAGNI:** không upload file (logo chỉ URL); không đổi ô `company` text trên tin; không auto-điền tên công ty vào form đăng tin.

---

## File Structure

**Tạo mới:**
- `lib/company/schema.ts` — Zod `companySchema` + type `CompanyInput`.
- `lib/company/actions.ts` — `"use server"`: `upsertCompanyProfile(formData)`.
- `lib/company/__tests__/schema.test.ts`.
- `app/company/edit/page.tsx` — form chỉnh hồ sơ (SSR, RECRUITER).
- `app/companies/[id]/page.tsx` — trang công ty công khai.

**Sửa:**
- `prisma/schema.prisma` — model `CompanyProfile` + quan hệ ngược trên `User`.
- `app/jobs/[id]/page.tsx` — link "Xem trang công ty" nếu chủ tin có hồ sơ.
- `app/dashboard/page.tsx` — link "Hồ sơ công ty" + "Xem trang công ty" (NTD).

---

### Task 1: Prisma model CompanyProfile

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: model `CompanyProfile` (`userId @unique`, name, description, website, location, logoUrl); `User.companyProfile CompanyProfile?`.

- [ ] **Step 1: Thêm model + quan hệ ngược**

Ở cuối `prisma/schema.prisma` thêm:
```prisma
model CompanyProfile {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String   @default("")
  website     String   @default("")
  location    String   @default("")
  logoUrl     String   @default("")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```
Trong `model User { ... }` thêm dòng:
```prisma
  companyProfile CompanyProfile?
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
git commit -m "feat(db): add CompanyProfile model"
```

---

### Task 2: Zod companySchema

**Files:**
- Create: `lib/company/schema.ts`
- Test: `lib/company/__tests__/schema.test.ts`

**Interfaces:**
- Produces: `companySchema` (Zod); `type CompanyInput = { name: string; description: string; website: string; location: string; logoUrl: string }`.

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/company/__tests__/schema.test.ts
import { describe, it, expect } from "vitest";
import { companySchema } from "../schema";

const base = {
  name: "ACME",
  description: "Công ty công nghệ",
  website: "https://acme.vn",
  location: "Hà Nội",
  logoUrl: "https://acme.vn/logo.png",
};

describe("companySchema", () => {
  it("chấp nhận input hợp lệ", () => {
    expect(companySchema.safeParse(base).success).toBe(true);
  });

  it("chấp nhận khi chỉ có tên (các trường khác rỗng)", () => {
    const r = companySchema.safeParse({ name: "ACME", description: "", website: "", location: "", logoUrl: "" });
    expect(r.success).toBe(true);
  });

  it("từ chối khi thiếu tên", () => {
    const r = companySchema.safeParse({ ...base, name: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Vui lòng nhập tên công ty");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- company/__tests__/schema`
Expected: FAIL — không import được `../schema`.

- [ ] **Step 3: Viết `lib/company/schema.ts`**

```ts
import { z } from "zod";

export const companySchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên công ty"),
  description: z.string(),
  website: z.string(),
  location: z.string(),
  logoUrl: z.string(),
});

export type CompanyInput = z.infer<typeof companySchema>;
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- company/__tests__/schema`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/company/schema.ts lib/company/__tests__/schema.test.ts
git commit -m "feat(company): zod schema for company profile"
```

---

### Task 3: Action upsertCompanyProfile + trang /company/edit

**Files:**
- Create: `lib/company/actions.ts`
- Create: `app/company/edit/page.tsx`

**Interfaces:**
- Consumes: `companySchema` (`./schema`).
- Produces: `upsertCompanyProfile(formData: FormData): Promise<void>`.

Glue/UI: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: Viết `lib/company/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { companySchema } from "./schema";

export async function upsertCompanyProfile(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const parsed = companySchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    logoUrl: String(formData.get("logoUrl") ?? "").trim(),
  });
  if (!parsed.success) redirect("/company/edit");

  await prisma.companyProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...parsed.data },
    update: { ...parsed.data },
  });

  revalidatePath("/company/edit");
  redirect("/dashboard");
}
```

- [ ] **Step 2: Viết `app/company/edit/page.tsx`**

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { upsertCompanyProfile } from "@/lib/company/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CompanyEditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const profile = await prisma.companyProfile.findUnique({
    where: { userId: session.user.id },
    select: { name: true, description: true, website: true, location: true, logoUrl: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Về dashboard</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle className="text-blue-700">Hồ sơ công ty</CardTitle></CardHeader>
          <CardContent>
            <form action={upsertCompanyProfile} className="grid gap-3">
              <div><Label>Tên công ty</Label>
                <Input name="name" defaultValue={profile?.name ?? ""} placeholder="VD: ACME" required /></div>
              <div><Label>Địa điểm</Label>
                <Input name="location" defaultValue={profile?.location ?? ""} placeholder="VD: Hà Nội" /></div>
              <div><Label>Website</Label>
                <Input name="website" defaultValue={profile?.website ?? ""} placeholder="https://..." /></div>
              <div><Label>Logo (URL ảnh)</Label>
                <Input name="logoUrl" defaultValue={profile?.logoUrl ?? ""} placeholder="https://.../logo.png" /></div>
              <div><Label>Giới thiệu công ty</Label>
                <Textarea name="description" rows={6} defaultValue={profile?.description ?? ""} placeholder="Mô tả về công ty..." /></div>
              <Button type="submit" className="justify-self-start">Lưu hồ sơ</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 4: Commit**

```bash
git add lib/company/actions.ts "app/company/edit/page.tsx"
git commit -m "feat(company): edit form and upsert action"
```

---

### Task 4: Trang công ty công khai /companies/[id]

**Files:**
- Create: `app/companies/[id]/page.tsx`

**Interfaces:**
- Consumes: `JobMeta` (`@/components/JobMeta`).

Glue/UI: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: Viết `app/companies/[id]/page.tsx`**

```tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import JobMeta from "@/components/JobMeta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const company = await prisma.companyProfile.findUnique({
    where: { id },
    select: {
      userId: true, name: true, description: true, website: true, location: true, logoUrl: true,
    },
  });
  if (!company) notFound();

  const jobs = await prisma.jobDescription.findMany({
    where: { userId: company.userId, isPublic: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, company: true, rawText: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
    },
  });

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/jobs" className="text-sm text-blue-600 hover:underline">← Về danh sách việc</Link>

        <Card className="mt-3">
          <CardHeader>
            <div className="flex items-center gap-4">
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logoUrl} alt={company.name} className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Briefcase className="h-6 w-6" />
                </span>
              )}
              <div>
                <CardTitle className="text-blue-700">{company.name}</CardTitle>
                {company.location && <p className="text-sm text-slate-500">📍 {company.location}</p>}
                {company.website && (
                  <a href={company.website} className="text-sm text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    {company.website}
                  </a>
                )}
              </div>
            </div>
          </CardHeader>
          {company.description && (
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{company.description}</p>
            </CardContent>
          )}
        </Card>

        <h2 className="mb-3 mt-6 text-lg font-semibold text-slate-900">Tin tuyển dụng ({jobs.length})</h2>
        <div className="flex flex-col gap-3">
          {jobs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-slate-500">Công ty chưa đăng tin nào.</CardContent>
            </Card>
          )}
          {jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`}>
              <Card className="border-slate-200 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
                <CardContent className="py-4">
                  <div className="font-medium text-slate-900">{j.title || "(chưa có tiêu đề)"}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{j.rawText}</p>
                  <div className="mt-2">
                    <JobMeta
                      location={j.location}
                      employmentType={j.employmentType}
                      experienceLevel={j.experienceLevel}
                      skills={j.skills}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 3: Commit**

```bash
git add "app/companies/[id]/page.tsx"
git commit -m "feat(company): public company page listing its jobs"
```

---

### Task 5: Liên kết từ tin + dashboard

**Files:**
- Modify: `app/jobs/[id]/page.tsx`
- Modify: `app/dashboard/page.tsx`

Glue/UI: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: `app/jobs/[id]/page.tsx` — link "Xem trang công ty"**

Sau khi nạp `job` (và trước phần `return`), thêm truy vấn hồ sơ công ty của chủ tin:
```tsx
  const companyProfile = await prisma.companyProfile.findUnique({
    where: { userId: job.userId },
    select: { id: true },
  });
```
Trong `CardHeader`, ngay dưới `<p className="text-sm text-slate-500">{job.company || "—"}</p>`, thêm:
```tsx
            {companyProfile && (
              <Link href={`/companies/${companyProfile.id}`} className="text-sm text-blue-600 hover:underline">
                Xem trang công ty →
              </Link>
            )}
```
(`Link` đã được import ở đầu file.)

- [ ] **Step 2: `app/dashboard/page.tsx` — link hồ sơ / xem công ty cho NTD**

Trong nhánh `if (isRecruiter) { ... }`, sau khi nạp `jobs`, thêm:
```tsx
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
```
Thay khối tiêu đề + nút "Đăng JD" (`<div className="mb-6 flex items-center justify-between">...</div>`) bằng:
```tsx
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Tin tuyển dụng của bạn</h1>
              <p className="text-sm text-slate-500">Xin chào, {session.user.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/company/edit" className={buttonVariants({ variant: "outline" })}>Hồ sơ công ty</Link>
              {companyProfile && (
                <Link href={`/companies/${companyProfile.id}`} className={buttonVariants({ variant: "outline" })}>Xem trang công ty</Link>
              )}
              <Link href="/jobs/new" className={buttonVariants()}><Plus className="mr-1 h-4 w-4" /> Đăng JD</Link>
            </div>
          </div>
```
(`Link`, `buttonVariants`, `Plus` đã được import ở đầu file.)

- [ ] **Step 3: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 4: Kiểm tra thủ công (cho người dùng)**

NTD: dashboard → "Hồ sơ công ty" → điền + lưu → quay lại dashboard thấy "Xem trang công ty" → mở trang công ty thấy hồ sơ + tin của mình. Ứng viên: mở một tin của NTD đó → thấy link "Xem trang công ty →" → mở ra đúng trang.

- [ ] **Step 5: Commit**

```bash
git add "app/jobs/[id]/page.tsx" app/dashboard/page.tsx
git commit -m "feat(company): link job detail and dashboard to company page"
```

---

## Self-Review (đã thực hiện)

- **Bao phủ spec:** §2 model → Task 1. §3 schema + action + trang edit → Task 2/3. §4 trang công ty công khai → Task 4. §5 liên kết → Task 5. §6 phân quyền/lỗi → gate trong action (Task 3) + notFound (Task 4). §7 test → Task 2 (TDD thuần).
- **Placeholder:** không còn TBD/TODO; mọi bước có code hoặc lệnh cụ thể.
- **Nhất quán kiểu:** `companySchema` (Task 2) dùng ở Task 3; `upsertCompanyProfile` (Task 3) dùng ở form edit; `CompanyProfile` (Task 1) truy vấn ở Task 3/4/5; `JobMeta` props (Task 4) khớp select; route `/companies/[id]` (Task 4) khớp link ở Task 5.
```
