# Blog / Cẩm nang nghề (MVP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm blog/cẩm nang MVP dựa trên file markdown trong repo: trang công khai `/blog` + `/blog/[slug]`, SEO đầy đủ.

**Architecture:** Helper thuần (parse frontmatter, dựng meta, JSON-LD) được unit-test; lớp I/O mỏng đọc `content/blog/*.md`; route công khai render markdown bằng `react-markdown` + `remark-gfm`. Không schema/DB.

**Tech Stack:** Next.js 16 App Router (ĐỌC guide `node_modules/next/dist/docs/` trước khi viết route), React server components, `react-markdown` + `remark-gfm`, vitest.

## Global Constraints

- Không schema/DB/AI. Nội dung là `content/blog/<slug>.md` (frontmatter: title, description, date YYYY-MM-DD, tag, author).
- `/blog` và `/blog/[slug]` CÔNG KHAI (không auth). `params` là `Promise` — dùng `await params` (như `app/jobs/[id]/page.tsx`).
- Helper `lib/blog/{frontmatter,post,article-jsonld}.ts` THUẦN (không fs/next). I/O ở `lib/blog/posts.ts`.
- Tiếng Việt; Tailwind tokens; SEO mirror `lib/seo/job-jsonld.ts` + `absoluteUrl` (`lib/seo/url.ts`).
- Thêm 2 dep: `react-markdown`, `remark-gfm`. Baseline 417 tests giữ xanh. Test `npx vitest run`; typecheck `npx tsc --noEmit`; lint `npm run lint` (0 error).

---

### Task 1: Helper thuần (frontmatter + post + article-jsonld)

**Files:**
- Create: `lib/blog/frontmatter.ts`
- Create: `lib/blog/post.ts`
- Create: `lib/blog/article-jsonld.ts`
- Create: `lib/blog/__tests__/frontmatter.test.ts`
- Create: `lib/blog/__tests__/post.test.ts`
- Create: `lib/blog/__tests__/article-jsonld.test.ts`

**Interfaces:**
- Produces:
  - `parseFrontmatter(raw: string): { data: Record<string, string>; content: string }`
  - `type PostMeta = { slug: string; title: string; description: string; date: string; tag: string; author: string }`
  - `buildPostMeta(slug: string, data: Record<string, string>): PostMeta`
  - `buildArticleJsonLd(meta: PostMeta, url: string): Record<string, unknown>`

- [ ] **Step 1: Viết test thất bại**

`lib/blog/__tests__/frontmatter.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../frontmatter";

describe("parseFrontmatter", () => {
  it("đọc nhiều key, value chứa dấu ':' chỉ tách dấu đầu, bỏ dòng trống đầu content", () => {
    const raw = "---\ntitle: Hello\ndescription: A: B\n---\n\nBody line\n";
    const { data, content } = parseFrontmatter(raw);
    expect(data).toEqual({ title: "Hello", description: "A: B" });
    expect(content).toBe("Body line\n");
  });

  it("không có frontmatter -> data rỗng, content nguyên bản", () => {
    const raw = "# Tiêu đề\nnội dung";
    expect(parseFrontmatter(raw)).toEqual({ data: {}, content: raw });
  });

  it("hỗ trợ CRLF", () => {
    const raw = "---\r\ntitle: X\r\n---\r\nBody\r\n";
    const { data, content } = parseFrontmatter(raw);
    expect(data).toEqual({ title: "X" });
    expect(content).toBe("Body\n");
  });
});
```

`lib/blog/__tests__/post.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildPostMeta } from "../post";

describe("buildPostMeta", () => {
  it("map đầy đủ từ frontmatter", () => {
    const meta = buildPostMeta("bai-1", {
      title: "Tiêu đề", description: "Mô tả", date: "2026-09-13", tag: "CV", author: "An",
    });
    expect(meta).toEqual({
      slug: "bai-1", title: "Tiêu đề", description: "Mô tả", date: "2026-09-13", tag: "CV", author: "An",
    });
  });

  it("thiếu title -> fallback slug; field khác rỗng", () => {
    const meta = buildPostMeta("bai-2", {});
    expect(meta).toEqual({ slug: "bai-2", title: "bai-2", description: "", date: "", tag: "", author: "" });
  });
});
```

