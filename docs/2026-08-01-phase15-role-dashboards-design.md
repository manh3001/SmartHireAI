# Phase 15 — Dashboard theo vai (NTD & ứng viên)

Ngày: 2026-08-01

Phase thứ hai trong nhóm Dashboard, sau [[Admin phase 14]]. Kết thúc nhóm Dashboard;
sau phase này còn Realtime.

## Mục tiêu

Chèn một dải thống kê lên đầu trang `/dashboard`, hiển thị theo vai:
- **Nhà tuyển dụng (NTD):** phễu tuyển dụng trên các tin của mình (đếm tổng quan,
  phân bố trạng thái đơn, tỉ lệ chuyển đổi, điểm AI trung bình).
- **Ứng viên:** thống kê đơn của mình (đếm tổng quan, phân bố trạng thái, điểm AI
  trung bình, hoạt động gần đây).

Admin không đổi (họ dùng `/admin`).

## 1. Vị trí & cấu trúc

- Dải thống kê chèn **lên đầu `/dashboard`**, phía trên danh sách CV/JD hiện có.
- `app/dashboard/page.tsx` có 2 nhánh (recruiter/candidate). Tách phần thống kê thành
  component riêng, mỗi component tự nạp số liệu qua lớp data:
  - `app/dashboard/RecruiterStats.tsx` — render ở nhánh recruiter, đầu `<main>`.
  - `app/dashboard/CandidateStats.tsx` — render ở nhánh candidate, đầu `<main>`.
- Hiển thị bằng `Card`/stat cards + bar Tailwind thủ công (không thư viện chart),
  đồng bộ style với `/admin`.

## 2. Lớp dữ liệu (tách thuần để test)

- `lib/dashboard/recruiter-stats.ts` → `getRecruiterStats(userId: string)`:
  - Số tin đang đăng: `jobDescription.count({ where: { userId, isPublic: true } })`.
  - Đơn vào các tin của mình: `application` với `where: { job: { userId } }` —
    `groupBy status` (đếm), `count` tổng, `count` `SUBMITTED` (đơn mới),
    `aggregate _avg overallScore` cho các đơn có `evaluation` (lọc
    `evaluationId: { not: null }`).
  - Trả: `{ openJobs, totalApplicants, newApplicants, statusCounts, avgScore }`
    trong đó `statusCounts` là mảng `{status, count}` thô cho `shapeStatusDistribution`.
- `lib/dashboard/candidate-stats.ts` → `getCandidateStats(userId: string)`:
  - `cvCount = cV.count({ where: { userId } })`.
  - `savedCount = savedJob.count({ where: { userId } })`.
  - Đơn của mình: `application` `where: { candidateId: userId }` — `groupBy status`,
    `count` tổng.
  - `avgScore`: `evaluation.aggregate({ where: { userId }, _avg: { overallScore },
    _count })`.
  - `recentEvents`: 5 `applicationEvent` mới nhất của đơn mình —
    `where: { application: { candidateId: userId } }`, `orderBy createdAt desc`,
    `take 5`, kèm `application.job.title`.
  - Trả: `{ cvCount, savedCount, totalApplications, statusCounts, avgScore, recentEvents }`.
- **Hàm thuần test được** trong `lib/dashboard/shape.ts`:
  - `computeConversion(statusCounts: {status: string; count: number}[]):
    { total: number; hiredRate: number; interviewRate: number }`
    - `total` = tổng mọi count.
    - `hiredRate` = HIRED / total (0 nếu total = 0).
    - `interviewRate` = (INTERVIEW + OFFER + HIRED) / total (0 nếu total = 0).
    - Trả tỉ lệ dạng số 0–1 (UI nhân 100 + "%").
  - `formatActivity(event: { toStatus: string; jobTitle: string }): string`
    - Vd `{ toStatus: "INTERVIEW", jobTitle: "Frontend" }` →
      `'Đơn "Frontend" chuyển sang Phỏng vấn'` (dùng `STATUS_LABELS`).

## 3. Chuyển `shapeStatusDistribution` về đúng nhà (dùng chung)

