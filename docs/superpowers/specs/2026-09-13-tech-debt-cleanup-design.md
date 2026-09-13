# Dọn nợ kỹ thuật (lint + cache /salaries) — Design spec

**Ngày:** 2026-09-13
**Vòng:** Dọn nhỏ — tiếp nối [[hot-jobs]]

## Bối cảnh

`npm run lint` còn 3 lỗi tồn đọng (không do các vòng gần đây) khiến CI/lint không sạch;
và trang `/salaries` mỗi request đều truy vấn + tổng hợp toàn bộ tin có lương. Vòng này dọn
gọn, không thêm tính năng.

## Hạng mục

### 1. Lint — `lib/dashboard/__tests__/recruiter-analytics.test.ts`

Hai chỗ dùng `as any` (dòng ~51 và ~88) cho `status`. Thay bằng `as ApplicationStatus`
(import type từ `@/lib/applications/status`). Bỏ lỗi `@typescript-eslint/no-explicit-any`,
không đổi hành vi test.

### 2. Lint — `components/ThemeToggle.tsx`

`React.useEffect(() => setMounted(true), [])` bị `react-hooks/set-state-in-effect`. Đây là
pattern "mounted gate" chuẩn của next-themes để tránh hydration mismatch — ngoại lệ chính đáng.
Thêm `// eslint-disable-next-line react-hooks/set-state-in-effect` kèm chú thích ngắn lý do,
ngay trên dòng đó. Không đổi hành vi.

### 3. Cache dữ liệu lương — `/salaries`

Trang render `Navbar` (gọi `auth()` → đọc cookie) nên Next buộc render động; ISR cấp trang
vô hiệu. Thay vào đó **cache riêng truy vấn lương**:
- Bọc phần đọc tin `isPublic` + `computeSalaryInsights` trong `unstable_cache` (theo mẫu
  `lib/notifications/poll.ts`) với `{ tags: [CACHE_TAGS.jobs], revalidate: 3600 }`.
- Đặt helper `getCachedSalaryInsights()` trong `lib/salary/insights.ts` (hoặc file kề) trả về
  `CategorySalary[]`; trang `app/salaries/page.tsx` gọi helper này thay cho truy vấn trực tiếp.
- Bỏ `export const dynamic = "force-dynamic"` khỏi `app/salaries/page.tsx`.

## Nguyên tắc & ràng buộc

- Không đổi hành vi người dùng (chỉ lint sạch + giảm tải DB cho /salaries).
- Prisma v6; prisma default import `@/lib/db/prisma`; Next 16 `unstable_cache` (đã dùng trong repo).
- `computeSalaryInsights`/`median` (thuần) giữ nguyên — chỉ thêm lớp cache quanh I/O.
- Baseline 412 tests phải giữ xanh; sau vòng này `npm run lint` KHÔNG còn 3 lỗi trên.

## Kiểm thử

- Không thêm unit test mới (thay đổi là lint + lớp cache I/O). Xác minh: `npm run lint` sạch
  (0 error), `npx tsc --noEmit` sạch, `npx vitest run` giữ 412, và `/salaries` vẫn hiển thị đúng.

## Ngoài phạm vi

Blog, insight lương theo cấp bậc/kỹ năng, đếm lượt xem tin. match% trên /jobs (đã bỏ hẳn).
