# Gói C — UI States Production (Loading / Error / Empty)

- **Ngày**: 2026-08-28
- **Trạng thái**: Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh**: Vòng 3 của lộ trình "nâng cấp bám sát web tuyển dụng thật". Gói A (bảo mật) + Gói B (tìm kiếm & dữ liệu) đã merge. Gói C lấp lỗ hổng lớn nhất còn lại: 0 loading state, 0 error state, empty state thiếu trên hầu hết trang.

## 1. Mục tiêu & vấn đề hiện tại

**Mục tiêu**: mọi trang user-facing đều có loading skeleton (đúng shape), error boundary inline với retry, và empty state có icon + CTA — đạt mức "production-ready" như ITviec/Glints.

**Hiện trạng**:
- Zero `loading.tsx`, `error.tsx`, `not-found.tsx` trên toàn bộ app.
- Empty state chỉ tồn tại duy nhất ở `/jobs` (text thuần, không có CTA).
- Loading state duy nhất: nút "Đang tải..." trong `JobsBrowser` (không có skeleton).
- Khi DB chậm hoặc lỗi: trang trắng hoặc crash không kiểm soát.

## 2. Phạm vi

**Bao gồm**: tất cả route user-facing (jobs, applications, notifications, dashboard, CV, messages, companies).
**Loại trừ**: `/admin/*`, trang auth (`/login`, `/register`) — form ít cần skeleton; A11y sâu (ARIA focus trap) để Gói F; animation transition loading→content; i18n error messages; Sonner toast cho lỗi.

## 3. Kiến trúc — Hybrid approach

```
Task 1: Shared components (Skeleton base, EmptyState, InlineError, 5 skeleton variants)
Task 2: Route states — Nhóm A: Jobs (5 routes)
Task 3: Route states — Nhóm B: Core user (applications, notifications, dashboard)
Task 4: Route states — Nhóm C: CV + Messaging
Task 5: Route states — Nhóm D: Companies + Recruiter
Task 6: Global not-found.tsx + full verification
```

**Next.js 16 conventions**:
- `loading.tsx` = Suspense boundary tự động bao toàn page — render skeleton ngay khi navigate.
- `error.tsx` = Error boundary (`"use client"`, props `{ error, reset }`) — `reset()` gọi `router.refresh()`, KHÔNG redirect.
- `not-found.tsx` = render khi page gọi `notFound()` từ `next/navigation`.
- Empty state: inline trong page (page đã có data, không phải route-level file).

## 4. Shared Components

### 4.1 `components/ui/skeleton.tsx`
```tsx
// Base pulse block — caller điều chỉnh size qua className
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
```
Token: `bg-muted` (đã có), `animate-pulse` (Tailwind built-in), `rounded-md` / `rounded-full` khớp element thật.

### 4.2 `components/ui/empty-state.tsx`
```tsx
<EmptyState
  icon={<Briefcase className="h-10 w-10 text-muted-foreground" />}
  title="Chưa có đơn ứng tuyển nào"
  description="Hãy tìm việc và nộp đơn đầu tiên của bạn."
  action={<Button asChild><Link href="/jobs">Tìm việc ngay →</Link></Button>}
/>
```
Layout: centered `py-16`, icon → tiêu đề → mô tả → action slot (optional). Props: `icon`, `title`, `description?`, `action?`.

### 4.3 `components/ui/inline-error.tsx`
```tsx
<InlineError message="Không thể tải dữ liệu." onRetry={reset} backHref="/jobs" />
```
Layout: icon ⚠️ + message + nút "Thử lại" (`onClick={onRetry}`) + link "← Quay lại" (`backHref`). Props: `message`, `onRetry?`, `backHref?`. Không redirect — người dùng ở lại context.

### 4.4 Skeleton variants (5 loại — khớp shape component thật)

**`JobCardSkeleton`** (`components/jobs/JobCardSkeleton.tsx`):
- Avatar tròn 40px + block title (w-2/3) + block company (w-1/2) + 2 badge nhỏ
- Khớp layout `JobCard`: `rounded-2xl border bg-card p-4`

**`ApplicationCardSkeleton`** (`components/applications/ApplicationCardSkeleton.tsx`):
- Logo 40px + title block + status badge skeleton + date block

**`NotificationRowSkeleton`** (`components/notifications/NotificationRowSkeleton.tsx`):
- Dot 8px + 2 dòng text (w-3/4 + w-1/2)

**`CompanyCardSkeleton`** (`components/companies/CompanyCardSkeleton.tsx`):
- Logo 48px + name block + location block

**`StatCardSkeleton`** (`components/dashboard/StatCardSkeleton.tsx`):
- Số lớn (h-8 w-16) + label block (h-4 w-24)

