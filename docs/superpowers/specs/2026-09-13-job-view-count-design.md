# Đếm lượt xem tin — Design spec

**Ngày:** 2026-09-13
**Vòng:** Job view count — tiếp nối [[blog-cam-nang]] / [[hot-jobs]]

## Bối cảnh

Backlog còn "đếm lượt xem tin" — bổ sung tín hiệu độ quan tâm cho ứng viên (độ hot) và cho recruiter
(analytics tin). Hiện chưa có. Vòng này thêm bộ đếm lượt xem cho `/jobs/[id]`, chống trùng bằng cookie,
loại lượt của chủ tin; hiển thị "N lượt xem" cho mọi người trên trang tin và cho recruiter ở dashboard.

## Nguyên tắc thiết kế

- Logic "có đếm không" thuần (`recordView`) tách khỏi I/O để unit-test.
- Render trang giữ read-only; việc đếm qua **beacon client → route handler POST**.
- Chống trùng bằng **một cookie/ngày** (không tạo nhiều cookie). Loại lượt của chủ tin.
- Prisma v6; prisma default import `@/lib/db/prisma`; `params` là Promise (`await params`); route `runtime = "nodejs"`.

## Schema (1 cột)

- `viewCount Int @default(0)` trên `JobDescription`. Áp bằng `npm run db:push` + `npx prisma generate` (additive, an toàn ngược).

## Helper thuần — `lib/jobs/view-count.ts`

- `export function recordView(cookieValue: string | undefined, jobId: string, today: string): { count: boolean; cookie: string }`
  - Cookie định dạng `YYYY-MM-DD|id1,id2,...` (chỉ chứa các tin đã xem TRONG NGÀY `today`).
  - `date !== today` (hoặc cookie rỗng/không có `|`) → `{ count: true, cookie: \`${today}|${jobId}\` }` (reset theo ngày).
  - `date === today` và `jobId` đã có → `{ count: false, cookie: raw }`.
  - `date === today` và `jobId` chưa có → `{ count: true, cookie: \`${today}|<csv + jobId>\` }`.

## Route handler — `app/api/jobs/[id]/view/route.ts` (POST)

- `runtime = "nodejs"`.
- `await params` lấy `id`. Tìm `job` `isPublic` (`select { userId }`); không có → `Response(null, { status: 204 })` (no-op).
- `await auth()`; nếu `session?.user?.id === job.userId` (chủ tin) → 204, không đếm.
- `const store = await cookies()` (`next/headers`); `today = new Date().toISOString().slice(0,10)`.
- `recordView(store.get("viewed")?.value, id, today)`; nếu `count`:
  - `prisma.jobDescription.update({ where: { id }, data: { viewCount: { increment: 1 } } })`.
  - `store.set("viewed", cookie, { maxAge: 60*60*24*2, path: "/", httpOnly: true, sameSite: "lax" })`.
- Trả `Response(null, { status: 204 })`.

## Client beacon — `components/jobs/ViewTracker.tsx`

- `"use client"`; nhận `{ jobId: string }`; `useEffect(() => { fetch(\`/api/jobs/${jobId}/view\`, { method: "POST" }).catch(() => {}); }, [jobId])`; `return null`.

## Hiển thị

- `app/jobs/[id]/page.tsx`: `select` thêm `viewCount`; render dòng "N lượt xem" (gần meta/tiêu đề, cạnh nút lưu) — **hiện cho mọi người**; mount `<ViewTracker jobId={job.id} />`.
- `app/dashboard/page.tsx` (nhánh RECRUITER): `select` thêm `viewCount`; hiện "· N lượt xem" cạnh "· N ứng tuyển" mỗi tin.

## Kiểm thử

- Unit `recordView`: cookie rỗng → đếm + cookie `today|jobId`; cùng ngày, cùng tin → không đếm; cùng ngày, tin mới → đếm + thêm id; ngày khác → reset (đếm, cookie mới).
- Giữ toàn bộ test hiện có xanh (424 baseline).

## Dùng lại

`auth` (`@/auth`), `prisma` (`@/lib/db/prisma`), `cookies` (`next/headers`), mẫu route handler `[id]` (`app/api/company/[id]/logo/route.ts`).

## Ngoài phạm vi

Bảng event per-view + analytics theo thời gian; "unique viewers"; lọc bot nâng cao; đưa lượt xem lên thẻ `/jobs` list (raw SQL); dùng viewCount để tính "Hot" (Hot vẫn theo lượt ứng tuyển).
