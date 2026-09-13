# Tag "Hot" + thống kê tin — Design spec

**Ngày:** 2026-09-13
**Vòng:** Hot jobs — tiếp nối [[salary-insights]] / [[home-trust-discovery]]

## Bối cảnh

Gói A đã thêm badge "Mới"/"Lương cao" trên thẻ việc (helper thuần `jobBadges`). Backlog còn
tag **"Hot"** (tin nhiều ứng tuyển) — cần đếm số `Application` mỗi tin. Dữ liệu đã có
(`Application.jobId`), chưa surface. Vòng này: badge "Hot" trên thẻ việc + hiện số lượt ứng
tuyển mỗi tin cho nhà tuyển dụng ở dashboard.

Ghi chú quyết định: **match% trên /jobs đã bị bỏ hẳn** (user chốt 2026-09-13), không nằm trong lộ trình.

## Nguyên tắc thiết kế

- Logic quyết định badge thuần (`jobBadges`) — mở rộng, test đầy đủ.
- Không schema mới; đếm từ `Application` sẵn có.
- "Hot" = `applicationCount >= HOT_APPLICATIONS` với `HOT_APPLICATIONS = 3`.
- Tiếng Việt; Tailwind tokens; prisma default import `@/lib/db/prisma`.

## Thành phần

### 1. Mở rộng `jobBadges` — `lib/jobs/job-badges.ts`

- Thêm `HOT_APPLICATIONS = 3`; thêm `"hot"` vào union `JobBadge.tone`.
- `jobBadges` nhận thêm `applicationCount?: number` trong tham số `job` (giữ nguyên chữ ký dạng `jobBadges(job, now?)`).
- Thêm badge **"Hot"** khi `(job.applicationCount ?? 0) >= HOT_APPLICATIONS`.
- Thứ tự trả về: **Hot → Mới → Lương cao**.

### 2. Thẻ việc — `components/JobCard.tsx`

- Thêm `applicationCount?: number` vào `JobCardData` (JobCard đã truyền cả `job` vào `jobBadges`, nên "Hot" chảy tự nhiên khi field có mặt).
- Render pill tone `"hot"` với màu riêng (đỏ/rose, ví dụ `bg-rose-500/10 text-rose-600 dark:text-rose-400`).

### 3. Nguồn dữ liệu số lượt ứng tuyển

- **`/jobs` (raw SQL)** — `lib/jobs/search-query.ts`: thêm cột tính vào `COLS`:
  `(SELECT COUNT(*)::int FROM "Application" WHERE "Application"."jobId" = "JobDescription".id) AS "applicationCount"`.
  Thêm `applicationCount: number` vào `JobRow` (`lib/jobs/search.ts`). Cột này chảy qua cả lần đầu lẫn infinite-scroll (JobsBrowser dùng chung `searchJobs`).
- **Trang chủ** — `app/page.tsx`: `latestJobs` thêm `_count: { select: { applications: true } }`; map `applicationCount: j._count.applications` khi truyền vào `JobCard`.

### 4. Thống kê cho nhà tuyển dụng — `app/dashboard/page.tsx` (nhánh RECRUITER)

- Query danh sách tin của NTD thêm `_count: { select: { applications: true } }`.
- Hiện "· N ứng tuyển" cạnh ngày đăng mỗi tin.

## Ngoài phạm vi

- `/jobs/saved` và `/jobs/recommendations` **không** hiện "Hot" vòng này (nguồn dữ liệu riêng, không dùng `JobRow`) — chấp nhận, ghi chú.
- Đếm lượt **xem** tin (cần cột/counter mới) — hoãn; "Hot" chỉ theo lượt ứng tuyển.
- match% trên /jobs (đã bỏ hẳn), blog.

## Kiểm thử

- Unit `jobBadges`: "Hot" khi `applicationCount >= 3`; không khi < 3 hoặc thiếu; thứ tự Hot→Mới→Lương cao khi cả ba điều kiện đúng; các test cũ vẫn đúng (badge không-Hot không đổi).
- Giữ toàn bộ test hiện có xanh (408 baseline).

## Dùng lại

`jobBadges`/`JobBadge` (`lib/jobs/job-badges.ts`), `JobCardData`/`JobCard`, `JobRow`/`searchJobs`,
mẫu raw SQL trong `lib/jobs/search-query.ts`.
