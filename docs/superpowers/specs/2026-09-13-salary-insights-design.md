# Insight lương theo ngành (`/salaries`) — Design spec

**Ngày:** 2026-09-13
**Vòng:** Insight lương — tiếp nối [[candidate-experience]] / [[home-trust-discovery]]

## Bối cảnh

Các web tuyển dụng lớn (ITviec "IT Salary Report", TopCV "Thị trường việc làm") đều có
trang thống kê lương — vừa hữu ích cho ứng viên, vừa mạnh về SEO. App đã lưu `salaryMin`,
`salaryMax`, `salaryNegotiable`, `category` trên mỗi tin (`JobDescription`), nhưng chưa tổng
hợp ở đâu. Vòng này thêm trang công khai `/salaries` thống kê khoảng lương phổ biến theo ngành.

## Nguyên tắc thiết kế

- Logic tổng hợp thuần (median, gom nhóm) tách khỏi UI/IO để unit-test bằng vitest.
- Trang **công khai** (không đăng nhập, như `/jobs/[id]`) để tốt cho SEO.
- Không schema mới; chỉ đọc dữ liệu tin `isPublic`.
- Tiếng Việt; Tailwind tokens; prisma default import `@/lib/db/prisma`.

## Thành phần

### 1. Helper thuần — `lib/salary/insights.ts`

- `export function median(nums: number[]): number | null`
  - Mảng rỗng → `null`. Sắp xếp tăng dần; lẻ → phần tử giữa; chẵn → trung bình 2 phần tử giữa.
- `export type CategorySalary = { category: JobCategory; label: string; sampleSize: number; medianMin: number | null; medianMax: number | null }`
- `export function computeSalaryInsights(rows: { category: string | null; salaryMin: number | null; salaryMax: number | null }[]): CategorySalary[]`
  - Chỉ tính tin có `salaryMin != null` **hoặc** `salaryMax != null` (bỏ tin chỉ "thỏa thuận").
  - Gom theo ngành: `normalizeCategory(category)` → nếu `null` (không nhận dạng) gom vào `"other"`.
  - `sampleSize` = số tin (có min hoặc max) thuộc ngành; `medianMin` = median các `salaryMin` không null; `medianMax` = median các `salaryMax` không null.
  - `label` từ `JOB_CATEGORY_LABELS`.
  - Bỏ ngành có `sampleSize === 0`; sắp xếp theo `medianMax` giảm dần (null cuối), tie-break theo `label`.

### 2. Trang — `app/salaries/page.tsx` (server component, công khai)

- Không `auth()`/redirect (công khai). `export const dynamic = "force-dynamic"`.
- Truy vấn: `prisma.jobDescription.findMany({ where: { isPublic: true }, select: { category, salaryMin, salaryMax } })` → `computeSalaryInsights`.
- Render: `Navbar` + tiêu đề + mô tả ngắn + bảng theo ngành + `Footer`.
  - Mỗi hàng: tên ngành · **khoảng lương phổ biến** qua `formatSalary(medianMin, medianMax, false)` (nếu cả hai null → "—") · thanh bar (chiều dài scale theo `medianMax` lớn nhất) · `sampleSize` tin, gắn nhãn "ít dữ liệu" khi `sampleSize < 5`.
  - Nếu không có ngành nào (data rỗng) → `EmptyState` ("Chưa đủ dữ liệu lương").
- `generateMetadata`: title "Lương theo ngành | SmartHire", description ngắn, canonical `/salaries` (dựa `metadataBase` sẵn có ở layout).

### 3. SEO & điều hướng

- `app/sitemap.ts`: thêm route tĩnh `/salaries` (priority ~0.6, changeFrequency weekly).
- `components/Footer.tsx`: thêm link "Lương theo ngành" (`/salaries`) trong cột "Ứng viên".

## Dùng lại

`formatSalary` (`lib/jobs/salary.ts`); `JOB_CATEGORIES`, `JOB_CATEGORY_LABELS`, `normalizeCategory`,
`JobCategory` (`lib/jobs/job-categories.ts`); `absoluteUrl` (`lib/seo/url.ts`) nếu cần cho canonical.

## Luồng dữ liệu

Trang server đọc tin `isPublic` (chỉ 3 cột) → helper thuần tổng hợp → render. Không bảng mới,
không migration, không gọi AI.

## Kiểm thử

- Unit `median`: rỗng→null, 1 phần tử, lẻ (giữa), chẵn (trung bình 2 giữa).
- Unit `computeSalaryInsights`: gom nhóm đúng ngành; tin chỉ-min hoặc chỉ-max; unknown/null category → "other"; loại tin không có min lẫn max; `sampleSize` đúng; thứ tự sắp theo `medianMax` giảm dần; ngành sampleSize 0 bị loại.
- Giữ toàn bộ test hiện có xanh (399 baseline).

## Ngoài phạm vi

Chia theo cấp bậc kinh nghiệm/địa điểm, insight theo kỹ năng, biểu đồ nâng cao, match% trên `/jobs`, blog.
