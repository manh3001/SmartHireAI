# Thiết kế: Làm đẹp UI — tông xanh dương & trắng

**Ngày:** 2026-07-29
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)
**Tiền đề:** Sau Phase 1–3. Chỉ thay đổi giao diện, KHÔNG đổi logic/API/test.

## 1. Mục tiêu

Nâng cấp toàn bộ giao diện thành một sản phẩm SaaS trông chuyên nghiệp, tông màu chủ đạo **xanh dương + trắng**, để demo gây ấn tượng với nhà tuyển dụng. Thương hiệu hiển thị: **SmartHire**.

## 2. Phạm vi

**Trong phạm vi (thuần giao diện):**
- Đặt theme màu xanh dương cho shadcn/ui (biến CSS trong `app/globals.css`).
- Thêm thanh điều hướng chung `Navbar` gắn vào các trang.
- Làm lại trang chủ có hero + 3 thẻ tính năng.
- Tinh chỉnh: đăng nhập, đăng ký, dashboard, sửa CV, đánh giá.

**Ngoài phạm vi:**
- Không đổi logic, API route, server action, Prisma, test.
- Không thêm dark mode (YAGNI cho demo).
- Không đổi luồng người dùng, chỉ đổi hình thức.

## 3. Bảng màu

- **Primary:** blue-600 `#2563EB` (nút chính, link, điểm nhấn); hover blue-700.
- **Nền:** trắng `#FFFFFF`; vùng nền phụ slate-50 `#F8FAFC`.
- **Chữ:** slate-900 (chính), slate-500 (phụ).
- **Hero:** gradient xanh nhạt (blue-50 → white).
- **Màu ngữ nghĩa giữ nguyên:** xanh lá (điểm mạnh / điểm cao ≥75), đỏ (điểm yếu / điểm thấp <50), vàng (trung bình 50–74) — dùng lại `scoreColor`.

Cách áp dụng: chỉnh biến `--primary`, `--primary-foreground`, `--background`, `--ring`... trong `app/globals.css` (theme shadcn) để nút/Card/Input tự động theo tông xanh; phần còn lại dùng class Tailwind trực tiếp.

## 4. Component mới

- `components/Navbar.tsx` — server component:
  - Nhận `session` (hoặc tự gọi `auth()`); hiển thị logo "SmartHire" (link về `/` hoặc `/dashboard`).
  - Nếu đã đăng nhập: tên user + nút Đăng xuất (server action `signOut`).
  - Nếu chưa: nút Đăng nhập / Đăng ký.
  - Nền trắng, viền dưới mảnh, dính trên cùng (`sticky top-0`).

## 5. Từng trang

- **`app/page.tsx` (trang chủ):** hero — tiêu đề lớn (một phần chữ màu xanh), phụ đề, 2 nút CTA; dưới hero là 3 thẻ tính năng (Tạo CV / AI đánh giá theo JD / Xuất PDF) mỗi thẻ có icon `lucide-react` + mô tả ngắn. Có Navbar (trạng thái chưa đăng nhập).
- **`app/login/page.tsx`, `app/register/page.tsx`:** form trong Card trắng bo tròn + bóng, đặt giữa nền gradient xanh nhạt, logo phía trên; nút chính màu xanh.
- **`app/dashboard/page.tsx`:** thêm Navbar; tiêu đề trang; nút "Tạo CV mới" nổi bật (primary); mỗi CV là Card có icon, tiêu đề, ngày cập nhật, hover đổi nền nhẹ; nút Xóa kín đáo.
- **`app/cv/[id]/CvEditor.tsx`:** tiêu đề mỗi Card mục màu xanh; thanh nút (Đánh giá / PDF / Lưu) rõ ràng; giữ bố cục.
- **`app/cv/[id]/evaluate/EvaluateClient.tsx`:** điểm số trong vòng tròn màu (theo `scoreColor`); từ khóa dạng badge (khớp = nền xanh, thiếu = nền xám); các khối kết quả gọn.

## 6. Kỹ thuật & ràng buộc

- Dùng `lucide-react` (đã có sẵn qua shadcn) cho icon.
- Không sửa file trong `lib/`, `app/api/`, `prisma/`, không sửa test.
- Giữ nguyên mọi `props`/luồng dữ liệu của component; chỉ đổi JSX/class.
- Trang chủ hiện là server component; Navbar là server component gọi `auth()`.
- Sau khi xong: `npx tsc --noEmit` + `npm run build` sạch; `npm test` vẫn 34/34 PASS (không đụng test).

## 7. Kiểm thử

- Không thêm test tự động (thay đổi thuần hình thức).
- Xác minh: type-check + build sạch; test cũ vẫn PASS.
- Kiểm tra thủ công bằng mắt trên trình duyệt (các trang hiển thị đúng tông xanh/trắng, Navbar hoạt động, không vỡ layout).

## 8. Thứ tự triển khai (plan sẽ chi tiết hóa)

1. Đặt theme màu xanh trong `globals.css`.
2. Tạo `Navbar` + gắn vào dashboard & các trang có session.
3. Làm lại trang chủ (hero + thẻ tính năng) + login/register.
4. Tinh chỉnh dashboard, CvEditor, EvaluateClient.
5. Build + kiểm tra bằng mắt.