- Hiện `shapeStatusDistribution` nằm ở `lib/admin/stats-shape.ts` (admin-namespaced)
  nhưng bản chất generic. **Chuyển sang `lib/applications/status.ts`** (cạnh
  `APPLICATION_STATUSES` + `STATUS_LABELS` — đúng domain), export từ đó.
- Cập nhật `lib/admin/stats.ts`: import `shapeStatusDistribution` từ
  `@/lib/applications/status` thay vì `./stats-shape`. `lib/admin/stats-shape.ts` giữ
  lại `shapeRoleCounts` + `summarizeSalaries`.
- Di chuyển các test `shapeStatusDistribution` từ `lib/admin/__tests__/stats-shape.test.ts`
  sang `lib/applications/__tests__/status.test.ts` (giữ nguyên các ca; xoá khối đó
  khỏi test admin để không trùng).
- Cả `/admin`, `RecruiterStats`, `CandidateStats` cùng dùng một
  `shapeStatusDistribution`.

## 4. Nội dung dashboard NTD

- **Đếm tổng quan:** số tin đang đăng (`openJobs`), tổng ứng viên nộp
  (`totalApplicants`), đơn mới chưa xử lý (`newApplicants` = SUBMITTED).
- **Phễu theo trạng thái:** `shapeStatusDistribution(statusCounts)` → thanh bar (bảo
  vệ chia-0 bằng `Math.max(1, ...)` như `/admin`).
- **Tỉ lệ chuyển đổi:** `computeConversion(statusCounts)` → hiển thị `hiredRate` và
  `interviewRate` dạng %.
- **Điểm AI trung bình:** `avgScore` (làm tròn; null → "—").

## 5. Nội dung dashboard ứng viên

- **Đếm tổng quan:** `cvCount`, `totalApplications`, `savedCount`.
- **Đơn theo trạng thái:** `shapeStatusDistribution(statusCounts)` → thanh bar.
- **Điểm AI trung bình:** `avgScore` (làm tròn; null → "—").
- **Hoạt động gần đây:** `recentEvents` map qua `formatActivity` → danh sách 5 dòng;
  rỗng → dòng "Chưa có hoạt động nào".

## 6. Test (TDD, hàm thuần)

- `lib/dashboard/__tests__/shape.test.ts`:
  - `computeConversion`: tính đúng hiredRate/interviewRate với dữ liệu mẫu; total = 0
    → cả hai = 0 (không chia 0); chỉ INTERVIEW → interviewRate > 0, hiredRate = 0.
  - `formatActivity`: chuỗi đúng cho vài `toStatus` (INTERVIEW, OFFER, HIRED); dùng
    nhãn tiếng Việt từ `STATUS_LABELS`.
- `lib/applications/__tests__/status.test.ts`:
  - Bổ sung ca `shapeStatusDistribution` (đủ 7 trạng thái, đúng thứ tự, vắng = 0) —
    chuyển từ test admin.
- `lib/admin/__tests__/stats-shape.test.ts`:
  - Xoá khối test `shapeStatusDistribution` (đã chuyển đi); giữ `shapeRoleCounts`,
    `summarizeSalaries`.
- Lớp truy vấn Prisma (`recruiter-stats`, `candidate-stats`) không unit-test (theo
  pattern repo) — verify `npx tsc --noEmit` + `npm run lint` + `npm test`.

## Ngoài phạm vi (YAGNI)

- Trang `/insights` riêng; biểu đồ theo thời gian; phân tích per-job chi tiết.
- Realtime (phase sau).
- Thư viện chart.

## Ghi chú kỹ thuật

- Prisma pinned v6; `NODE_OPTIONS=--dns-result-order=ipv4first` cho lệnh DB.
- Hàm thuần (`computeConversion`, `formatActivity`, `shapeStatusDistribution`) tách
  file để test không cần Prisma/Next runtime — theo kiểu DI của repo.
- Tái dùng `STATUS_LABELS`/`APPLICATION_STATUSES` từ `lib/applications/status.ts`
  (DRY) — không khai lại nhãn trạng thái.
