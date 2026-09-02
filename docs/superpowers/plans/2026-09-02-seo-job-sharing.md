# SEO & Chia sẻ tin tuyển dụng — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa tin tuyển dụng lên Google Jobs & chia sẻ link đẹp: mở `/jobs/[id]` công khai, gắn JSON-LD JobPosting + Open Graph, thêm sitemap.xml và robots.txt.

**Architecture:** Logic thuần (URL, map employmentType, mô tả, JSON-LD) tách vào `lib/seo/` + test vitest. Trang `/jobs/[id]` bỏ tường đăng nhập cho tin `isPublic`, thêm `generateMetadata` + nhúng JSON-LD. `app/sitemap.ts`, `app/robots.ts`, và `metadataBase`/OG mặc định ở `app/layout.tsx` là file quy ước Next.js.

**Tech Stack:** Next.js 16 (App Router: `sitemap.ts`, `robots.ts`, `generateMetadata`, `MetadataRoute`), React 19, Prisma 6, Vitest, Tailwind v4.

## Global Constraints

- URL tuyệt đối từ env `APP_URL` (fallback `http://localhost:3000`).
- Hàm thuần trong `lib/seo/`: KHÔNG import prisma/auth; test bằng vitest.
- Chỉ mở công khai tin `isPublic`; trang công ty GIỮ NGUYÊN (ngoài phạm vi).
- Toàn bộ chữ tiếng Việt; chỉ Tailwind design token; không sửa component xem trước CV.
- prisma default import `@/lib/db/prisma`. Baseline 361 test.
- `EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP"` (từ `@/lib/jobs/job-fields`).

---

### Task 1: Helper SEO thuần — URL + map + mô tả

**Files:**
- Create: `lib/seo/url.ts`
- Create: `lib/seo/job-seo.ts`
- Test: `lib/seo/__tests__/url.test.ts`
- Test: `lib/seo/__tests__/job-seo.test.ts`

**Interfaces:**
- Produces:
  - `siteUrl(): string`, `absoluteUrl(path: string): string`
  - `employmentTypeToSchema(t: EmploymentType): string`
  - `metaDescription(text: string, max?: number): string`

- [ ] **Step 1: Viết test thất bại `lib/seo/__tests__/url.test.ts`**

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { siteUrl, absoluteUrl } from "../url";

const original = process.env.APP_URL;
afterEach(() => { process.env.APP_URL = original; });

describe("siteUrl / absoluteUrl", () => {
  it("bỏ dấu / cuối của APP_URL", () => {
    process.env.APP_URL = "https://smarthire.vn/";
    expect(siteUrl()).toBe("https://smarthire.vn");
  });
  it("fallback localhost khi thiếu APP_URL", () => {
    delete process.env.APP_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });
  it("absoluteUrl ghép path có/không dấu /", () => {
    process.env.APP_URL = "https://smarthire.vn";
    expect(absoluteUrl("/jobs/x")).toBe("https://smarthire.vn/jobs/x");
    expect(absoluteUrl("jobs/x")).toBe("https://smarthire.vn/jobs/x");
  });
});
```

- [ ] **Step 2: Viết test thất bại `lib/seo/__tests__/job-seo.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { employmentTypeToSchema, metaDescription } from "../job-seo";

describe("employmentTypeToSchema", () => {
  it("map sang giá trị schema.org của Google", () => {
    expect(employmentTypeToSchema("FULL_TIME")).toBe("FULL_TIME");
    expect(employmentTypeToSchema("PART_TIME")).toBe("PART_TIME");
    expect(employmentTypeToSchema("CONTRACT")).toBe("CONTRACTOR");
    expect(employmentTypeToSchema("INTERNSHIP")).toBe("INTERN");
  });
});

