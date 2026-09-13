# Blog / Cẩm nang nghề (MDX-lite, MVP) — Design spec

**Ngày:** 2026-09-13
**Vòng:** Blog — tiếp nối [[salary-by-level-skill]]

## Bối cảnh

Các site tuyển dụng lớn (ITviec "Story Hub", TopCV blog) có mục nội dung nghề nghiệp — tốt cho
SEO và giữ chân người dùng. App chưa có. Vòng này thêm blog/cẩm nang MVP: nội dung là file
markdown trong repo (dev soạn, git version), trang công khai, SEO đầy đủ. Không schema/DB.

## Nguyên tắc thiết kế

- Logic parse thuần (`parseFrontmatter`, `buildPostMeta`, `buildArticleJsonLd`) tách khỏi I/O để unit-test.
- Trang `/blog` và `/blog/[slug]` CÔNG KHAI (như `/jobs/[id]`, `/salaries`).
- Tiếng Việt; Tailwind tokens; SEO mirror mẫu `lib/seo/job-jsonld.ts` + `absoluteUrl`.
- Thêm 2 dependency chuẩn: `react-markdown`, `remark-gfm` (render thân bài). Không thêm plugin typography (dùng child-selector Tailwind).

## Nội dung

- Thư mục `content/blog/<slug>.md`. Frontmatter (khối `---`):
  `title`, `description`, `date` (YYYY-MM-DD), `tag`, `author`. Sau khối là thân markdown.
- Kèm 2 bài mẫu: `cach-viet-cv-gay-an-tuong.md`, `chuan-bi-phong-van.md` (nội dung cẩm nang tiếng Việt ngắn).

## Helper thuần — `lib/blog/`

- `frontmatter.ts` → `export function parseFrontmatter(raw: string): { data: Record<string, string>; content: string }`
  - Nếu `raw` bắt đầu bằng `---\n`, đọc tới `\n---` kế tiếp: mỗi dòng `key: value` (tách ở dấu `:` ĐẦU TIÊN, trim key+value); phần còn lại (sau `---`) là `content` (bỏ 1 dòng trống đầu nếu có).
  - Không có frontmatter → `{ data: {}, content: raw }`.
- `post.ts`:
  - `export type PostMeta = { slug: string; title: string; description: string; date: string; tag: string; author: string }`
  - `export function buildPostMeta(slug: string, data: Record<string, string>): PostMeta`
    - Map từ `data` với fallback: `title` → data.title || slug; `description`/`tag`/`author` → data.* || ""; `date` → data.date || "".
- `article-jsonld.ts` → `export function buildArticleJsonLd(meta: PostMeta, url: string): Record<string, unknown>`
  - `@context: "https://schema.org/"`, `@type: "BlogPosting"`, `headline: meta.title`, `description`, `datePublished: meta.date` (nếu có), `author: { @type: "Person", name: meta.author || "SmartHire" }`, `url`.

## Lớp I/O — `lib/blog/posts.ts`

- `getAllPosts(): Promise<PostMeta[]>` — đọc `content/blog`, lọc file `.md`, với mỗi file: đọc nội dung → `parseFrontmatter` → `buildPostMeta(slug, data)` (slug = tên file bỏ `.md`). Sắp theo `date` giảm dần (chuỗi YYYY-MM-DD so sánh trực tiếp; rỗng xuống cuối).
- `getPost(slug: string): Promise<{ meta: PostMeta; content: string } | null>` — đọc `content/blog/<slug>.md`; không tồn tại → `null`. Chống path traversal: chỉ nhận slug khớp `^[a-z0-9-]+$`.
- Dùng `node:fs/promises` + `node:path`; đường dẫn gốc `process.cwd()/content/blog`.

## Routes (công khai)

- `app/blog/page.tsx`: `getAllPosts()` → lưới thẻ (title, description, ngày `toLocaleDateString("vi-VN")`, tag). `EmptyState` khi rỗng. `metadata` tĩnh (title/description/canonical `/blog`). Navbar + Footer.
- `app/blog/[slug]/page.tsx`:
  - `generateStaticParams` từ danh sách slug (tùy chọn, để build tĩnh).
  - `generateMetadata({params})` → dùng `getPost`; không có → metadata rỗng/mặc định. Có → title `${meta.title} | SmartHire`, description, canonical `/blog/${slug}`.
  - Component: `getPost`; `null` → `notFound()`. Render tiêu đề + meta (ngày/tag/author) + thân qua `<ReactMarkdown remarkPlugins={[remarkGfm]}>` bọc trong `<div>` có class typography (child-selector Tailwind: `[&_h2]`, `[&_p]`, `[&_ul]`, `[&_a]`…). Chèn `<script type="application/ld+json">` với `buildArticleJsonLd(meta, absoluteUrl('/blog/'+slug))`.

## SEO & điều hướng

- `app/sitemap.ts`: thêm route tĩnh `/blog` (priority ~0.6) và từng `/blog/${slug}` (lastModified theo `date` nếu parse được, priority ~0.6). Dùng `getAllPosts()`.
- `components/Navbar.tsx`: thêm link **"Cẩm nang"** (`/blog`) **luôn hiển thị** cạnh logo (cả khách chưa đăng nhập lẫn đã đăng nhập).
- `components/Footer.tsx`: thêm link "Cẩm nang" (`/blog`) ở cột phù hợp.

## Kiểm thử

- Unit `parseFrontmatter`: có frontmatter nhiều key; value chứa dấu `:` (chỉ tách dấu đầu); không có frontmatter → data rỗng + content nguyên; bỏ dòng trống đầu content.
- Unit `buildPostMeta`: fallback title→slug khi thiếu; các field rỗng khi thiếu.
- Unit `buildArticleJsonLd`: shape đúng (@type BlogPosting, headline, url, author fallback).
- Giữ toàn bộ test hiện có xanh (417 baseline).

## Dùng lại

`absoluteUrl` (`lib/seo/url.ts`), mẫu JSON-LD script ở `app/jobs/[id]/page.tsx`,
`EmptyState`, `Navbar`, `Footer`, Tailwind tokens.

## Ngoài phạm vi

Lọc theo tag, khối bài viết trên trang chủ, ảnh cover, MDX nhúng React, DB/editor, bình luận.
