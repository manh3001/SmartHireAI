# SEO & Chia sẻ tin tuyển dụng — Design Spec

**Ngày:** 2026-09-02
**Vòng:** 6 (tính năng thứ ba, cuối nhóm E "tính năng hoãn")

## Mục tiêu

Giúp **tin tuyển dụng lên Google (Google Jobs) và chia sẻ link đẹp**: mở `/jobs/[id]` cho khách xem (Google crawl được), gắn **JSON-LD JobPosting** + **Open Graph metadata**, thêm **sitemap.xml** và **robots.txt**.

## Quyết định thiết kế (đã chốt với user)

- **Mở `/jobs/[id]` công khai** (bỏ tường đăng nhập cho tin `isPublic`) — một URL chuẩn, giống job board thật. Khách xem được; nút ứng tuyển dẫn tới `/login`.
- **Phạm vi: chỉ tin tuyển dụng.** Trang công ty `/companies/[id]` GIỮ NGUYÊN (vẫn cần login) — ngoài phạm vi vòng này.
- Logic thuần (JSON-LD, URL, map) tách vào `lib/seo/` + test; phần Next.js (metadata, sitemap, robots) là file quy ước.
- URL tuyệt đối lấy từ env `APP_URL` (đã dùng ở `lib/jobs/alert-notify.ts`), fallback `http://localhost:3000`.

## Kiến trúc

Tin tuyển dụng đã có ở `model JobDescription` (title, company, rawText, location, employmentType, experienceLevel, skills, salaryMin/Max/Negotiable, createdAt, updatedAt, isPublic, userId). Trang `/jobs/[id]` là server component; các phần candidate-only đã được guard bằng `isCandidate` nên chỉ cần bỏ redirect + guard `session` null.

### 1. Helper SEO — `lib/seo/url.ts` (+ test)

```typescript
export function siteUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
```
Test: `absoluteUrl("/jobs/x")` ghép đúng; strip dấu `/` cuối của APP_URL.

### 2. Helper mô tả & map — `lib/seo/job-seo.ts` (thuần, + test)

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
Test: map 4 giá trị; `metaDescription` gộp xuống dòng, cắt đúng độ dài + "…", text ngắn giữ nguyên.

### 3. JSON-LD JobPosting — `lib/seo/job-jsonld.ts` (thuần, + test)

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

export function buildJobPostingJsonLd(job: JobPostingInput, url: string): Record<string, unknown> {
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
Test: có đủ field bắt buộc (`@type`, title, description, datePosted, hiringOrganization, jobLocation); `employmentType` map đúng; `baseSalary` xuất hiện khi có lương và vắng khi cả hai null; `directApply === true`.

### 4. Mở `/jobs/[id]` công khai — `app/jobs/[id]/page.tsx`

- **Bỏ** `if (!session?.user?.id) redirect("/login");`. `session` có thể null.
- Thêm `createdAt: true` vào `select` của job (cho datePosted).
- `isCandidate = session?.user?.role === "CANDIDATE"` (guard optional). `isOwnerRecruiter = session?.user?.role === "RECRUITER" && job.userId === session.user.id`. Các truy vấn cvs/applied/savedJob giữ nguyên (đã guard bằng `isCandidate`).
- `actionSlot`: thêm nhánh **khách** — khi `!session?.user`, hiện `<Link href="/login" className={buttonVariants()}>Đăng nhập để ứng tuyển</Link>`.
- Thêm `export async function generateMetadata({ params }): Promise<Metadata>`: fetch job (`id, title, company, rawText, isPublic`); nếu không có/không public → `{ title: "Không tìm thấy tin" }`. Ngược lại:
  - `title: "${job.title} tại ${job.company} | SmartHire"` (fallback nếu thiếu),
  - `description: metaDescription(job.rawText)`,
  - `alternates: { canonical: absoluteUrl(`/jobs/${id}`) }`,
  - `openGraph: { title, description, type: "article", url: absoluteUrl(...) }`.
- Render JSON-LD ngay trong trang (chỉ khi job public):
  ```tsx
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJobPostingJsonLd(job, absoluteUrl(`/jobs/${job.id}`))) }}
  />
  ```
  (Đây là cách chuẩn của Next.js để nhúng JSON-LD; dữ liệu do server tạo, không phải input người dùng thô chèn HTML.)

### 5. `app/sitemap.ts`

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

### 6. `app/robots.ts`

```typescript
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/applications", "/admin", "/api", "/settings", "/messages", "/notifications", "/interviews", "/cv", "/login", "/register"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
```

### 7. `app/layout.tsx` — metadataBase + OG mặc định

Thay `metadata` hiện tại:
```typescript
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "SmartHire — Nền tảng CV & tuyển dụng thông minh", template: "%s | SmartHire" },
  description: "Tạo CV, đánh giá bằng AI, tìm việc phù hợp.",
  openGraph: {
    siteName: "SmartHire",
    locale: "vi_VN",
    type: "website",
  },
};
```
Import `siteUrl` từ `@/lib/seo/url`.

### 8. Ràng buộc

- `APP_URL` production phải trỏ domain thật để URL tuyệt đối (sitemap/canonical/JSON-LD) đúng — user tự set khi deploy.
- Toàn bộ chữ tiếng Việt; chỉ Tailwind design token; không sửa component xem trước CV.
- Hàm thuần không import prisma/auth.

### 9. Testing & verify

- Unit: `lib/seo/__tests__/url.test.ts`, `job-seo.test.ts`, `job-jsonld.test.ts`.
- `npx tsc --noEmit` 0 lỗi; `npx vitest run` xanh (baseline 361 + mới); `npm run build` pass (build phát hiện lỗi sitemap/robots/metadata nếu có).
- Manual (user tự kiểm bằng `npm run dev`): mở `/jobs/<id>` khi **đăng xuất** → xem được, không bị đá về login, thấy nút "Đăng nhập để ứng tuyển"; `/sitemap.xml` và `/robots.txt` trả nội dung; xem `<script type="application/ld+json">` trong HTML nguồn; sau deploy (có `APP_URL`) dán URL vào Google Rich Results Test.

## Ngoài phạm vi (YAGNI)

Trang công ty công khai/JSON-LD Organization; ảnh OG động (`opengraph-image`); `validThrough`/hạn tin; hreflang đa ngôn ngữ; Google Indexing API; phân trang sitemap (>5000 tin).
