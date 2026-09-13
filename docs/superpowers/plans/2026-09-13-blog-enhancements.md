# Blog nâng cấp (lọc tag · khối trang chủ · ảnh cover) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm lọc theo tag ở /blog, khối "cẩm nang mới nhất" trên trang chủ, và ảnh cover cho bài viết.

**Architecture:** Mở rộng helper thuần (cover trong PostMeta; allTags/filterByTag) có test; một component thẻ `PostCard` dùng chung cho /blog và trang chủ; cover là file `/public` render bằng `<img>` với fallback. Không schema/DB.

**Tech Stack:** Next.js 16 App Router, React server components, Tailwind, vitest.

## Global Constraints

- Không schema/DB. Cover là file cục bộ `/public` (đường dẫn như `/blog/x.svg`), render bằng `<img>` (kèm `// eslint-disable-next-line @next/next/no-img-element`), `cover` tùy chọn (thiếu → fallback).
- Helper `lib/blog/{post,filter}.ts` THUẦN. `params`/`searchParams` là Promise → `await`.
- Tiếng Việt; Tailwind tokens; tái dùng `getAllPosts` (`lib/blog/posts.ts`).
- Baseline 429 tests giữ xanh. Test `npx vitest run`; typecheck `npx tsc --noEmit`; lint `npm run lint` (0 error).

---

### Task 1: Helper — cover trong PostMeta + allTags/filterByTag

**Files:**
- Modify: `lib/blog/post.ts`
- Modify: `lib/blog/__tests__/post.test.ts`
- Create: `lib/blog/filter.ts`
- Create: `lib/blog/__tests__/filter.test.ts`

**Interfaces:**
- Produces:
  - `PostMeta` thêm `cover: string`
  - `allTags(posts: PostMeta[]): string[]`
  - `filterByTag(posts: PostMeta[], tag: string | undefined): PostMeta[]`

- [ ] **Step 1: Cập nhật + viết test thất bại**

Thay `lib/blog/__tests__/post.test.ts` bằng (thêm `cover` vào kỳ vọng + 1 test cover):
```ts
import { describe, it, expect } from "vitest";
import { buildPostMeta } from "../post";

describe("buildPostMeta", () => {
  it("map đầy đủ từ frontmatter", () => {
    const meta = buildPostMeta("bai-1", {
      title: "Tiêu đề", description: "Mô tả", date: "2026-09-13", tag: "CV", author: "An", cover: "/blog/x.svg",
    });
    expect(meta).toEqual({
      slug: "bai-1", title: "Tiêu đề", description: "Mô tả", date: "2026-09-13", tag: "CV", author: "An", cover: "/blog/x.svg",
    });
  });

  it("thiếu title -> fallback slug; field khác rỗng (gồm cover)", () => {
    const meta = buildPostMeta("bai-2", {});
    expect(meta).toEqual({ slug: "bai-2", title: "bai-2", description: "", date: "", tag: "", author: "", cover: "" });
  });
});
```

Tạo `lib/blog/__tests__/filter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { allTags, filterByTag } from "../filter";
import type { PostMeta } from "../post";

function post(slug: string, tag: string): PostMeta {
  return { slug, title: slug, description: "", date: "", tag, author: "", cover: "" };
}

describe("allTags", () => {
  it("distinct, bỏ rỗng, sắp abc", () => {
    const posts = [post("a", "CV"), post("b", "Phỏng vấn"), post("c", "CV"), post("d", "")];
    expect(allTags(posts)).toEqual(["CV", "Phỏng vấn"]);
  });
});

describe("filterByTag", () => {
  const posts = [post("a", "CV"), post("b", "Phỏng vấn")];
  it("tag rỗng/undefined -> giữ nguyên", () => {
    expect(filterByTag(posts, undefined)).toHaveLength(2);
    expect(filterByTag(posts, "")).toHaveLength(2);
  });
  it("tag khớp -> lọc", () => {
    expect(filterByTag(posts, "CV").map((p) => p.slug)).toEqual(["a"]);
  });
  it("tag không khớp -> []", () => {
    expect(filterByTag(posts, "Khác")).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/blog/__tests__/post.test.ts lib/blog/__tests__/filter.test.ts`
Expected: FAIL (`cover` chưa có trên PostMeta; `../filter` chưa tồn tại).

- [ ] **Step 3: Thêm cover vào `post.ts`**