describe("metaDescription", () => {
  it("gộp khoảng trắng và giữ nguyên text ngắn", () => {
    expect(metaDescription("Xin  chào\n\nthế giới")).toBe("Xin chào thế giới");
  });
  it("cắt text dài và thêm dấu …", () => {
    const r = metaDescription("a".repeat(200), 10);
    expect(r.length).toBe(10);
    expect(r.endsWith("…")).toBe(true);
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/seo/__tests__/url.test.ts lib/seo/__tests__/job-seo.test.ts`
Expected: FAIL — "Cannot find module '../url'" / "'../job-seo'".

- [ ] **Step 4: Viết `lib/seo/url.ts`**

```typescript
export function siteUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
```

- [ ] **Step 5: Viết `lib/seo/job-seo.ts`**

```typescript
import type { EmploymentType } from "@/lib/jobs/job-fields";

// Map EmploymentType nội bộ -> giá trị schema.org của Google.
export function employmentTypeToSchema(t: EmploymentType): string {
  const map: Record<EmploymentType, string> = {
    FULL_TIME: "FULL_TIME",
    PART_TIME: "PART_TIME",
    CONTRACT: "CONTRACTOR",
    INTERNSHIP: "INTERN",
  };
  return map[t];
}

// Rút gọn text cho thẻ description: gộp khoảng trắng, cắt <= max, thêm "…".
export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}
```

- [ ] **Step 6: Chạy test để xác nhận PASS**

Run: `npx vitest run lib/seo/__tests__/url.test.ts lib/seo/__tests__/job-seo.test.ts`
Expected: PASS (6 test).

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
```bash
git add lib/seo/url.ts lib/seo/job-seo.ts lib/seo/__tests__/url.test.ts lib/seo/__tests__/job-seo.test.ts
git commit -m "feat(seo): pure helpers — siteUrl/absoluteUrl, employmentType map, metaDescription"
```

---

### Task 2: JSON-LD JobPosting builder

**Files:**
- Create: `lib/seo/job-jsonld.ts`
- Test: `lib/seo/__tests__/job-jsonld.test.ts`

**Interfaces:**
- Consumes: `employmentTypeToSchema` (Task 1).
- Produces:
  - `type JobPostingInput = { title: string; company: string; rawText: string; location: string; employmentType: EmploymentType | null; salaryMin: number | null; salaryMax: number | null; createdAt: Date }`
  - `buildJobPostingJsonLd(job: JobPostingInput, url: string): Record<string, unknown>`

- [ ] **Step 1: Viết test thất bại `lib/seo/__tests__/job-jsonld.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { buildJobPostingJsonLd, type JobPostingInput } from "../job-jsonld";

const base: JobPostingInput = {
  title: "Frontend Developer",
  company: "ACME",
  rawText: "Cần React và TypeScript",
  location: "Hà Nội",
  employmentType: "FULL_TIME",
  salaryMin: 15000000,
  salaryMax: 25000000,
  createdAt: new Date("2026-09-01T00:00:00Z"),
};

describe("buildJobPostingJsonLd", () => {
  it("có đủ field bắt buộc của JobPosting", () => {
    const ld = buildJobPostingJsonLd(base, "https://smarthire.vn/jobs/x");
    expect(ld["@type"]).toBe("JobPosting");
    expect(ld.title).toBe("Frontend Developer");
    expect(ld.description).toBe("Cần React và TypeScript");
    expect(ld.datePosted).toBe("2026-09-01T00:00:00.000Z");
    expect(ld.hiringOrganization).toMatchObject({ "@type": "Organization", name: "ACME" });
    expect(ld.jobLocation).toMatchObject({ address: { addressCountry: "VN", addressLocality: "Hà Nội" } });
    expect(ld.url).toBe("https://smarthire.vn/jobs/x");
    expect(ld.directApply).toBe(true);
  });

  it("map employmentType sang chuẩn Google", () => {
    const ld = buildJobPostingJsonLd({ ...base, employmentType: "INTERNSHIP" }, "u");
    expect(ld.employmentType).toBe("INTERN");
  });

  it("có baseSalary khi có lương", () => {
    const ld = buildJobPostingJsonLd(base, "u");
    expect(ld.baseSalary).toMatchObject({
      currency: "VND",
      value: { minValue: 15000000, maxValue: 25000000, unitText: "MONTH" },
    });
  });

  it("bỏ baseSalary khi cả hai lương null", () => {
    const ld = buildJobPostingJsonLd({ ...base, salaryMin: null, salaryMax: null }, "u");
    expect(ld.baseSalary).toBeUndefined();
  });

  it("bỏ employmentType khi null", () => {
    const ld = buildJobPostingJsonLd({ ...base, employmentType: null }, "u");
    expect(ld.employmentType).toBeUndefined();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/seo/__tests__/job-jsonld.test.ts`
Expected: FAIL — "Cannot find module '../job-jsonld'".

- [ ] **Step 3: Viết `lib/seo/job-jsonld.ts`**

```typescript
import { employmentTypeToSchema } from "./job-seo";
import type { EmploymentType } from "@/lib/jobs/job-fields";

export type JobPostingInput = {
  title: string;
  company: string;
  rawText: string;
  location: string;
  employmentType: EmploymentType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  createdAt: Date;
};

export function buildJobPostingJsonLd(
  job: JobPostingInput,
  url: string,
): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title || "Tin tuyển dụng",
    description: job.rawText,
    datePosted: job.createdAt.toISOString(),
    hiringOrganization: {
      "@type": "Organization",
      name: job.company || "Nhà tuyển dụng",
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location || "Việt Nam",
        addressCountry: "VN",
      },
    },
    url,
    directApply: true,
  };
  if (job.employmentType) ld.employmentType = employmentTypeToSchema(job.employmentType);
  if (job.salaryMin || job.salaryMax) {
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "VND",
      value: {
        "@type": "QuantitativeValue",
        ...(job.salaryMin ? { minValue: job.salaryMin } : {}),
        ...(job.salaryMax ? { maxValue: job.salaryMax } : {}),
        unitText: "MONTH",
      },
    };
  }
  return ld;
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run lib/seo/__tests__/job-jsonld.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
```bash
git add lib/seo/job-jsonld.ts lib/seo/__tests__/job-jsonld.test.ts
git commit -m "feat(seo): buildJobPostingJsonLd (schema.org JobPosting)"
```

---

### Task 3: Mở `/jobs/[id]` công khai + generateMetadata + JSON-LD

**Files:**
- Modify: `app/jobs/[id]/page.tsx`

**Interfaces:**
- Consumes: `absoluteUrl` (Task 1), `metaDescription` (Task 1), `buildJobPostingJsonLd` (Task 2).

- [ ] **Step 1: Sửa import đầu file**

Đổi dòng:
```tsx
import { redirect, notFound } from "next/navigation";
```
thành (bỏ `redirect` vì không còn dùng → tránh lỗi unused):
```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
```
Thêm sau dòng `import SaveJobButton from "../SaveJobButton";`:
```tsx
import { absoluteUrl } from "@/lib/seo/url";
import { metaDescription } from "@/lib/seo/job-seo";
import { buildJobPostingJsonLd } from "@/lib/seo/job-jsonld";
```

- [ ] **Step 2: Thêm `generateMetadata` (trước component `JobDetailPage`)**

```tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await prisma.jobDescription.findFirst({
    where: { id, isPublic: true },
    select: { title: true, company: true, rawText: true },
  });
  if (!job) return { title: "Không tìm thấy tin" };
  const title = `${job.title || "Tin tuyển dụng"} tại ${job.company || "Nhà tuyển dụng"}`;
  const description = metaDescription(job.rawText);
  const url = absoluteUrl(`/jobs/${id}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "article", url },
  };
}
```
(Không thêm "| SmartHire" ở đây — template `%s | SmartHire` trong layout tự nối.)

- [ ] **Step 3: Bỏ tường đăng nhập + guard session null**

Xoá dòng:
```tsx
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
```
Thay bằng:
```tsx
  const session = await auth();
```
Thêm `createdAt: true` vào `select` của job (trong danh sách field, cạnh `salaryNegotiable: true`):
```tsx
      salaryMin: true, salaryMax: true, salaryNegotiable: true, createdAt: true,
```
Đổi 2 dòng tính vai trò để guard optional:
```tsx
  const isCandidate = session?.user?.role === "CANDIDATE";
  const isOwnerRecruiter =
    session?.user?.role === "RECRUITER" && job.userId === session.user.id;
```
(Các truy vấn `cvs`/`applied`/`savedJob` đã bọc trong `isCandidate ? ... : []/null` nên an toàn khi `session` null.)

- [ ] **Step 4: Thêm nhánh khách vào `actionSlot`**

Trong JSX của `actionSlot`, ngay sau thẻ mở `<div className="flex flex-wrap gap-3">`, thêm:
```tsx
      {!session?.user && (
        <Link href="/login" className={buttonVariants()}>
          Đăng nhập để ứng tuyển
        </Link>
      )}
```

- [ ] **Step 5: Nhúng JSON-LD trong JSX trả về**

Ngay sau thẻ mở `<main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">`, thêm:
```tsx
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildJobPostingJsonLd(job, absoluteUrl(`/jobs/${job.id}`))),
          }}
        />
```

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: 0 lỗi (nếu báo `auth` hoặc `redirect` unused, kiểm lại: `auth` vẫn dùng, `redirect` đã bỏ import).
Run: `npm run build`
Expected: build thành công.

- [ ] **Step 7: Commit**

```bash
git add app/jobs/[id]/page.tsx
git commit -m "feat(seo): make /jobs/[id] public with generateMetadata + JobPosting JSON-LD"
```

---

### Task 4: sitemap.ts + robots.ts + layout metadataBase/OG

**Files:**
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`
- Modify: `app/layout.tsx` (metadata: metadataBase + title template + OG)

**Interfaces:**
- Consumes: `absoluteUrl`, `siteUrl` (Task 1); prisma.

- [ ] **Step 1: Viết `app/sitemap.ts`**

```typescript
import type { MetadataRoute } from "next";
import prisma from "@/lib/db/prisma";
import { absoluteUrl } from "@/lib/seo/url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/jobs"), changeFrequency: "daily", priority: 0.9 },
  ];
  const jobRoutes: MetadataRoute.Sitemap = jobs.map((j) => ({
    url: absoluteUrl(`/jobs/${j.id}`),
    lastModified: j.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  return [...staticRoutes, ...jobRoutes];
}
```

- [ ] **Step 2: Viết `app/robots.ts`**

```typescript
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard", "/applications", "/admin", "/api", "/settings",
        "/messages", "/notifications", "/interviews", "/cv", "/login", "/register",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
```

- [ ] **Step 3: Cập nhật `metadata` trong `app/layout.tsx`**

Thêm import sau các import hiện có ở đầu file:
```tsx
import { siteUrl } from "@/lib/seo/url";
```
Thay khối:
```tsx
export const metadata: Metadata = {
  title: "Nền tảng CV thông minh",
  description: "Tạo CV, đánh giá bằng AI, tìm việc phù hợp.",
};
```
thành:
```tsx
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "SmartHire — Nền tảng CV & tuyển dụng thông minh",
    template: "%s | SmartHire",
  },
  description: "Tạo CV, đánh giá bằng AI, tìm việc phù hợp.",
  openGraph: {
    siteName: "SmartHire",
    locale: "vi_VN",
    type: "website",
  },
};
```

- [ ] **Step 4: Typecheck + toàn bộ test + build**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.
Run: `npx vitest run`
Expected: PASS (361 baseline + 11 mới = 372).
Run: `npm run build`
Expected: build thành công; log liệt kê route `/sitemap.xml` và `/robots.txt`.

- [ ] **Step 5: Commit**

```bash
git add app/sitemap.ts app/robots.ts app/layout.tsx
git commit -m "feat(seo): sitemap.xml, robots.txt, metadataBase + default OG"
```

---

## Ghi chú kiểm thử tổng (sau tất cả task)

Manual bằng `npm run dev` (nếu subagent không chạy được, ghi "cần user xác nhận"):
- **Đăng xuất**, mở `/jobs/<id>` của một tin public → xem được nội dung, KHÔNG bị đá về `/login`, thấy nút "Đăng nhập để ứng tuyển".
- Xem HTML nguồn trang tin → có `<script type="application/ld+json">` chứa `"@type":"JobPosting"`.
- Mở `/robots.txt` → thấy `Sitemap:` + các `Disallow`.
- Mở `/sitemap.xml` → liệt kê `/` , `/jobs`, và các `/jobs/<id>`.
- Chia sẻ link tin lên chat/mạng xã hội → tiêu đề + mô tả hiển thị (OG).
- Sau deploy (set `APP_URL` = domain thật): dán URL tin vào Google Rich Results Test → JobPosting hợp lệ.
