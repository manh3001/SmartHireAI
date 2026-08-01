# Phase 13 — Lương cho JD (Salary)

Ngày: 2026-08-01

Feature đầu tiên trong nhóm 3 tính năng mới. Thứ tự đã chốt: **Lương → Dashboard →
Realtime**, mỗi cái một spec → plan → build riêng.

## Mục tiêu

Thêm thông tin lương cho tin tuyển dụng (`JobDescription`): nhập khi đăng/sửa JD,
hiển thị badge, lọc theo mức lương ở trang việc làm, và đưa lương vào context AI
gợi ý/đánh giá. Dữ liệu số cũng làm nền cho thống kê lương ở Dashboard (phase sau).

Quyết định phạm vi (đã chốt với người dùng):
- Mô hình: **khoảng min–max + cờ "Thỏa thuận"**.
- Đơn vị: **VND/tháng cố định** — không chọn currency/period.
- Dùng ở: nhập+hiển thị, lọc theo lương, AI gợi ý, chuẩn bị số liệu cho Dashboard.

## 1. Mô hình dữ liệu (Prisma)

Thêm 3 trường vào model `JobDescription`:

```prisma
salaryMin        Int?     // VND/tháng đầy đủ, vd 15000000
salaryMax        Int?     // Int max ≈ 2.1 tỷ → thừa cho lương tháng
salaryNegotiable Boolean  @default(false)
```

- Cả `salaryMin` và `salaryMax` đều **tùy chọn**, cho phép: đủ khoảng (15–25tr),
  chỉ sàn ("Từ 15tr"), chỉ trần ("Tới 25tr").
- Lưu **đầy đủ VND** (người dùng nhập theo triệu, hệ thống nhân 1.000.000).
- Áp dụng bằng `npm run db:push` (dự án không dùng thư mục migrations).

Ưu tiên hiển thị: có số → hiện khoảng; không số nhưng `salaryNegotiable` → "Thỏa
thuận"; không gì cả → ẩn.

## 2. Module thuần `lib/jobs/salary.ts` (có test)

- `formatSalary(min, max, negotiable): string | null`
  - `15000000, 25000000, _`  → `"15 – 25 triệu"`
  - `15000000, null, _`       → `"Từ 15 triệu"`
  - `null, 25000000, _`       → `"Tới 25 triệu"`
  - `null, null, true`        → `"Thỏa thuận"`
  - `null, null, false`       → `null`
  - Số triệu hiển thị bỏ `.0` thừa (vd 15 chứ không phải 15.0); hỗ trợ số lẻ
    (vd 12.5 triệu) nếu VND không tròn triệu.
- `parseSalaryInput(raw): number | null`
  - Nhận chuỗi số **triệu** người dùng nhập (vd `"20"`), trả VND (`20000000`).
  - Rỗng/không hợp lệ → `null`.
- Zod trong `lib/jobs/schema.ts`:
  - `salaryMin`, `salaryMax`: số không âm, tùy chọn (nullable).
  - Nếu có **cả** min và max thì bắt buộc `min <= max` (dùng `.refine`).
  - `salaryNegotiable`: boolean từ checkbox.

## 3. Nhập & hiển thị

- **Form đăng/sửa JD** (`app/jobs/new/page.tsx`; kiểm tra thêm nơi sửa JD nếu có):
  hai ô số "Lương từ … đến … (triệu VND)" + checkbox "Thỏa thuận".
  `createJobDescription` (và action cập nhật nếu có) đọc thêm 3 trường, parse qua
  `parseSalaryInput`, ghi vào Prisma.
- **Badge lương** trong `components/JobMeta.tsx`: thêm chip màu amber
  `💰 15 – 25 triệu` dựng từ `formatSalary`. Vì `JobMeta` dùng chung ở list +
  detail nên badge tự lan ra mọi nơi.
- Cần truyền thêm props `salaryMin/salaryMax/salaryNegotiable` vào `JobMeta`, và
  bổ sung 3 trường này vào các `select` Prisma đang lấy JD: `/jobs`,
  `/jobs/[id]`, `/jobs/saved`, `/jobs/recommendations`, và bất kỳ nơi nào render
  `JobMeta`.

## 4. Bộ lọc theo lương (`/jobs`)

- Thêm `select` "Mức lương từ" với các mốc: 10 / 15 / 20 / 25 / 30 / 40 / 50
  triệu; query param `salary` (giá trị VND hoặc triệu — chọn triệu cho gọn URL).
- Ngữ nghĩa: hiện job có `salaryMax >= X`; nếu `salaryMax` null thì xét
  `salaryMin >= X`.
- Job "Thỏa thuận" thuần (không có số) **bị loại khi đang lọc theo lương** — không
  so sánh được. (Đã xác nhận với người dùng là hành vi chấp nhận được.)
- Tách logic dựng where-clause lương thành helper nhỏ thuần để test không qua
  Prisma (vd `salaryWhere(minMillions)` trong `lib/jobs/salary.ts` hoặc file cạnh).

## 5. AI gợi ý

- Thêm dòng lương vào `composeJdText()` trong `lib/jobs/job-fields.ts`:
  `"Mức lương: 15 – 25 triệu VND/tháng"` (dùng `formatSalary`). Tự động đi vào
  context đánh giá & gợi ý — không sửa prompt.
- `JobTextInput` cần thêm `salaryMin/salaryMax/salaryNegotiable`.

## 6. Test (TDD, theo pattern repo)

- `lib/jobs/__tests__/salary.test.ts`:
  - `formatSalary`: đủ khoảng / chỉ sàn / chỉ trần / thỏa thuận / rỗng / số lẻ.
  - `parseSalaryInput`: "20"→20000000, rỗng→null, rác→null, số âm→null.
  - `salaryWhere`: dựng đúng điều kiện min/max.
- `lib/jobs/__tests__/schema.test.ts` (bổ sung):
  - min > max bị chặn; số âm bị chặn; chỉ một trong hai vẫn hợp lệ.
- `lib/jobs/__tests__/job-fields.test.ts` (bổ sung):
  - `composeJdText` chèn đúng dòng lương khi có; bỏ qua khi không.

## Ngoài phạm vi (YAGNI)

- Chọn currency/period (USD, theo năm/giờ).
- Chuẩn hóa/quy đổi tiền tệ.
- Trang thống kê lương (thuộc phase Dashboard sau).
- Realtime bất kỳ.

## Ghi chú kỹ thuật

- Prisma pinned v6, không nâng v7. Dùng `NODE_OPTIONS=--dns-result-order=ipv4first`
  (đã có trong script) khi `db:push` để tránh lỗi P1001 (Neon IPv4).
