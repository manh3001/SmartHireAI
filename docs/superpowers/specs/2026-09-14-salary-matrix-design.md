# Ma trận lương ngành × cấp bậc (/salaries) — Design spec

**Ngày:** 2026-09-14
**Vòng:** Salary matrix — tiếp nối [[salary-by-level-skill]]

## Bối cảnh

`/salaries` đã có 3 bảng (ngành/cấp bậc/kỹ năng) từ cache một-lần (`getCachedSalaryData`,
`unstable_cache` tag `jobs`). Mục backlog cuối: xem tương quan **ngành × cấp bậc** trong một bảng
ma trận (cross-tab), như báo cáo lương thật. Chọn cách **cross-tab tĩnh** (cacheable), không lọc động.

## Nguyên tắc thiết kế

- Logic thuần `computeSalaryMatrix` tách khỏi I/O, unit-test; `insights.ts` giữ thuần.
- Không schema/DB; dùng lại query + cache sẵn có (query đã select category, experienceLevel, salaryMin, salaryMax).
- Tiếng Việt; Tailwind tokens.

## Helper thuần — `lib/salary/insights.ts`

- `export type SalaryMatrix = { levels: { level: ExperienceLevel; label: string }[]; rows: { label: string; cells: (number | null)[] }[] }`
- `export function computeSalaryMatrix(rows: { category: string | null; experienceLevel: string | null; salaryMin: number | null; salaryMax: number | null }[]): SalaryMatrix`
  - Giá trị đại diện mỗi tin: `rep = salaryMax ?? salaryMin`; bỏ tin có `rep == null`.
  - Chỉ tính tin có `experienceLevel` hợp lệ (`EXPERIENCE_LEVELS`); ngành = `normalizeCategory(category) ?? "other"`.
  - Gom theo (ngành, cấp); mỗi ô = `median(reps)` của ô đó (null nếu ô rỗng).
  - `levels` = `EXPERIENCE_LEVELS` theo thứ tự (INTERN→LEAD) với `EXPERIENCE_LEVEL_LABELS`.
  - `rows` = theo thứ tự `JOB_CATEGORIES` (+ `"other"` cuối nếu có), mỗi hàng `cells` căn theo thứ tự `levels`;
    **bỏ hàng mà tất cả ô đều null**. `label` từ `JOB_CATEGORY_LABELS`.

## Cache — `lib/salary/insights-data.ts`

- `SalaryData` thêm `matrix: SalaryMatrix`; `fetchSalaryDataRaw` tính `computeSalaryMatrix(rows)` (cùng `rows` đang dùng). Giữ nguyên key/tag/revalidate.

## UI — `components/salary/SalaryMatrix.tsx` + `app/salaries/page.tsx`

- `SalaryMatrix` (thuần): nhận `matrix: SalaryMatrix`; nếu `rows.length === 0` → `return null`.
  Bảng `<table>` trong `<div className="overflow-x-auto">`: hàng tiêu đề = "Ngành" + `levels[].label`;
  mỗi hàng dữ liệu = `label` + các ô. Ô: `cell == null ? "—" : \`${Math.round(cell / 1_000_000)} tr\``.
  Style Tailwind tokens (border/muted); ô hiện tại canh phải, tiêu đề canh trái.
- `app/salaries/page.tsx`: lấy `matrix` từ `getCachedSalaryData()`; thêm mục "Ma trận lương theo ngành × cấp bậc"
  (render `<SalaryMatrix matrix={matrix} />`) SAU 3 mục hiện có; component tự ẩn khi rỗng nên không cần guard thêm
  (nhưng khối `empty` chung của trang vẫn dựa trên byCategory/byLevel/bySkill như cũ).

## Kiểm thử

- Unit `computeSalaryMatrix`:
  - gom đúng ô (ngành×cấp), median dùng `salaryMax ?? salaryMin`;
  - tin cấp bậc null/không hợp lệ bị loại; tin không có min lẫn max bị loại;
  - `levels` đúng thứ tự INTERN→LEAD; hàng toàn null bị bỏ; ô rỗng = null;
  - ngành không nhận dạng → gom "Khác" (other).
- Giữ toàn bộ test hiện có xanh (434 baseline).

## Dùng lại

`median` (`lib/salary/insights.ts`), `EXPERIENCE_LEVELS`/`EXPERIENCE_LEVEL_LABELS`/`ExperienceLevel`
(`lib/jobs/job-fields.ts`), `JOB_CATEGORIES`/`JOB_CATEGORY_LABELS`/`normalizeCategory`/`JobCategory`
(`lib/jobs/job-categories.ts`), mẫu cache `getCachedSalaryData`.

## Ngoài phạm vi

Bộ lọc tương tác động; ô hiện khoảng min–max (chỉ 1 số median); ma trận theo kỹ năng; xuất CSV.
