# Trải nghiệm hồ sơ & ứng tuyển của ứng viên (Gói B) — Design spec

**Ngày:** 2026-09-12
**Vòng:** Gói B (trải nghiệm ứng viên) — tiếp nối [[home-trust-discovery]]

## Bối cảnh

Sau vòng trang chủ (Gói A), backlog khảo sát chỉ ra nhóm "trải nghiệm ứng viên" là bước
tiếp theo giữ chân người dùng. Khảo sát code cho thấy phần lớn **dữ liệu đã có sẵn**:
`Application.status`, `ApplicationEvent` (chuyển trạng thái + thời gian), và
`Application.evaluation.overallScore` (match %). Trang "Ứng tuyển của tôi" đã hiện match %
và một dòng flow trạng thái **thô** (chỉ text `Đã nộp → Đang sàng lọc → …`, không mốc thời gian).

Vòng này nâng 3 mảng: (1) timeline ứng tuyển trực quan, (2) % hoàn thiện hồ sơ,
(3) trạng thái "Đang tìm việc" (ứng viên bật + recruiter thấy/lọc).

## Nguyên tắc thiết kế

- Logic thuần (dựng timeline, tính %, lọc open) tách khỏi UI/IO để unit-test bằng vitest.
- Chỉ **1 thay đổi schema**: thêm cột `openToWork` vào `CandidateProfile` (áp bằng `prisma db push`, Prisma v6).
- Tiếng Việt; Tailwind tokens; prisma default import `@/lib/db/prisma`.
- Không đụng match % trên `/jobs` (đắt — hoãn).

## Mảng 1 — Timeline ứng tuyển trực quan

**Files:** `lib/applications/timeline.ts` (+ test), `components/applications/ApplicationTimeline.tsx`,
sửa `app/applications/page.tsx`.

- Helper thuần `buildApplicationTimeline(app)` với
  `app = { createdAt: Date; status: ApplicationStatus; events: { toStatus: ApplicationStatus; createdAt: Date }[] }`
  → `TimelineStep[]` với `{ status, label, date, isCurrent }`.
  - Bước đầu luôn là "Đã nộp" (SUBMITTED) tại `createdAt`, **trừ khi** đã có event `toStatus === SUBMITTED`
    (tránh trùng); các event nối tiếp theo thứ tự thời gian.
  - `isCurrent = true` cho bước cuối cùng có `status === app.status` (mốc hiện tại).
- Component `ApplicationTimeline` render stepper dọc: mỗi bước có nhãn tiếng Việt
  (`STATUS_LABELS`) + ngày giờ `toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })`,
  bước hiện tại nổi bật (màu primary), các bước trước mờ hơn.
- `app/applications/page.tsx`: thay khối `<div className="flex flex-wrap gap-1 text-xs …">…</div>`
  (dòng flow thô) bằng `<ApplicationTimeline app={a} />`. Query đã select `events {toStatus, createdAt}`
  và `createdAt`, `status` — bổ sung nếu thiếu.

## Mảng 2 — % hoàn thiện hồ sơ

**Files:** `lib/candidates/completeness.ts` (+ test), sửa `app/settings/profile/page.tsx`
(hiện meter) và dashboard ứng viên (`app/dashboard/page.tsx` / `components/dashboard/CandidateStats.tsx`)
(thẻ nhắc khi <100%).

- Helper thuần `profileCompleteness(input)` với
  `input = { hasCV: boolean; bio: string; github: string; linkedin: string; website: string }`
  → `{ percent: number; missing: { key: string; label: string; href: string }[] }`.
  - 5 mục đều trọng số: `hasCV` (href `/cv`), `bio`, `github`, `linkedin`, `website`
    (4 mục sau href `/settings/profile`). Rỗng = `!value.trim()` (và `!hasCV`).
  - `percent = Math.round(filled / 5 * 100)`; `missing` liệt kê mục chưa xong theo thứ tự trên.
- UI meter: thanh tiến độ + `percent%` + danh sách link tới mục còn thiếu (ẩn khi 100%).
  Đặt trên `app/settings/profile` (đầu trang) và một thẻ gọn trên dashboard ứng viên (chỉ khi `<100%`).
- `app/settings/profile/page.tsx`: bổ sung query `hasCV` (đếm CV của user) để truyền vào helper.

## Mảng 3 — Trạng thái "Đang tìm việc"

**Files:** `prisma/schema.prisma`, `lib/candidates/profile-logic.ts` (+ test),
`app/settings/profile/ProfileForm.tsx`, `app/settings/profile/page.tsx`,
`lib/candidates/search.ts` (+ test), `app/candidates/CandidateSearch.tsx`, `app/candidates/page.tsx`.

- **Schema:** thêm `openToWork Boolean @default(false)` vào `model CandidateProfile`. Áp bằng `prisma db push`.
- **Ứng viên bật:** thêm `openToWork: boolean` vào `ProfileInput` (trong `profile-logic.ts`) và cho
  `runUpsertProfile` truyền qua (mặc định `false` nếu thiếu). Toggle (checkbox/switch) trong `ProfileForm`
  ("Đang tìm việc — cho nhà tuyển dụng biết bạn sẵn sàng"). `settings/profile/page.tsx` select thêm
  `openToWork` và đưa vào `initial`.
- **Recruiter thấy + lọc:**
  - `searchCandidates`: select thêm `user: { select: { candidateProfile: { select: { openToWork: true } } } }`;
    `CandidateCard` và `RawRow` thêm `openToWork: boolean` (map: `r.user?.candidateProfile?.openToWork ?? false`).
  - Helper thuần `applyOpenFilter(rows, open)`: nếu `open === "1"` chỉ giữ `openToWork === true`; ngược lại giữ nguyên.
    Gọi sau `applyExpFilter`. `searchCandidates` nhận thêm `open?: string`.
  - `app/candidates/page.tsx`: đọc `open` từ `searchParams` truyền xuống.
  - `CandidateSearch`: checkbox "Chỉ người đang tìm việc" (param `open=1`); badge "Đang tìm việc" trên thẻ có `openToWork`.

## Luồng dữ liệu

Không bảng mới; 1 cột mới (`openToWork`). Các trang liên quan là server component đọc Prisma
rồi truyền xuống component/helper thuần. `prisma db push` chạy 1 lần khi triển khai schema.

## Kiểm thử

- Unit `buildApplicationTimeline`: chỉ có nộp (1 bước, isCurrent), nộp + vài event (thứ tự, current đúng),
  không nhân đôi khi event đầu là SUBMITTED, REJECTED/WITHDRAWN là bước cuối current.
- Unit `profileCompleteness`: 0% (rỗng hết), 100% (đủ 5), phần giữa + thứ tự `missing`, bỏ khoảng trắng.
- Unit `runUpsertProfile`: nhận `openToWork` và truyền vào upsert; thiếu → `false`.
- Unit `applyOpenFilter`: `open="1"` lọc đúng; khác/undefined giữ nguyên.
- Giữ toàn bộ test hiện có xanh (388 baseline).

## Ngoài phạm vi

Match % trên `/jobs` (đắt), tag "Hot", blog/cẩm nang, insight lương theo ngành.