## 5. Route States per nhóm

### Nhóm A — Jobs

| Route | `loading.tsx` | `error.tsx` | `not-found.tsx` | Empty state (inline) |
|---|---|---|---|---|
| `/jobs` | `JobCardSkeleton × 5` + filter sidebar pulse | `InlineError` backHref="/" | — | Nâng cấp: `EmptyState` icon Search + "Xoá bộ lọc" (reset URL) |
| `/jobs/[id]` | Detail skeleton: title block + meta row + rawText lines | `InlineError` backHref="/jobs" | "Tin không tồn tại" + link /jobs | — |
| `/jobs/saved` | `JobCardSkeleton × 3` | `InlineError` backHref="/jobs" | — | "Chưa lưu việc làm nào" + "Tìm việc ngay →" |
| `/jobs/alerts` | Pulse rows × 3 | `InlineError` backHref="/dashboard" | — | "Chưa có alert nào" + "Tạo alert →" |
| `/jobs/recommendations` | `JobCardSkeleton × 3` | `InlineError` backHref="/dashboard" | — | "Chưa có gợi ý — hãy tạo CV trước" + "Tạo CV →" |

### Nhóm B — Core user

| Route | `loading.tsx` | `error.tsx` | Empty state (inline) |
|---|---|---|---|
| `/applications` | `ApplicationCardSkeleton × 3` | `InlineError` backHref="/jobs" | "Chưa có đơn nào" + "Tìm việc ngay →" |
| `/notifications` | `NotificationRowSkeleton × 5` | `InlineError` backHref="/dashboard" | "Không có thông báo mới" (không cần CTA) |
| `/dashboard` | `StatCardSkeleton × 3` + list pulse rows | `InlineError` backHref="/" | — (dashboard luôn có data) |

### Nhóm C — CV + Messaging

| Route | `loading.tsx` | `error.tsx` | `not-found.tsx` | Empty state (inline) |
|---|---|---|---|---|
| `/cv/[id]` | CV block skeleton (header + 3 section blocks) | `InlineError` backHref="/dashboard" | "CV không tồn tại" + link /dashboard | — |
| `/cv/[id]/chat` | Message bubble skeleton (3 bubbles xen kẽ) | `InlineError` backHref="/dashboard" | — | "Hỏi AI về CV của bạn" |
| `/messages/[applicationId]` | Message bubble skeleton | `InlineError` backHref="/applications" | — | "Chưa có tin nhắn nào" |

### Nhóm D — Companies + Recruiter

| Route | `loading.tsx` | `error.tsx` | `not-found.tsx` | Empty state (inline) |
|---|---|---|---|---|
| `/companies` | `CompanyCardSkeleton × 4` | `InlineError` backHref="/" | — | "Chưa có công ty nào" |
| `/companies/[id]` | Company header skeleton + `JobCardSkeleton × 3` | `InlineError` backHref="/companies" | "Công ty không tồn tại" + link /companies | — |
| `/jobs/[id]/applicants` | `ApplicationCardSkeleton × 3` | `InlineError` backHref="/dashboard" | — | "Chưa có ứng viên nào" |
| `/jobs/[id]/screening` | Pulse rows × 3 | `InlineError` backHref="/jobs/[id]/applicants" | — | "Chưa có kết quả sàng lọc" |

### Global
- `app/not-found.tsx`: icon 🔍, tiêu đề "Trang không tồn tại", mô tả ngắn, link về `/`.

## 6. Kiểm thử

- **Không unit test** UI component (đúng phong cách repo).
- Mỗi task: `npx tsc --noEmit` + `npm run build` pass.
- Smoke thủ công: throttle network trong DevTools → xác nhận skeleton hiển thị; ngắt DB → xác nhận InlineError + retry hoạt động.

## 7. Số lượng file

- **8 component mới** (3 shared + 5 skeleton variants)
- **~40 route file mới** (loading + error + not-found theo từng route)
- **1 global not-found.tsx**
- **Sửa nhỏ**: empty state `/jobs` (text → `EmptyState`), empty state inline cho 8 trang còn lại

## 8. Definition of Done

- Mọi route user-facing có `loading.tsx` skeleton đúng shape.
- Mọi route user-facing có `error.tsx` với InlineError + retry.
- Trang có ID động có `not-found.tsx`.
- Trang có thể rỗng có empty state với icon + tiêu đề + CTA (nếu phù hợp).
- `npm test` xanh (265 tests), `npm run build` pass, `npm run lint` không lỗi mới.

## 9. Ngoài phạm vi

- A11y sâu (focus trap, ARIA live region) → Gói F
- Transition animation loading→content → Gói C+
- Sonner toast cho lỗi network → Gói E/F
- i18n error messages → không trong roadmap
