# Thiết kế: JD có cấu trúc (Gói D1)

**Ngày:** 2026-07-31
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)

## 1. Bối cảnh & Mục tiêu

Tin tuyển dụng hiện chỉ có `title`, `company`, và một ô `rawText`. Không lọc được theo tiêu chí, hiển thị nghèo nàn, AI chỉ thấy văn bản thô. Gói D1 thêm **các trường có cấu trúc** vào tin để: form nhập rõ ràng, hiển thị đẹp (badge), **lọc theo trường**, và **AI dùng thêm** dữ liệu này để chấm chính xác hơn.

Gói D chia hai phần độc lập; D1 (JD có cấu trúc) làm trước. D2 (hồ sơ công ty) để vòng sau, spec riêng.

## 2. Trường mới trên `JobDescription`

Tất cả tuỳ chọn → tin cũ không cần sửa vẫn hợp lệ.

```prisma
enum EmploymentType { FULL_TIME PART_TIME CONTRACT INTERNSHIP }
enum ExperienceLevel { INTERN JUNIOR MID SENIOR LEAD }

model JobDescription {
  // ...trường hiện có...
  location        String?
  employmentType  EmploymentType?
  experienceLevel ExperienceLevel?
  skills          String           @default("")
}
```
`rawText` giữ nguyên = mô tả chi tiết. Không thêm lương (ngoài phạm vi đã chốt).

## 3. Module hằng + helper `lib/jobs/job-fields.ts`

Thuần, không phụ thuộc DB/framework.

- `EMPLOYMENT_TYPES: readonly EmploymentType[]` và `EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string>`:
  - FULL_TIME "Toàn thời gian", PART_TIME "Bán thời gian", CONTRACT "Hợp đồng", INTERNSHIP "Thực tập".
- `EXPERIENCE_LEVELS: readonly ExperienceLevel[]` và `EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string>`:
  - INTERN "Thực tập sinh", JUNIOR "Junior", MID "Middle", SENIOR "Senior", LEAD "Lead".
  - Kiểu `EmploymentType`/`ExperienceLevel` khai báo tại đây dạng union (khớp enum Prisma), tránh phụ thuộc `@prisma/client` trong module thuần.
- `composeJdText(job: JobTextInput): string` — ghép các trường cấu trúc có mặt + `rawText` thành một đoạn để đưa vào AI. `JobTextInput = { location?, employmentType?, experienceLevel?, skills?, rawText }`.
  - Định dạng: một dòng "meta" gồm các nhãn có mặt (VD `Địa điểm: Hà Nội | Loại hình: Toàn thời gian | Cấp bậc: Senior | Kỹ năng: React, Node`), xuống dòng, rồi `rawText`. Trường trống/null bị bỏ qua. Nếu không có trường cấu trúc nào → trả nguyên `rawText`.

## 4. Form đăng tin + validate

### 4.1 Zod `lib/jobs/schema.ts`
- `jobSchema` validate input tạo tin:
  - `title` bắt buộc (min 1), `rawText` bắt buộc (min 1).
  - `company`, `location`, `skills` chuỗi (mặc định rỗng).
  - `employmentType`: một trong `EMPLOYMENT_TYPES` hoặc rỗng → `null`.
  - `experienceLevel`: một trong `EXPERIENCE_LEVELS` hoặc rỗng → `null`.
- Kiểu `JobInput = z.infer<typeof jobSchema>`.
- **TDD.**

### 4.2 Form `/jobs/new`
- Thêm ô: địa điểm (text), loại hình (`<select>` từ `EMPLOYMENT_TYPES` + nhãn), cấp bậc (`<select>`), kỹ năng (text, gợi ý phẩy). `rawText` giữ nguyên.

### 4.3 Action `createJobDescription`
- Đọc các trường mới từ `FormData`, validate bằng `jobSchema`; sai → quay lại form (giữ hành vi redirect hiện có, hoặc trả lỗi mềm). Lưu các trường mới (`employmentType`/`experienceLevel` rỗng → `null`).
- **Ngoài phạm vi:** sửa tin có sẵn (YAGNI); tin cũ giữ nguyên, chỉ tin mới có trường cấu trúc.

## 5. Hiển thị