Trong `lib/blog/post.ts`, thêm `cover: string;` vào type `PostMeta` (sau `author`) và `cover: data.cover || "",` vào object `buildPostMeta` trả về:
```ts
export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tag: string;
  author: string;
  cover: string;
};

export function buildPostMeta(slug: string, data: Record<string, string>): PostMeta {
  return {
    slug,
    title: data.title || slug,
    description: data.description || "",
    date: data.date || "",
    tag: data.tag || "",
    author: data.author || "",
    cover: data.cover || "",
  };
}
```

- [ ] **Step 4: Tạo `lib/blog/filter.ts`**

```ts
import type { PostMeta } from "./post";

export function allTags(posts: PostMeta[]): string[] {
  const set = new Set<string>();
  for (const p of posts) if (p.tag.trim()) set.add(p.tag);
  return [...set].sort((a, b) => a.localeCompare(b, "vi"));
}

export function filterByTag(posts: PostMeta[], tag: string | undefined): PostMeta[] {
  if (!tag) return posts;
  return posts.filter((p) => p.tag === tag);
}
```

- [ ] **Step 5: Chạy test — phải pass**

Run: `npx vitest run lib/blog/__tests__/post.test.ts lib/blog/__tests__/filter.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 429 + 4 = 433 PASS (2 test cũ post.test đổi nội dung nhưng vẫn 2; +4 test filter).

- [ ] **Step 7: Commit**

```bash
git add lib/blog/post.ts lib/blog/filter.ts lib/blog/__tests__/post.test.ts lib/blog/__tests__/filter.test.ts
git commit -m "feat(blog): PostMeta.cover + allTags/filterByTag helper"
```

---

### Task 2: PostCard + cover mẫu + lọc tag ở /blog

**Files:**
- Create: `components/blog/PostCard.tsx`
- Create: `public/blog/cach-viet-cv-gay-an-tuong.svg`
- Create: `public/blog/chuan-bi-phong-van.svg`
- Modify: `content/blog/cach-viet-cv-gay-an-tuong.md` (thêm `cover`)
- Modify: `content/blog/chuan-bi-phong-van.md` (thêm `cover`)
- Modify: `app/blog/page.tsx`

**Interfaces:**
- Consumes: `PostMeta` (`@/lib/blog/post`), `allTags`/`filterByTag` (`@/lib/blog/filter`), `getAllPosts`
- Produces: `PostCard` (component, prop `{ post: PostMeta }`)

- [ ] **Step 1: Component `components/blog/PostCard.tsx`**

```tsx
import Link from "next/link";
import type { PostMeta } from "@/lib/blog/post";

export default function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {post.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.cover} alt={post.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-muted">
            <span className="px-4 text-center text-sm font-medium text-muted-foreground">{post.tag || "Cẩm nang"}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {post.tag && <span className="text-xs font-medium text-primary">{post.tag}</span>}
        <h2 className="mt-1 font-semibold text-foreground">{post.title}</h2>
        {post.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.description}</p>}
        {post.date && <p className="mt-2 text-xs text-muted-foreground">{new Date(post.date).toLocaleDateString("vi-VN")}</p>}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Ảnh cover mẫu SVG**

`public/blog/cach-viet-cv-gay-an-tuong.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" role="img" aria-label="CV">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/>
  </linearGradient></defs>
  <rect width="800" height="450" fill="url(#g)"/>
  <text x="400" y="235" font-family="system-ui, sans-serif" font-size="56" font-weight="700" fill="#ffffff" text-anchor="middle">Viết CV ấn tượng</text>
</svg>
```

`public/blog/chuan-bi-phong-van.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" role="img" aria-label="Phỏng vấn">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0ea5e9"/><stop offset="1" stop-color="#6366f1"/>
  </linearGradient></defs>
  <rect width="800" height="450" fill="url(#g)"/>
  <text x="400" y="235" font-family="system-ui, sans-serif" font-size="56" font-weight="700" fill="#ffffff" text-anchor="middle">Chuẩn bị phỏng vấn</text>
</svg>
```

- [ ] **Step 3: Thêm `cover` vào 2 bài mẫu**

Trong `content/blog/cach-viet-cv-gay-an-tuong.md`, thêm dòng vào frontmatter (sau `author:`):
```
cover: /blog/cach-viet-cv-gay-an-tuong.svg
```
Trong `content/blog/chuan-bi-phong-van.md`, thêm:
```
cover: /blog/chuan-bi-phong-van.svg
```

- [ ] **Step 4: Lọc tag + PostCard trong `app/blog/page.tsx`**

