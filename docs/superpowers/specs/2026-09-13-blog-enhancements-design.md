# Blog nâng cấp — lọc tag · khối trang chủ · ảnh cover — Design spec

**Ngày:** 2026-09-13
**Vòng:** Blog enhancements — tiếp nối [[blog-cam-nang]]

## Bối cảnh

Blog MVP đã chạy (`/blog`, `/blog/[slug]` từ file markdown). Backlog blog còn 3 mục: lọc theo
tag, khối "bài viết mới" trên trang chủ, và ảnh cover. Cả 3 gắn kết → một spec. Không schema/DB.

## Nguyên tắc thiết kế

- Logic thuần (`allTags`, `filterByTag`, `buildPostMeta`) tách khỏi I/O, unit-test.
- Ảnh cover là **file cục bộ trong `/public`** (đường dẫn như `/blog/x.svg`); render bằng `<img>`
  (an toàn SVG, không cần cấu hình `remotePatterns`/`dangerouslyAllowSVG`). `cover` là **tùy chọn** — thiếu thì fallback.
- Tiếng Việt; Tailwind tokens; tái dùng `getAllPosts`/`getPost` (`lib/blog/posts.ts`).

## Ảnh cover

- Frontmatter thêm khóa `cover` (đường dẫn public, ví dụ `/blog/cach-viet-cv.svg`).
- `PostMeta` thêm `cover: string`; `buildPostMeta` map `cover: data.cover || ""`.
- Kèm **2 ảnh cover mẫu SVG** trong `public/blog/` (ví dụ `cach-viet-cv.svg`, `chuan-bi-phong-van.svg`)
  và bổ sung `cover:` vào frontmatter 2 bài mẫu hiện có.
- Hiển thị cover ở: thẻ danh sách `/blog`, đầu bài `/blog/[slug]`, thẻ khối trang chủ. Thiếu cover →
  khối fallback (nền `bg-muted` + tag/tiêu đề), không để layout vỡ.

## Helper thuần — `lib/blog/`

- Sửa `post.ts`: `PostMeta` thêm `cover: string`; `buildPostMeta` thêm `cover: data.cover || ""`.
- Tạo `lib/blog/filter.ts`:
  - `export function allTags(posts: PostMeta[]): string[]` — các `tag` khác rỗng, **distinct** (giữ nguyên chữ), sắp `localeCompare("vi")`.
  - `export function filterByTag(posts: PostMeta[], tag: string | undefined): PostMeta[]` — `tag` rỗng/undefined → trả nguyên; ngược lại giữ `p.tag === tag`.

## Lọc theo tag — `app/blog/page.tsx`

- `searchParams: Promise<{ tag?: string }>`; `await searchParams`.
- `const posts = await getAllPosts()`; `const tags = allTags(posts)`; `const shown = filterByTag(posts, tag)`.
- Hàng chip: "Tất cả" (link `/blog`) + mỗi tag (link `/blog?tag=<tag>`); chip đang chọn nổi bật (nền primary).
- Lưới thẻ dùng `shown`; mỗi thẻ có cover (`<img>` nếu `p.cover`, else fallback) + tag + title + description + ngày.
- EmptyState khi `shown` rỗng.

## Khối trang chủ — `app/page.tsx`

- Sau khối phù hợp (ví dụ trước "3 bước"/Footer), thêm section "Cẩm nang mới nhất" chỉ khi có bài:
  `const latestPosts = await getAllPosts()` rồi `latestPosts.slice(0, 3)` (thêm vào `Promise.all` hiện có hoặc gọi riêng).
- Mỗi thẻ: cover (img/fallback) + title, link `/blog/<slug>`; kèm link "Xem tất cả →" tới `/blog`.
- Ẩn cả section nếu không có bài.

## Component dùng chung (tùy chọn gọn)

- `components/blog/PostCard.tsx` (thuần): nhận `PostMeta`, render cover(img/fallback)+tag+title+description+ngày;
  dùng lại ở `/blog` và (biến thể gọn) trang chủ. Nếu thấy khác biệt lớn giữa 2 nơi thì để mỗi nơi tự render — ưu tiên đơn giản.

## Kiểm thử

- Unit `allTags`: distinct, bỏ rỗng, sắp abc.
- Unit `filterByTag`: tag rỗng → nguyên; tag khớp → lọc; không khớp → [].
- Unit `buildPostMeta`: có `cover`; thiếu `cover` → "".
- Cập nhật test cũ `post.test.ts` (thêm `cover: ""`/giá trị vào kỳ vọng).
- Giữ toàn bộ test hiện có xanh (429 baseline).

## Dùng lại

`getAllPosts`/`getPost` (`lib/blog/posts.ts`), `PostMeta` (`lib/blog/post.ts`), `EmptyState`, Tailwind tokens.

## Ngoài phạm vi

Nhiều tag mỗi bài, phân trang, tối ưu ảnh raster qua next/image, ảnh cover URL ngoài, editor/DB.