`lib/blog/__tests__/article-jsonld.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildArticleJsonLd } from "../article-jsonld";

const meta = { slug: "s", title: "Tiêu đề", description: "Mô tả", date: "2026-09-13", tag: "CV", author: "An" };

describe("buildArticleJsonLd", () => {
  it("shape BlogPosting đúng", () => {
    const ld = buildArticleJsonLd(meta, "https://x.vn/blog/s");
    expect(ld["@type"]).toBe("BlogPosting");
    expect(ld.headline).toBe("Tiêu đề");
    expect(ld.url).toBe("https://x.vn/blog/s");
    expect(ld.datePublished).toBe("2026-09-13");
    expect(ld.author).toEqual({ "@type": "Person", name: "An" });
  });

  it("thiếu author -> fallback SmartHire; thiếu date -> không có datePublished", () => {
    const ld = buildArticleJsonLd({ ...meta, author: "", date: "" }, "https://x.vn/blog/s");
    expect(ld.author).toEqual({ "@type": "Person", name: "SmartHire" });
    expect(ld.datePublished).toBeUndefined();
  });
});
```

- [ ] **Step 2: Chạy test — phải fail**

Run: `npx vitest run lib/blog/__tests__/`
Expected: FAIL (`Cannot find module '../frontmatter'` …).

- [ ] **Step 3: Viết implementation**

`lib/blog/frontmatter.ts`:
```ts
export function parseFrontmatter(raw: string): { data: Record<string, string>; content: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: {}, content: raw };
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return { data: {}, content: raw };

  const block = normalized.slice(4, end);
  const data: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) data[key] = value;
  }

  let content = normalized.slice(end + 1); // "---...\n<body>"
  content = content.replace(/^---[^\n]*\n?/, ""); // bỏ dòng fence đóng
  content = content.replace(/^\n+/, ""); // bỏ dòng trống đầu
  return { data, content };
}
```

`lib/blog/post.ts`:
```ts
export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  tag: string;
  author: string;
};

export function buildPostMeta(slug: string, data: Record<string, string>): PostMeta {
  return {
    slug,
    title: data.title || slug,
    description: data.description || "",
    date: data.date || "",
    tag: data.tag || "",
    author: data.author || "",
  };
}
```

`lib/blog/article-jsonld.ts`:
```ts
import type { PostMeta } from "./post";

export function buildArticleJsonLd(meta: PostMeta, url: string): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "BlogPosting",
    headline: meta.title,
    description: meta.description,
    author: { "@type": "Person", name: meta.author || "SmartHire" },
    url,
  };
  if (meta.date) ld.datePublished = meta.date;
  return ld;
}
```

- [ ] **Step 4: Chạy test — phải pass**

Run: `npx vitest run lib/blog/__tests__/`
Expected: PASS (7 test).

- [ ] **Step 5: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 417 + 7 = 424 PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/blog/frontmatter.ts lib/blog/post.ts lib/blog/article-jsonld.ts lib/blog/__tests__/
git commit -m "feat(blog): helper thuần parseFrontmatter/buildPostMeta/buildArticleJsonLd"
```

---

### Task 2: Cài dep + lớp I/O `posts.ts` + bài mẫu

**Files:**
- Modify: `package.json`, `package-lock.json` (cài dep)
- Create: `lib/blog/posts.ts`
- Create: `content/blog/cach-viet-cv-gay-an-tuong.md`
- Create: `content/blog/chuan-bi-phong-van.md`

**Interfaces:**
- Consumes: `parseFrontmatter`, `buildPostMeta`, `PostMeta`
- Produces:
  - `getAllPosts(): Promise<PostMeta[]>`
  - `getPost(slug: string): Promise<{ meta: PostMeta; content: string } | null>`

- [ ] **Step 1: Cài dependency**

Run: `npm install react-markdown remark-gfm`
Expected: `package.json` có `react-markdown` và `remark-gfm` trong `dependencies`; không lỗi.

- [ ] **Step 2: Lớp I/O `lib/blog/posts.ts`**

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter";
import { buildPostMeta, type PostMeta } from "./post";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const SLUG_RE = /^[a-z0-9-]+$/;

export async function getAllPosts(): Promise<PostMeta[]> {
  let files: string[];
  try {
    files = await readdir(BLOG_DIR);
  } catch {
    return [];
  }
  const posts: PostMeta[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = file.slice(0, -3);
    const raw = await readFile(path.join(BLOG_DIR, file), "utf8");
    const { data } = parseFrontmatter(raw);
    posts.push(buildPostMeta(slug, data));
  }
  posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return posts;
}

export async function getPost(slug: string): Promise<{ meta: PostMeta; content: string } | null> {
  if (!SLUG_RE.test(slug)) return null;
  try {
    const raw = await readFile(path.join(BLOG_DIR, `${slug}.md`), "utf8");
    const { data, content } = parseFrontmatter(raw);
    return { meta: buildPostMeta(slug, data), content };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Bài mẫu 1**

`content/blog/cach-viet-cv-gay-an-tuong.md`:
```markdown
---
title: Cách viết CV gây ấn tượng với nhà tuyển dụng
description: Những nguyên tắc cốt lõi giúp CV của bạn nổi bật và vượt qua vòng sàng lọc.
date: 2026-09-10
tag: CV
author: SmartHire
---

