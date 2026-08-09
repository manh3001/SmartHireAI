# Upload logo công ty thật — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho nhà tuyển dụng tải file ảnh logo thật (lưu bytes trong Neon DB, phục vụ qua route nội bộ), thay ô dán-URL; mọi nơi hiển thị `logoUrl ? <img> : CompanyAvatar` chạy không đổi.

**Architecture:** Thêm cột `CompanyProfile.logoData Bytes?` + `logoMime String?`; helper thuần `validateLogo` (mime allowlist + size). Route GET `/api/company/<id>/logo` phục vụ bytes với cache header. Form `/company/edit` đổi sang upload file; `upsertCompanyProfile` lưu bytes + đặt `logoUrl` trỏ route (kèm `?v=<timestamp>` bust cache) hoặc xóa logo.

**Tech Stack:** Next.js 16, React 19, Prisma 6 (Neon), Tailwind v4, Vitest.

## Global Constraints

- Prisma **pinned v6**; thay đổi schema DUY NHẤT là thêm 2 cột nullable `logoData Bytes?` + `logoMime String?` trên `model CompanyProfile`; đồng bộ bằng `npm run db:push` (không migration tay).
- **KHÔNG thêm dependency** (không `sharp`, không `@vercel/blob`). Không resize server, chỉ validate mime + size.
- Giới hạn ảnh: **PNG/JPEG/WebP, tối đa 500KB** (`LOGO_MAX_BYTES = 500 * 1024`).
- `logoUrl` là nguồn hiển thị duy nhất; khi có logo: `logoUrl = "/api/company/<profileId>/logo?v=<timestamp>"`; khi xóa/không có: `""`.
- Vitest: unit-test **logic thuần** (`logo.ts`) + cập nhật test schema hiện có; route/action/page KHÔNG unit-test.
- Chỉ RECRUITER sửa hồ sơ công ty (giữ guard trong `upsertCompanyProfile`). Route logo công khai (GET chỉ đọc).
- `className` **nháy thẳng ASCII**; nội dung tiếng Việt; **SmartHire**.
- Không đổi AI, auth, realtime, phân quyền, `CvInput`.
- Windows: `npm test`, `npm run lint`, `npm run build`, `npm run db:push`.

## File Structure

**Tạo mới:**
- `lib/company/logo.ts` + `lib/company/__tests__/logo.test.ts` — hằng + validate thuần.
- `app/api/company/[id]/logo/route.ts` — GET phục vụ bytes.

**Sửa:**
- `prisma/schema.prisma` (2 cột trên `CompanyProfile`)
- `lib/company/schema.ts` (bỏ `logoUrl`) + `lib/company/__tests__/schema.test.ts` (bỏ assert `logoUrl`)
- `lib/company/actions.ts` (`upsertCompanyProfile` xử lý file/xóa)
- `app/company/edit/page.tsx` (form upload + xem trước + báo lỗi)

---

### Task 1: Helper thuần `logo.ts` (TDD) + 2 cột `CompanyProfile`

**Files:**
- Create: `lib/company/logo.ts`, `lib/company/__tests__/logo.test.ts`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces:
  - `LOGO_MAX_BYTES: number` (= 500*1024); `LOGO_MIME: readonly ["image/png","image/jpeg","image/webp"]`; `type LogoMime`.
  - `isLogoMime(v: string): v is LogoMime`
  - `validateLogo(file: { type: string; size: number }): { ok: true } | { ok: false; error: string }`

- [ ] **Step 1: Viết test thất bại**

`lib/company/__tests__/logo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateLogo, isLogoMime, LOGO_MAX_BYTES } from "../logo";

describe("isLogoMime", () => {
  it("nhận PNG/JPEG/WebP", () => {
    expect(isLogoMime("image/png")).toBe(true);
    expect(isLogoMime("image/jpeg")).toBe(true);
    expect(isLogoMime("image/webp")).toBe(true);
  });
  it("từ chối mime khác", () => {
    expect(isLogoMime("image/gif")).toBe(false);
    expect(isLogoMime("application/pdf")).toBe(false);
    expect(isLogoMime("")).toBe(false);
  });
});

describe("validateLogo", () => {
  it("chấp nhận ảnh hợp lệ", () => {
    expect(validateLogo({ type: "image/png", size: 1000 })).toEqual({ ok: true });
  });
  it("từ chối mime lạ với thông báo", () => {
    expect(validateLogo({ type: "image/gif", size: 1000 })).toEqual({ ok: false, error: "Chỉ hỗ trợ PNG, JPEG, WebP" });
    expect(validateLogo({ type: "application/pdf", size: 1000 })).toEqual({ ok: false, error: "Chỉ hỗ trợ PNG, JPEG, WebP" });
  });
  it("từ chối file quá lớn", () => {
    expect(validateLogo({ type: "image/png", size: LOGO_MAX_BYTES + 1 })).toEqual({ ok: false, error: "Ảnh quá lớn (tối đa 500KB)" });
  });
  it("chấp nhận đúng ngưỡng biên", () => {
    expect(validateLogo({ type: "image/png", size: LOGO_MAX_BYTES })).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npm test -- company/logo`