- Component `components/JobMeta.tsx` (server/pure) nhận `{ location, employmentType, experienceLevel, skills }` → hiển thị hàng badge (địa điểm, loại hình, cấp bậc, và các kỹ năng tách phẩy). Trường trống → ẩn badge tương ứng; không có gì → không render.
- Dùng ở **trang chi tiết tin** (`/jobs/[id]`) và **thẻ tin** trên `/jobs`.

## 6. Lọc trên `/jobs`

- Mở rộng form tìm kiếm (gói C) thêm hai dropdown: **loại hình** (`?type=`) và **cấp bậc** (`?level=`); giữ ô từ khóa `?q`.
- Truy vấn: `isPublic=true`; nếu `type` hợp lệ → lọc `employmentType`; nếu `level` hợp lệ → lọc `experienceLevel`; `q` khớp `title`/`company`/`rawText`/`location`/`skills` (thêm `location`, `skills` vào OR hiện có). Giá trị filter không hợp lệ bị bỏ qua.
- Dropdown hiển thị lựa chọn hiện tại (giữ `defaultValue`).

## 7. AI dùng dữ liệu cấu trúc

Thay mọi chỗ đưa văn bản JD vào AI bằng `composeJdText(job)`:
- Đánh giá CV theo JD: trang `/jobs/[id]` truyền `composeJdText(job)` cho `EvaluateFromJob` thay vì `job.rawText`.
- `lib/applications/actions.ts`: `previewMatch` và `submitApplication` dùng `composeJdText(job)` (bổ sung select các trường cấu trúc của job).
- `lib/applications/screening-actions.ts`: `jdText = composeJdText(job)`.
- `lib/jobs/recommend-actions.ts`: mỗi job dựng `composeJdText` (bổ sung select trường cấu trúc; `RecommendationJobInput.rawText` nhận text đã ghép).

Không đổi prompt/schema AI; chỉ đổi nội dung text đầu vào.

## 8. Xử lý lỗi & phân quyền

- Chỉ RECRUITER đăng tin (giữ nguyên). `jobSchema` chặn dữ liệu thiếu/không hợp lệ.
- Filter/enum không hợp lệ từ query param → bỏ qua (không lỗi).
- Trường cấu trúc null/trống hiển thị an toàn (ẩn badge).

## 9. Kiểm thử

- **Unit (Vitest, TDD):**
  - `job-fields`: đủ nhãn cho mọi enum; `composeJdText` ghép đúng (có/không trường cấu trúc; bỏ trường trống; luôn kèm rawText).
  - `jobSchema`: chấp nhận input hợp lệ; từ chối thiếu title/rawText; `employmentType`/`experienceLevel` rỗng → null; giá trị enum sai → lỗi.
- **Glue/UI/filter/AI-wiring:** không unit-test (chuẩn dự án); an toàn bằng `npx tsc --noEmit` + `npm test` xanh.

## 10. Cấu trúc thư mục (dự kiến)

```
/prisma
  schema.prisma                 thêm 2 enum + 4 trường vào JobDescription
/lib/jobs
  job-fields.ts                 enum values + nhãn + composeJdText
  schema.ts                     Zod jobSchema
  actions.ts                    createJobDescription dùng jobSchema + trường mới (sửa)
  __tests__/job-fields.test.ts, __tests__/schema.test.ts
/components
  JobMeta.tsx                   badge các trường cấu trúc
/app/jobs
  new/page.tsx                  form thêm ô mới (sửa)
  page.tsx                      filter type/level + q khớp location/skills + JobMeta trên thẻ (sửa)
  [id]/page.tsx                 hiển thị JobMeta + composeJdText cho AI (sửa)
/lib/applications
  actions.ts, screening-actions.ts   dùng composeJdText (sửa)
/lib/jobs
  recommend-actions.ts          dùng composeJdText (sửa)
```

## 11. Thứ tự xây dựng (dự kiến)

1. Prisma: 2 enum + 4 trường + `db push`.
2. `job-fields.ts` (nhãn + `composeJdText`) — TDD.
3. `schema.ts` (`jobSchema`) — TDD.
4. Form `/jobs/new` + `createJobDescription` dùng schema + trường mới.
5. `JobMeta` + hiển thị ở trang chi tiết tin và thẻ `/jobs`.
6. Lọc type/level + q khớp location/skills trên `/jobs`.
7. AI dùng `composeJdText` ở các call-site (đánh giá/sàng lọc/gợi ý).