## Bắt đầu từ mục tiêu rõ ràng

Một CV tốt luôn hướng tới một vị trí cụ thể. Hãy đọc kỹ mô tả công việc và chọn lọc
kinh nghiệm phù hợp nhất để đưa lên đầu.

## Ưu tiên thành tựu, không chỉ nhiệm vụ

Thay vì liệt kê công việc, hãy nêu kết quả đo lường được:

- "Tăng 30% lượng truy cập trong 3 tháng"
- "Giảm 20% thời gian xử lý đơn hàng"

## Trình bày gọn gàng

Giữ CV trong 1–2 trang, dùng bố cục nhất quán và kiểm tra kỹ chính tả trước khi gửi.
```

- [ ] **Step 4: Bài mẫu 2**

`content/blog/chuan-bi-phong-van.md`:
```markdown
---
title: Chuẩn bị phỏng vấn: checklist cho ứng viên
description: Các bước chuẩn bị giúp bạn tự tin và thể hiện tốt trong buổi phỏng vấn.
date: 2026-09-12
tag: Phỏng vấn
author: SmartHire
---

## Tìm hiểu về công ty

Nắm rõ sản phẩm, văn hoá và tin tức gần đây của công ty để trả lời câu hỏi
"Vì sao bạn muốn làm ở đây?" một cách thuyết phục.

## Luyện các câu hỏi thường gặp

- Giới thiệu bản thân trong 1 phút
- Điểm mạnh, điểm yếu
- Một tình huống khó bạn đã xử lý

## Chuẩn bị câu hỏi ngược

Hỏi lại nhà tuyển dụng về lộ trình phát triển, kỳ vọng với vị trí — điều này thể hiện
sự nghiêm túc của bạn.
```

- [ ] **Step 5: Typecheck + test**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 424 (không đổi).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/blog/posts.ts content/blog/
git commit -m "feat(blog): react-markdown/remark-gfm + posts.ts I/O + 2 bài mẫu"
```

---

### Task 3: Route /blog + /blog/[slug] + Navbar/Footer

**Files:**
- Create: `app/blog/page.tsx`
- Create: `app/blog/[slug]/page.tsx`
- Modify: `components/Navbar.tsx`
- Modify: `components/Footer.tsx`

**Interfaces:**
- Consumes: `getAllPosts`, `getPost` (`@/lib/blog/posts`); `buildArticleJsonLd` (`@/lib/blog/article-jsonld`); `absoluteUrl` (`@/lib/seo/url`)

- [ ] **Step 1: Trang danh sách `app/blog/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { EmptyState } from "@/components/ui/empty-state";
import { getAllPosts } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Cẩm nang nghề nghiệp | SmartHire",
  description: "Bài viết, mẹo viết CV, phỏng vấn và phát triển sự nghiệp trên SmartHire.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const posts = await getAllPosts();
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-foreground">Cẩm nang nghề nghiệp</h1>
        <p className="mt-1 text-sm text-muted-foreground">Mẹo viết CV, phỏng vấn và phát triển sự nghiệp.</p>
        {posts.length === 0 ? (
          <div className="mt-8">
            <EmptyState icon={<BookOpen className="h-10 w-10" />} title="Chưa có bài viết" description="Nội dung cẩm nang sẽ sớm được cập nhật." />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {posts.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                {p.tag && <span className="text-xs font-medium text-primary">{p.tag}</span>}
                <h2 className="mt-1 font-semibold text-foreground">{p.title}</h2>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                {p.date && <p className="mt-2 text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString("vi-VN")}</p>}
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Trang bài viết `app/blog/[slug]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAllPosts, getPost } from "@/lib/blog/posts";
import { buildArticleJsonLd } from "@/lib/blog/article-jsonld";
import { absoluteUrl } from "@/lib/seo/url";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: `${post.meta.title} | SmartHire`,
    description: post.meta.description,
    alternates: { canonical: `/blog/${slug}` },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const { meta, content } = post;
  const byline = [meta.author, meta.date ? new Date(meta.date).toLocaleDateString("vi-VN") : ""].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildArticleJsonLd(meta, absoluteUrl(`/blog/${slug}`))) }}
        />
        {meta.tag && <span className="text-xs font-medium text-primary">{meta.tag}</span>}
        <h1 className="mt-1 text-3xl font-bold text-foreground">{meta.title}</h1>
        {byline && <p className="mt-2 text-sm text-muted-foreground">{byline}</p>}
        <div className="mt-6 text-foreground [&_a]:text-primary [&_a]:underline [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-semibold [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 3: Link "Cẩm nang" luôn hiển thị ở Navbar**