Expected: FAIL ("Cannot find module '../logo'").

- [ ] **Step 3: Cài đặt `lib/company/logo.ts`**

```ts
export const LOGO_MAX_BYTES = 500 * 1024;
export const LOGO_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoMime = (typeof LOGO_MIME)[number];

export function isLogoMime(v: string): v is LogoMime {
  return (LOGO_MIME as readonly string[]).includes(v);
}

export function validateLogo(
  file: { type: string; size: number },
): { ok: true } | { ok: false; error: string } {
  if (!isLogoMime(file.type)) {
    return { ok: false, error: "Chỉ hỗ trợ PNG, JPEG, WebP" };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: "Ảnh quá lớn (tối đa 500KB)" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npm test -- company/logo`
Expected: PASS.

- [ ] **Step 5: Thêm 2 cột vào Prisma**

Trong `prisma/schema.prisma`, `model CompanyProfile`, ngay SAU dòng `logoUrl String @default("")`, thêm:

```prisma
  logoData    Bytes?
  logoMime    String?
```

- [ ] **Step 6: Đồng bộ DB**

Run: `npm run db:push`
Expected: "Your database is now in sync" (chỉ thêm cột nullable, an toàn).

- [ ] **Step 7: Commit**

```bash
git add lib/company/logo.ts lib/company/__tests__/logo.test.ts prisma/schema.prisma
git commit -m "feat(company): logo validate helper + logoData/logoMime columns"
```

---

### Task 2: Route phục vụ ảnh logo

**Files:**
- Create: `app/api/company/[id]/logo/route.ts`

**Interfaces:**
- Consumes: `isLogoMime` (Task 1); `prisma` (`@/lib/db/prisma`); cột `logoData`/`logoMime` (Task 1).
- Produces: `GET /api/company/<id>/logo` → 200 (bytes + Content-Type + Cache-Control) hoặc 404.

- [ ] **Step 1: Cài đặt `app/api/company/[id]/logo/route.ts`**

```ts
import prisma from "@/lib/db/prisma";
import { isLogoMime } from "@/lib/company/logo";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const profile = await prisma.companyProfile.findUnique({
    where: { id },
    select: { logoData: true, logoMime: true },
  });
  if (!profile?.logoData || !profile.logoMime || !isLogoMime(profile.logoMime)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(profile.logoData), {
    status: 200,
    headers: {
      "Content-Type": profile.logoMime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công; route `/api/company/[id]/logo` xuất hiện trong danh sách build.

- [ ] **Step 3: Commit**

```bash
git add app/api/company/[id]/logo/route.ts
git commit -m "feat(company): serve company logo bytes via route"
```

---

### Task 3: Bỏ `logoUrl` khỏi `companySchema` + cập nhật test

**Files:**
- Modify: `lib/company/schema.ts`, `lib/company/__tests__/schema.test.ts`

**Interfaces:**
- Produces: `companySchema` không còn field `logoUrl` (chỉ `name`/`description`/`website`/`location`); `type CompanyInput` cập nhật theo.

- [ ] **Step 1: Cập nhật test trước (bỏ assert `logoUrl`)**

Thay toàn bộ `lib/company/__tests__/schema.test.ts` bằng:

```ts
import { describe, it, expect } from "vitest";
import { companySchema } from "../schema";

const base = {
  name: "ACME",
  description: "Công ty công nghệ",
  website: "https://acme.vn",
  location: "Hà Nội",
};

