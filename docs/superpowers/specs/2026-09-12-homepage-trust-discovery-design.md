# Trang chủ tin cậy & khám phá — Design spec

**Ngày:** 2026-09-12
**Vòng:** Gói A (đại tu trang chủ bám sát web tuyển dụng thật)

## Bối cảnh

App đã có gần đủ tính năng của một sàn tuyển dụng hai chiều (CV builder, AI chấm CV,
tìm việc, ứng tuyển, sàng lọc, hồ sơ công ty, đánh giá, nhắn tin, thông báo, lương,
admin, dashboard, SEO…). Khảo sát TopCV / Glints / ITviec cho thấy điểm yếu nhất **không
phải tính năng mà là trang chủ**: thiếu tín hiệu tin cậy (tường logo), thiếu khám phá
nhanh (chip xu hướng + chọn địa điểm ngay hero), và không "khoe" các công cụ đã có.

Mục tiêu vòng này: nâng trang chủ về mức các site thật, **chỉ dùng dữ liệu sẵn có**,
không thêm bảng, chỉ thêm **1 query param** (`location`).

## Nguyên tắc thiết kế

- Mỗi hạng mục là một component/helper độc lập, có ranh giới rõ.
- Logic thuần (tổng hợp kỹ năng, tính badge, mệnh đề lọc) tách khỏi I/O để unit-test.
- Trang chủ vẫn công khai (không đăng nhập vẫn xem được); link sâu (`/jobs`, `/companies/[id]`)
  vốn sau đăng nhập → với khách chưa đăng nhập trỏ về `/login`, đồng nhất với `JobCard` hiện tại.

## Hạng mục

### 1. Hero search nâng cấp — `components/home/HomeSearch.tsx`

- Thêm dropdown **địa điểm** cạnh ô từ khoá. Danh sách tỉnh/thành **cố định** trong
  `lib/jobs/locations.ts` (ví dụ: Hà Nội, TP. Hồ Chí Minh, Đà Nẵng, Remote, Khác…).
- Dưới ô tìm: hàng **chip xu hướng** (top kỹ năng, mục 3) → mỗi chip là link `/jobs?q=<skill>`.
- Submit form (GET → `/jobs`) gửi `q` và `location` (bỏ qua nếu rỗng).
- Vẫn là component không trạng thái (form GET), giữ nguyên phong cách hiện tại.

### 2. Bộ lọc `location` — `lib/jobs/job-sql.ts` + `app/jobs/page.tsx`

- Thêm `location?: string` vào `JobFilterInput`.
- Trong `appendFilters`: nếu có `location`, thêm mệnh đề `location ILIKE '%'||$n||'%'`
  (không phân biệt hoa thường, an toàn tham số hoá qua `push`).
- `app/jobs/page.tsx`: đọc `location` từ `searchParams`, đưa vào `filterInput`, và truyền
  `defaults.location` xuống `JobFilters` để hiển thị lại (đồng thời thêm control địa điểm
  trong `JobFilters` để lọc/khớp với hero — tối thiểu là giữ giá trị khi phân trang).
- Đây là **điểm chạm backend duy nhất**; nhỏ và cô lập.

### 3. Chip xu hướng (top kỹ năng) — `lib/jobs/top-skills.ts`

- Hàm thuần `tallySkills(rows: { skills: string }[], limit = 8): string[]`:
  tách `skills` theo dấu phẩy, chuẩn hoá (trim, gộp trùng không phân biệt hoa thường,
  bỏ rỗng), đếm tần suất, trả top `limit` theo số lượng giảm dần (tie-break theo bảng chữ cái).
- Hàm mỏng `topSkills(limit)` đọc `skills` các tin `isPublic` rồi gọi `tallySkills`.
- Trang chủ gọi `topSkills(8)` trong `Promise.all` hiện có.

### 4. Tường "Nhà tuyển dụng tiêu biểu" — `components/home/TrustedCompanies.tsx`

- Server helper tái dùng `rankCompanies` (từ `lib/company/directory`): lấy các công ty
  đang tuyển tin public, xếp hạng, lấy top N (ví dụ 8–12).
- Render logo `CompanyProfile.logoUrl`; **không có logo → fallback `CompanyAvatar`** (gradient chữ cái).
  Section **luôn hiển thị** khi có ít nhất 1 công ty (quyết định: fallback avatar chữ cái).
- Mỗi ô link tới `/companies/[id]` (khách chưa đăng nhập → `/login`).
- Đặt sau khối "Việc làm mới nhất" hoặc gần đầu trang (chốt lúc dựng UI).

### 5. Tag trên thẻ việc — `components/JobCard.tsx` + `lib/jobs/job-badges.ts`

- Hàm thuần `jobBadges(job, now = new Date()): Badge[]` với:
  - **"Mới"**: `createdAt` trong vòng 7 ngày.
  - **"Lương cao"**: `salaryMax != null && salaryMax >= NGƯỠNG` (hằng số, ví dụ 40 triệu — chốt khi code).
- `JobCard` render các pill nhỏ (góc trên hoặc dưới tiêu đề). `JobCardData` cần có `createdAt`
  để tính "Mới"; nếu chỗ gọi chưa select `createdAt` thì thêm vào select (đã có ở `JobRow`).
- **Không làm "Hot"** vòng này (cần đếm lượt xem/ứng tuyển — để vòng sau).

### 6. Hàng "Công cụ nổi bật" — `components/home/FeatureTools.tsx`

- Mảng tĩnh các thẻ trỏ tính năng đã có: Tạo CV (`/cv`), Đánh giá công ty (`/companies`),
  Việc gợi ý cho tôi (`/jobs/recommendations`), Thông báo việc làm (`/jobs/alerts`).
- Mỗi thẻ có icon lucide + tiêu đề + mô tả ngắn. Thuần UI tĩnh.

## Dọn rác (kèm theo vòng này)

- Xóa thư mục rác `C:UsersMANHprojectcv-ai-platform.gitsdd/` (rỗng, do lệnh git ghi nhầm
  đường dẫn literal trên Windows; không được git theo dõi).
- Thêm `.firecrawl/` vào `.gitignore` (thư mục tạm sinh ra khi khảo sát site).

## Luồng dữ liệu

`app/page.tsx` (server component) mở rộng `Promise.all` hiện có, bổ sung:
`topSkills(8)` và dữ liệu cho `TrustedCompanies` (companies + counts + ratings, tái dùng
mẫu truy vấn của `app/companies/page.tsx`). Không có bảng mới, không migration.

## Kiểm thử

- Unit `tallySkills`: gộp trùng, sắp xếp, giới hạn, chuỗi rỗng/khoảng trắng.
- Unit `jobBadges`: biên "Mới" (đúng 7 ngày), "Lương cao" (bằng/thấp hơn ngưỡng, `null`).
- Unit `appendFilters`: có `location` → sinh đúng mệnh đề ILIKE và tham số.
- Giữ toàn bộ test hiện có xanh.

## Ngoài phạm vi

- Navbar redesign đang sửa dở (`components/Navbar.tsx`) — để user tự chốt commit/bỏ.
- Insight lương theo ngành, blog/cẩm nang nghề, trạng thái "đang tìm việc", tag "Hot".
- % hoàn thiện hồ sơ, timeline ứng tuyển, match % trên listing (thuộc Gói B).