Trong `components/Navbar.tsx`, trong vùng trái (div chứa brand + nav), ngay SAU thẻ `</Link>` của brand (logo SmartHire) và TRƯỚC khối `{loggedIn && (<nav ...>...)}`, thêm:
```tsx
          <Link
            href="/blog"
            className="hidden shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Cẩm nang
          </Link>
```
(`Link` đã được import sẵn ở đầu Navbar.)

- [ ] **Step 4: Link "Cẩm nang" ở Footer**

Trong `components/Footer.tsx`, cột "Ứng viên" (`<ul>`), thêm mục:
```tsx
            <li><Link href="/blog" className="hover:text-foreground">Cẩm nang nghề nghiệp</Link></li>
```

- [ ] **Step 5: Typecheck + test + lint**

Run: `npx tsc --noEmit` → Expected: không lỗi.
Run: `npx vitest run` → Expected: 424.
Run: `npm run lint` → Expected: 0 error.

- [ ] **Step 6: Chạy app soát bằng mắt**

Run: `npm run dev`, mở `/blog` (không đăng nhập) → thấy 2 bài; bấm vào → bài render markdown đúng (heading, list, link). Navbar có "Cẩm nang".
Nếu `react-markdown` lỗi khi render server → DỪNG, báo NEEDS_CONTEXT.

- [ ] **Step 7: Commit**

```bash
git add app/blog/ components/Navbar.tsx components/Footer.tsx
git commit -m "feat(blog): trang /blog + /blog/[slug] + link Navbar/Footer"
```

---

### Task 4: Sitemap + kiểm chứng cuối

**Files:**
- Modify: `app/sitemap.ts`

**Interfaces:**
- Consumes: `getAllPosts` (`@/lib/blog/posts`)

- [ ] **Step 1: Thêm blog vào sitemap**

Trong `app/sitemap.ts`, thêm import:
```ts
import { getAllPosts } from "@/lib/blog/posts";
```
Trong hàm `sitemap`, lấy bài viết (cùng chỗ query jobs):
```ts
  const posts = await getAllPosts();
```
Thêm `/blog` vào `staticRoutes` (sau `/salaries`):
```ts
    { url: absoluteUrl("/blog"), changeFrequency: "weekly", priority: 0.6 },
```
Trước `return`, thêm mảng bài viết và gộp vào kết quả:
```ts
  const blogRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: absoluteUrl(`/blog/${p.slug}`),
    lastModified: p.date ? new Date(p.date) : undefined,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...staticRoutes, ...jobRoutes, ...blogRoutes];
```
(sửa dòng `return [...staticRoutes, ...jobRoutes];` cũ thành dòng trên.)

- [ ] **Step 2: Lint + typecheck + test đầy đủ**

Run:
```bash
npx tsc --noEmit
npm run lint
npx vitest run
```
Expected: tsc sạch; `npm run lint` 0 error; vitest 424 PASS.

- [ ] **Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "feat(blog): thêm /blog + bài viết vào sitemap"
```

## Self-Review

- **Spec coverage:** helper parse/meta/jsonld + tests (Task 1) ✅ · dep + posts.ts I/O + 2 bài mẫu (Task 2) ✅ · /blog + /blog/[slug] render markdown + JSON-LD + notFound (Task 3) ✅ · Navbar luôn hiển thị + Footer (Task 3) ✅ · sitemap (Task 4) ✅ · kiểm chứng (Task 4) ✅.
- **Placeholder scan:** không có TBD/TODO; mọi step có code/lệnh cụ thể.
- **Type consistency:** `PostMeta` dùng thống nhất ở post/article-jsonld/posts/route; `getAllPosts`/`getPost` chữ ký khớp nơi gọi (blog page, [slug] page, sitemap); `parseFrontmatter` trả `{data,content}` đúng như posts.ts dùng; `params: Promise<{slug}>` + `await params` khớp Next 16.