Thay toàn bộ `app/blog/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { EmptyState } from "@/components/ui/empty-state";
import PostCard from "@/components/blog/PostCard";
import { getAllPosts } from "@/lib/blog/posts";
import { allTags, filterByTag } from "@/lib/blog/filter";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cẩm nang nghề nghiệp | SmartHire",
  description: "Bài viết, mẹo viết CV, phỏng vấn và phát triển sự nghiệp trên SmartHire.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const posts = await getAllPosts();
  const tags = allTags(posts);
  const shown = filterByTag(posts, tag);

  const chip = "rounded-full border px-3 py-1 text-xs font-medium transition-colors";

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-foreground">Cẩm nang nghề nghiệp</h1>
        <p className="mt-1 text-sm text-muted-foreground">Mẹo viết CV, phỏng vấn và phát triển sự nghiệp.</p>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/blog" className={cn(chip, !tag ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              Tất cả
            </Link>
            {tags.map((t) => (
              <Link
                key={t}
                href={`/blog?tag=${encodeURIComponent(t)}`}
                className={cn(chip, tag === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
              >
                {t}
              </Link>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <div className="mt-8">
            <EmptyState icon={<BookOpen className="h-10 w-10" />} title="Chưa có bài viết" description="Không có bài phù hợp bộ lọc." />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {shown.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + test + lint**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 433.
Run: `npm run lint` → Expected: 0 error (img đã eslint-disable).

- [ ] **Step 6: Commit**

```bash
git add components/blog/PostCard.tsx public/blog/ content/blog/ app/blog/page.tsx
git commit -m "feat(blog): PostCard + ảnh cover + lọc theo tag ở /blog"
```

---

### Task 3: Khối "Cẩm nang mới nhất" trên trang chủ

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getAllPosts` (`@/lib/blog/posts`), `PostCard` (`@/components/blog/PostCard`)

- [ ] **Step 1: Lấy bài mới + render section trong `app/page.tsx`**

Thêm import (cùng nhóm đầu file):
```ts
import PostCard from "@/components/blog/PostCard";
import { getAllPosts } from "@/lib/blog/posts";
```
Thêm `getAllPosts()` vào `Promise.all` hiện có (thêm biến `allPosts` vào destructure cho khớp thứ tự):
```ts
    getAllPosts(),
```
Sau `Promise.all`, tính 3 bài mới nhất:
```ts
  const latestPosts = allPosts.slice(0, 3);
```
Chèn section NGAY TRƯỚC khối `{/* 3 bước */}` (Cách hoạt động):
```tsx
        {latestPosts.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-14">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Cẩm nang mới nhất</h2>
              <Link href="/blog" className="text-sm font-medium text-primary hover:underline">Xem tất cả →</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {latestPosts.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </section>
        )}
```
(`Link` đã import sẵn ở `app/page.tsx`.)

- [ ] **Step 2: Typecheck + test + lint**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 433 (không đổi).
Run: `npm run lint` → Expected: 0 error.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): khối 'Cẩm nang mới nhất' (3 bài) trên trang chủ"
```

---

### Task 4: Kiểm chứng cuối

**Files:** (không sửa; chỉ chạy)

- [ ] **Step 1: Lint + typecheck + test đầy đủ**

Run:
```bash
npx tsc --noEmit
npm run lint
npx vitest run
```
Expected: tsc sạch; `npm run lint` 0 error; vitest 433 PASS.

- [ ] **Step 2: Soát mắt (khuyến nghị)**

Run: `npm run dev`:
- `/blog`: thẻ có ảnh cover (2 bài mẫu); hàng chip tag; bấm chip lọc đúng (`/blog?tag=CV`); "Tất cả" reset.
- Trang chủ: khối "Cẩm nang mới nhất" hiện 3 bài (có cover), "Xem tất cả →" tới /blog.
- Bài chưa có cover → hiện fallback gradient (không vỡ layout).

## Self-Review

- **Spec coverage:** cover trong PostMeta (Task 1) ✅ · allTags/filterByTag (Task 1) ✅ · PostCard + cover render + fallback (Task 2) ✅ · 2 cover mẫu SVG + frontmatter (Task 2) ✅ · lọc tag ở /blog (Task 2) ✅ · khối trang chủ (Task 3) ✅ · unit test (Task 1) ✅ · kiểm chứng (Task 4) ✅.
- **Placeholder scan:** không có TBD/TODO; mọi step có code/lệnh.
- **Type consistency:** `PostMeta.cover` dùng ở buildPostMeta/PostCard/filter test; `allTags`/`filterByTag` chữ ký khớp /blog dùng; `PostCard` prop `{post}` dùng ở /blog + trang chủ; `getAllPosts()` trả `PostMeta[]` — slice(0,3) hợp lệ.
