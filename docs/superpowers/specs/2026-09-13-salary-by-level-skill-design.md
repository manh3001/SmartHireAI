# Mở rộng /salaries — lương theo cấp bậc & top kỹ năng — Design spec

**Ngày:** 2026-09-13
**Vòng:** Salary by level/skill — tiếp nối [[salary-insights]]

## Bối cảnh

`/salaries` đã có bảng "lương theo ngành" (`computeSalaryInsights`, thuần). Backlog còn mở
rộng theo **cấp bậc** và **top kỹ năng** — như các báo cáo lương của site thật. Dữ liệu đã có
trên `JobDescription` (`experienceLevel`, `skills`, `salaryMin/Max`). Không schema mới.

## Nguyên tắc thiết kế

- Logic thuần trong `lib/salary/insights.ts` (tái dùng `median`; rút gọn phần gom min/max theo
  bucket thành helper nội bộ dùng chung). `insights.ts` PHẢI giữ thuần (không prisma/next).
- Cache một lần cho cả trang (giữ `unstable_cache` 1h + tag `jobs`).
- Tiếng Việt; Tailwind tokens; prisma default import `@/lib/db/prisma`.

## Helper thuần — `lib/salary/insights.ts`

- **Refactor nội bộ (bảo toàn hành vi):** tách helper gom nhóm dùng chung, ví dụ
  `newBucket()`/`addRow(bucket, row)` (tích luỹ `mins`, `maxs`, `count`) và `medianMin`/`medianMax`
  qua `median()`. `computeSalaryInsights` (theo ngành) giữ nguyên chữ ký + kết quả — chỉ dùng lại
  helper bên trong. Test cũ phải vẫn xanh.
- **Kiểu hiển thị chung:** `export type SalaryBarRow = { label: string; sampleSize: number; medianMin: number | null; medianMax: number | null }`.
  Các hàm dưới trả về `SalaryBarRow[]` (để UI dùng chung một component).
- `export function computeSalaryByLevel(rows: { experienceLevel: string | null; salaryMin: number | null; salaryMax: number | null }[]): SalaryBarRow[]`
  - Chỉ tính tin có `salaryMin != null` hoặc `salaryMax != null`.
  - Gom theo `experienceLevel` nếu là `ExperienceLevel` hợp lệ; bỏ qua null/không hợp lệ (cấp bậc là tập cố định, không có bucket "khác").
  - `label` từ `EXPERIENCE_LEVEL_LABELS`. **Sắp theo thứ tự cấp bậc** `EXPERIENCE_LEVELS` (INTERN→JUNIOR→MID→SENIOR→LEAD), bỏ cấp có `sampleSize === 0`.
- `export function computeSalaryBySkill(rows: { skills: string; salaryMin: number | null; salaryMax: number | null }[], limit = 8): SalaryBarRow[]`
  - Chỉ tính tin có min hoặc max. Mỗi tin: tách `skills` theo dấu phẩy, trim, bỏ rỗng, **dedupe trong tin**, gộp không phân biệt hoa thường (giữ dạng hiển thị lần đầu làm `label`).
  - Mỗi kỹ năng tích luỹ min/max của tin. **Chỉ giữ kỹ năng có `sampleSize >= MIN_SKILL_SAMPLE` (=3)**.
  - Sắp theo `medianMax` giảm dần (null cuối), tie-break theo `label`; lấy top `limit`.

## Nguồn dữ liệu (cache) — `lib/salary/insights-data.ts`

- Đổi truy vấn: `select { category, experienceLevel, skills, salaryMin, salaryMax }` cho tin `isPublic`.
- Hàm cache trả về `{ byCategory: CategorySalary[]; byLevel: SalaryBarRow[]; bySkill: SalaryBarRow[] }`
  (giữ `unstable_cache(..., ["salary-insights"], { tags: [CACHE_TAGS.jobs], revalidate: 3600 })`).
  Đổi tên export thành `getCachedSalaryData()` (cập nhật nơi gọi ở page).

## UI — component dùng chung + trang

- `components/salary/SalaryTable.tsx` (thuần): nhận `rows: SalaryBarRow[]` → render mỗi hàng
  {label · khoảng lương `formatSalary(medianMin, medianMax, false) ?? "—"` · bar scale theo max
  `medianMax` của chính bảng · `sampleSize` tin, nhãn "· ít dữ liệu" khi `< 5`}. Rỗng → không render (trang tự lo EmptyState).
- `app/salaries/page.tsx`: gọi `getCachedSalaryData()`; render 3 mục có tiêu đề:
  **Theo ngành** (dữ liệu `byCategory` map sang `SalaryBarRow`), **Theo cấp bậc** (`byLevel`),
  **Top kỹ năng lương cao** (`bySkill`). Nếu cả ba rỗng → EmptyState chung "Chưa đủ dữ liệu lương";
  mỗi mục có dữ liệu mới hiện tiêu đề + bảng.

## Kiểm thử

- Unit `computeSalaryByLevel`: gom đúng cấp, thứ tự INTERN→LEAD, bỏ tin cấp bậc null, chỉ tính tin có min/max, sampleSize.
- Unit `computeSalaryBySkill`: tách + dedupe trong tin, gộp không phân biệt hoa thường, ngưỡng ≥3 mẫu loại kỹ năng thưa, top `limit`, sắp theo `medianMax` giảm dần.
- `computeSalaryInsights` (cũ) giữ nguyên kết quả sau refactor.
- Giữ toàn bộ test hiện có xanh (412 baseline).

## Dùng lại

`median` (`lib/salary/insights.ts`), `formatSalary` (`lib/jobs/salary.ts`),
`EXPERIENCE_LEVELS`/`EXPERIENCE_LEVEL_LABELS`/`ExperienceLevel` (`lib/jobs/job-fields.ts`),
`CACHE_TAGS` (`lib/cache/tags.ts`), mẫu `unstable_cache`.

## Ngoài phạm vi

Lọc chéo (ngành × cấp bậc), biểu đồ nâng cao, blog, đếm lượt xem tin, match% trên /jobs (đã bỏ).
