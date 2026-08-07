# UI Overhaul — Vòng 1: Design system + Landing + Danh sách/Chi tiết việc làm

- **Ngày:** 2026-08-07
- **Trạng thái:** Đã duyệt (chờ review file spec)
- **Bối cảnh:** Dự án đã xong 16 phase nghiệp vụ nhưng giao diện "khung xương", nhìn ra AI dựng. Mục tiêu nâng UI/UX lên tầm các sàn thật (TopCV, CareerViet, Glints), bắt đầu từ phần mặt tiền có tác động lớn nhất.

## Mục tiêu vòng 1

Nâng cấp **bộ mặt** của sản phẩm mà không thay đổi nghiệp vụ:

1. Chuẩn hóa **design system** (token, component dùng chung) — hết hardcode màu.
2. Redesign **trang chủ** thành landing giàu nội dung, xem được khi chưa đăng nhập.
3. Redesign **danh sách + chi tiết việc làm** theo layout master-detail (kiểu Glints/LinkedIn).

Định hướng thị giác đã chốt: **chàm-tím hiện đại ("Glints")** — gradient, bo góc lớn, nhiều khoảng trắng.

## Ngoài phạm vi (YAGNI — để vòng sau)

- Upload logo công ty thật (vòng này dùng avatar chữ cái sinh màu).
- Job alert / email, CV templates đẹp.
- Redesign CV builder, dashboard, messaging, admin.
- Không đụng logic AI, auth, realtime polling, server actions hiện có (ngoài việc thêm field `category`).
- Không bật UI toggle dark mode (giữ token dark sẵn có, không thêm nút).

---

## 1. Design tokens & theme

**File:** `app/globals.css` (+ có thể tách `lib/ui/`).

- Tinh chỉnh `--primary` sang chàm-tím hướng B (indigo 600 → violet). Theme shadcn hiện đã là hue ~263, chỉ cần điều chỉnh sắc độ cho nhất quán.
- Thêm token gradient thương hiệu: `--brand-from`, `--brand-to`, và tiện ích `.bg-brand-gradient` (dùng cho nút CTA chính, logo, hero).
- Thang **radius** mềm hơn (card bo góc lớn), thang **shadow** nhẹ nhất quán.
- Chuẩn hóa bề rộng container: dùng `max-w-6xl` cho trang rộng (landing, jobs), thống nhất padding.
- **Thay toàn bộ hardcode `blue-*` / `slate-*` bằng token** (`primary`, `foreground`, `muted-foreground`, `border`, `background`...) trong các file thuộc phạm vi vòng này. Sau bước này, đổi màu chỉ ở một nơi.

**Tiêu chí hoàn thành:** grep `blue-600` / `text-slate-` trong các trang thuộc phạm vi vòng 1 không còn kết quả (các trang ngoài phạm vi để vòng sau).

## 2. Lớp component dùng chung

**File:** `components/ui/` (shadcn) và `components/`.

| Component | Mô tả | Ghi chú |
|-----------|-------|---------|
| `CompanyAvatar` | Avatar chữ cái đầu của công ty, màu nền sinh **ổn định** theo tên (hàm thuần, có test) | Không upload logo ở vòng này |
| `JobCard` | Card việc làm: avatar, tiêu đề, công ty·địa điểm, lương nổi bật, hàng tag, nút Lưu | Dùng lại ở landing + list |
| `SearchBar` | Ô tìm từ khóa + địa điểm, submit sang `/jobs` | Client hoặc form GET |
| `FilterSidebar` (desktop) / `FilterSheet` (mobile) | Bộ lọc: từ khóa, ngành, loại hình, cấp bậc, lương | Dùng `@base-ui/react` cho sheet nếu có sẵn |
| `Badge` (biến thể màu) | Nhãn tag dùng chung | Mở rộng badge shadcn |
| `SectionHeading`, `EmptyState`, `StatCard` | Khối trình bày dùng chung | |

- **Navbar**: logo gradient, menu rõ ràng, có **menu mobile** (hamburger). Giữ nguyên logic session/notification/RealtimeProvider.
- **Footer**: làm mới bố cục, link nhóm.

## 3. Trang chủ (landing) — công khai

**File:** `app/page.tsx` (+ component con).