describe("companySchema", () => {
  it("chấp nhận input hợp lệ", () => {
    expect(companySchema.safeParse(base).success).toBe(true);
  });

  it("chấp nhận khi chỉ có tên (các trường khác rỗng)", () => {
    const r = companySchema.safeParse({ name: "ACME", description: "", website: "", location: "" });
    expect(r.success).toBe(true);
  });

  it("từ chối khi thiếu tên", () => {
    const r = companySchema.safeParse({ ...base, name: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Vui lòng nhập tên công ty");
  });

  it("sanitize javascript:alert(1) in website to empty string", () => {
    const r = companySchema.safeParse({ ...base, website: "javascript:alert(1)" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.website).toBe("");
  });

  it("preserve https:// URLs in website", () => {
    const r = companySchema.safeParse({ ...base, website: "https://example.com" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.website).toBe("https://example.com");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn fail**

Run: `npm test -- company/schema`
Expected: FAIL — `base` mới không còn `logoUrl`, mà schema CŨ vẫn khai báo `logoUrl: httpUrlOrBlank` (bắt buộc có mặt), nên `safeParse(base)` thất bại. Đây là "fail first" đúng ý; Step 3 gỡ field sẽ làm xanh.

- [ ] **Step 3: Bỏ `logoUrl` khỏi `lib/company/schema.ts`**

Thay khối `companySchema`:

```ts
export const companySchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên công ty"),
  description: z.string(),
  website: httpUrlOrBlank,
  location: z.string(),
});
```

(Giữ nguyên `httpUrlOrBlank` và `export type CompanyInput = z.infer<typeof companySchema>;`.)

- [ ] **Step 4: Chạy test để chắc chắn pass**

Run: `npm test -- company/schema`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add lib/company/schema.ts lib/company/__tests__/schema.test.ts
git commit -m "refactor(company): drop logoUrl from companySchema (now file upload)"
```

---

### Task 4: `upsertCompanyProfile` xử lý file/xóa + form upload

**Files:**
- Modify: `lib/company/actions.ts`, `app/company/edit/page.tsx`

**Interfaces:**
- Consumes: `companySchema` không có `logoUrl` (Task 3); `validateLogo` (Task 1); route logo (Task 2); `CompanyAvatar` (`@/components/CompanyAvatar`).
- Produces: (không có API cho task sau).

- [ ] **Step 1: Thay toàn bộ `lib/company/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { companySchema } from "./schema";
import { validateLogo } from "./logo";

export async function upsertCompanyProfile(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const parsed = companySchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
  });
  if (!parsed.success) redirect("/company/edit");

  const profile = await prisma.companyProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...parsed.data },
    update: { ...parsed.data },
    select: { id: true },
  });

  const removeLogo = formData.get("removeLogo") === "1";
  const logo = formData.get("logo");

  if (removeLogo) {
    await prisma.companyProfile.update({
      where: { id: profile.id },
      data: { logoData: null, logoMime: null, logoUrl: "" },
    });
  } else if (logo instanceof File && logo.size > 0) {
    const check = validateLogo({ type: logo.type, size: logo.size });
    if (!check.ok) {
      redirect("/company/edit?error=" + encodeURIComponent(check.error));
    }
    const bytes = Buffer.from(await logo.arrayBuffer());
    await prisma.companyProfile.update({
      where: { id: profile.id },
      data: {
        logoData: bytes,
        logoMime: logo.type,
        logoUrl: "/api/company/" + profile.id + "/logo?v=" + Date.now(),
      },
    });
  }

  revalidatePath("/company/edit");
  redirect("/dashboard");
}
```

- [ ] **Step 2: Thay toàn bộ `app/company/edit/page.tsx`**

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import CompanyAvatar from "@/components/CompanyAvatar";
import { upsertCompanyProfile } from "@/lib/company/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CompanyEditPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const { error } = await searchParams;

  const profile = await prisma.companyProfile.findUnique({
    where: { userId: session.user.id },
    select: { name: true, description: true, website: true, location: true, logoUrl: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href="/dashboard" className="text-sm text-primary hover:underline">← Về dashboard</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle className="text-foreground">Hồ sơ công ty</CardTitle></CardHeader>
          <CardContent>
            <form action={upsertCompanyProfile} encType="multipart/form-data" className="grid gap-3">
              <div><Label>Tên công ty</Label>
                <Input name="name" defaultValue={profile?.name ?? ""} placeholder="VD: ACME" required /></div>
              <div><Label>Địa điểm</Label>
                <Input name="location" defaultValue={profile?.location ?? ""} placeholder="VD: Hà Nội" /></div>
              <div><Label>Website</Label>
                <Input name="website" defaultValue={profile?.website ?? ""} placeholder="https://..." /></div>
              <div>
                <Label>Logo công ty</Label>
                <div className="mt-1 mb-2 flex items-center gap-3">
                  {profile?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.logoUrl} alt="Logo công ty" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <CompanyAvatar name={profile?.name ?? ""} className="h-12 w-12" />
                  )}
                </div>
                <input
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg,image/webp"
                  className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
                />
                {profile?.logoUrl && (
                  <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" name="removeLogo" value="1" /> Xóa logo
                  </label>
                )}
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG hoặc WebP, tối đa 500KB.</p>
              </div>
              <div><Label>Giới thiệu công ty</Label>
                <Textarea name="description" rows={6} defaultValue={profile?.description ?? ""} placeholder="Mô tả về công ty..." /></div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="justify-self-start">Lưu hồ sơ</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint` rồi `npm run build`
Expected: thành công.

- [ ] **Step 4: Commit**

```bash
git add lib/company/actions.ts app/company/edit/page.tsx
git commit -m "feat(company): upload logo file (form + action) replacing URL paste"
```

---

### Task 5: Rà soát & kiểm thử tổng

**Files:** (rà soát)

- [ ] **Step 1: Rà `logoUrl` trong các select hiển thị**

Các nơi hiển thị logo phải có `logoUrl` trong `select` (nếu dùng `select`). Kiểm nhanh:

Run: `git grep -n "CompanyAvatar\|logoUrl" -- "*.tsx"`
Xác nhận `components/companies/CompanyCard.tsx`, `app/companies/[id]/page.tsx`, `components/jobs/JobDetail.tsx`, `components/JobCard.tsx`, `app/messages/[applicationId]/page.tsx`, `app/jobs/[id]/applicants/*` đều lấy được `logoUrl` (qua include profile hoặc select có `logoUrl`). Nếu nơi nào thiếu → thêm `logoUrl` vào select và commit riêng. Nếu tất cả đã có → không đổi.

- [ ] **Step 2: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS (gồm `company/logo`, `company/schema`).

- [ ] **Step 3: Build production**

Run: `npm run build`
Expected: thành công, không lỗi type.

- [ ] **Step 4: Chạy thử thủ công (khuyến nghị)**

Run: `npm run dev` — đăng nhập NTD → `/company/edit` → tải logo PNG hợp lệ → Lưu → logo hiện ở `/company/edit`, `/companies`, trang công ty, `JobCard`/`JobDetail`. Thử file >500KB hoặc sai định dạng → thấy báo lỗi tiếng Việt. Tick "Xóa logo" → về avatar chữ cái.

- [ ] **Step 5: Commit dọn dẹp nếu có**

```bash
git add -A
git commit -m "chore(company): finalize logo upload feature"
```

---

## Self-Review (đã thực hiện khi viết plan)

- **Spec coverage:** 2 cột `logoData`/`logoMime` + helper thuần → Task 1; route phục vụ → Task 2; bỏ `logoUrl` khỏi schema + test → Task 3; action xử lý file/xóa + form upload/xem trước/lỗi → Task 4; rà hiển thị + kiểm thử → Task 5. ✅
- **Placeholder scan:** không TODO/TBD; mọi bước có code/lệnh cụ thể.
- **Type consistency:** `validateLogo`/`isLogoMime`/`LOGO_MAX_BYTES`/`LOGO_MIME` (Task 1) dùng ở route (Task 2, `isLogoMime`) và action (Task 4, `validateLogo`). `companySchema` bỏ `logoUrl` (Task 3) khớp với action chỉ parse 4 trường (Task 4). `logoUrl` route format `"/api/company/<id>/logo?v=<ts>"` khớp route path (Task 2). Cột `logoData Bytes?`/`logoMime String?` (Task 1) khớp select/update ở Task 2 & 4.
- **Thứ tự an toàn:** Task 2 & 4 phụ thuộc Task 1 (cột + helper); Task 4 phụ thuộc Task 3 (schema) + Task 2 (route path). Sau Task 3 (trước Task 4): form cũ còn ô URL nhưng action bỏ qua → build + test vẫn xanh (trạng thái trung gian chấp nhận được), Task 4 hoàn tất luồng. Bytes lưu Buffer, phục vụ Uint8Array (giống route PDF).
