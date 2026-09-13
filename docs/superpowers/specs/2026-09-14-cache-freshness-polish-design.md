# Làm tươi cache tin + chuẩn hoá tag blog — Design spec

**Ngày:** 2026-09-14
**Vòng:** Dọn nợ nhỏ — tiếp nối [[blog-cam-nang]] / [[salary-by-level-skill]]

## Bối cảnh

`/salaries` cache dữ liệu qua `unstable_cache({ tags: [CACHE_TAGS.jobs], revalidate: 3600 })`,
nhưng các action đổi tin (tạo/xóa/ẩn-hiện) hiện KHÔNG gọi `revalidateTag(jobs)`, nên số liệu
lương cũ tối đa 1h sau khi tin thay đổi. Ngoài ra helper `allTags` thêm `p.tag` chưa trim → tag
có khoảng trắng thừa gây lệch khớp. Vòng này vá cả hai; không tính năng mới.

## Nguyên tắc thiết kế

- Chỉ thêm `revalidateTag(CACHE_TAGS.jobs, "max")` (đúng mẫu `revalidateTag(CACHE_TAGS.dashboard, "max")` sẵn có).
- KHÔNG bust cache khi đếm lượt xem (`/api/jobs/[id]/view`) — đếm view không thuộc aggregate lương và bust sẽ vô hiệu hoá cache.
- `filter.ts` giữ thuần. Tiếng Việt; prisma default `@/lib/db/prisma`.

## Hạng mục 1 — Làm tươi cache tag `jobs`

- `lib/jobs/actions.ts`:
  - `createJobDescription`: thêm `revalidateTag(CACHE_TAGS.jobs, "max")` ngay trước `redirect("/dashboard")`.
  - `deleteJobDescription`: thêm `revalidateTag(CACHE_TAGS.jobs, "max")` cạnh `revalidateTag(CACHE_TAGS.dashboard, "max")` sẵn có.
  - (`revalidateTag` + `CACHE_TAGS` đã import sẵn ở file này.)
- `lib/admin/actions.ts`:
  - Thêm import `import { revalidateTag } from "next/cache";` (đang chỉ có `revalidatePath`) và `import { CACHE_TAGS } from "@/lib/cache/tags";`.
  - `deleteJobAsAdmin`: thêm `revalidateTag(CACHE_TAGS.jobs, "max")` (cạnh `revalidatePath("/admin/jobs")`).
  - `setJobPublicAsAdmin`: thêm `revalidateTag(CACHE_TAGS.jobs, "max")` (cạnh `revalidatePath("/admin/jobs")`).

## Hạng mục 2 — Chuẩn hoá tag blog

- `lib/blog/filter.ts`:
  - `allTags`: `if (p.tag.trim()) set.add(p.tag.trim())` (thêm bản đã trim).
  - `filterByTag`: `if (!tag) return posts;` giữ nguyên; so khớp `posts.filter((p) => p.tag.trim() === tag)`.

## Kiểm thử

- `lib/blog/__tests__/filter.test.ts`: thêm case tag có khoảng trắng thừa —
  `allTags` trả bản trim (distinct với bản không trim); `filterByTag(posts, "CV")` khớp cả post `tag: "CV "`.
- Các action `revalidateTag` KHÔNG unit-test (server action side-effect, mirror mẫu sẵn có) — xác minh `npx tsc --noEmit`.
- Giữ toàn bộ test hiện có xanh (433 baseline).

## Dùng lại

`revalidateTag`/`CACHE_TAGS` (mẫu ở `lib/jobs/actions.ts` deleteJobDescription), `PostMeta` (`lib/blog/post.ts`).

## Ngoài phạm vi

Lọc chéo ngành×cấp bậc /salaries; bust cache khi đếm view; các tối ưu cache khác.