- Cho phép **xem khi chưa đăng nhập** (đã `force-dynamic`).
- Khối:
  1. **Hero + thanh tìm việc** (từ khóa + địa điểm) → submit sang `/jobs?q=...`.
  2. **Duyệt theo ngành nghề** — lưới ngành có icon, mỗi ô link `/jobs?category=<slug>`.
  3. **Việc làm mới nhất** — query tin công khai (`isPublic: true`) mới nhất từ DB (giới hạn ~6–8), render bằng `JobCard`.
  4. **Số liệu tin cậy** (`StatCard`: số tin công khai, số công ty, số CV) + khối **"3 bước"** làm đẹp lại.
- Nút Lưu/Ứng tuyển trên card ở landing: nếu chưa đăng nhập → điều hướng `/login`.

## 4. Danh sách + chi tiết việc làm (master-detail)

**File:** `app/jobs/page.tsx`, `app/jobs/[id]/page.tsx`, component list/detail mới.

- **Desktop (lg+):** hai cột.
  - Cột trái: danh sách `JobCard` rút gọn, item chọn được.
  - Cột phải: **pane chi tiết** hiển thị tin đang chọn; đồng bộ URL qua query `?selected=<id>` (chọn mặc định tin đầu tiên).
- **Mobile:** chỉ hiển thị danh sách; bấm một tin → điều hướng `/jobs/[id]` (trang chi tiết giữ nguyên nghiệp vụ, chỉ redesign giao diện).
- **Bộ lọc:** `FilterSidebar` trên desktop (từ khóa, ngành, loại hình, cấp bậc, lương) + hàng **chip lọc đang áp dụng** cho phép xóa nhanh từng điều kiện. Trên mobile dùng `FilterSheet`.
- Server: giữ `buildJobsWhere`, **mở rộng thêm điều kiện `category`**. Không đổi cách phân trang hiện tại (nếu chưa có, không thêm ở vòng này).

## 5. Ngành nghề (thay đổi dữ liệu tối thiểu)

- Thêm trường **`category String?`** vào `model JobDescription` (`prisma/schema.prisma`).
- File hằng **`lib/jobs/job-categories.ts`**: danh sách ngành cố định (slug + nhãn tiếng Việt + icon lucide), ví dụ: `it` (CNTT), `marketing-sales` (Marketing/Kinh doanh), `finance` (Kế toán/Tài chính), `design` (Thiết kế), `hr` (Nhân sự), `operations` (Vận hành), `other` (Khác).
- Cập nhật:
  - Form đăng tin `app/jobs/new` — thêm ô chọn ngành (select).
  - `buildJobsWhere` — lọc theo `category` (có test).
  - Landing — dùng danh sách ngành để tạo lưới liên kết.
- Đồng bộ schema bằng `npm run db:push` (dự án dùng `db push`, không viết migration tay). Tin cũ có `category = null` — vẫn hiển thị bình thường, thuộc "Khác" khi cần.

## 6. Kiểm thử (TDD cho logic thuần)

Viết test trước cho các hàm thuần, đúng thói quen dự án:

- Hàm sinh màu/chữ cái avatar từ tên công ty (ổn định, xác định).
- `buildJobsWhere` mở rộng `category` (khớp/không khớp/không lọc).
- Chuẩn hóa/format lương nếu thêm hàm mới.
- Validate/normalize `category` (slug hợp lệ, giá trị lạ → bỏ qua).

Các component React, route, truy vấn DB **không** unit-test (theo quy ước dự án).

---

## Rủi ro & lưu ý

- **Không phá vỡ nghiệp vụ:** mọi thay đổi UI phải giữ nguyên hành vi server actions, auth, quyền theo vai trò (candidate/recruiter/admin).
- **Layout master-detail** là phần tốn công nhất; giữ trang `/jobs/[id]` độc lập để mobile và chia sẻ link vẫn hoạt động.
- **Field `category`** là thay đổi schema duy nhất; `db:push` an toàn vì chỉ thêm cột nullable.
- Thay hardcode màu diện rộng — làm theo từng trang trong phạm vi để dễ review, tránh đụng trang ngoài phạm vi.

## Thứ tự triển khai đề xuất

1. Design tokens & theme (nền tảng).
2. Component dùng chung (CompanyAvatar, JobCard, Badge, Navbar, Footer...).
3. Field `category` + `job-categories.ts` + cập nhật `buildJobsWhere`/form (kèm test).
4. Trang chủ (landing).
5. Danh sách + chi tiết việc làm (master-detail).
6. Rà soát hardcode màu còn sót trong phạm vi + kiểm thử tổng.
