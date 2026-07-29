# Thiết kế: Polish UI v2 (toàn diện)

**Ngày:** 2026-07-29
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)
**Tiền đề:** Sau khi hoàn thành đủ 6 tính năng (Phase 1–5 + stretch). Chỉ thay đổi giao diện, KHÔNG đụng logic/API/test. Giữ tông xanh dương + trắng, thương hiệu "SmartHire".

## 1. Mục tiêu

Nâng giao diện lên mức chỉn chu, đồng bộ, thể hiện đầy đủ 6 tính năng — tạo ấn tượng tốt với nhà tuyển dụng khi demo.

## 2. Phạm vi

**Trong phạm vi (thuần giao diện):**
- Làm lại **trang chủ**: hero mạnh hơn, 6 thẻ tính năng, phần "Cách hoạt động", footer.
- **Navbar**: thêm link Dashboard, hiển thị vai trò, hover nhất quán.
- **Footer** dùng chung (component mới).
- Tinh chỉnh trang app: thanh nút trình sửa CV (responsive), trạng thái rỗng đẹp hơn, đồng bộ khoảng cách/bo góc/bóng, bố cục kết quả đánh giá gọn.

**Ngoài phạm vi:**
- Không đụng logic, API route, server action, Prisma, test.
- Không thêm dark mode, không ảnh chụp màn hình (làm sau khi deploy nếu muốn).
- Không đổi luồng người dùng.

## 3. Trang chủ (`app/page.tsx`)

- **Hero:** tiêu đề lớn (chữ "SmartHire" màu xanh), phụ đề, hàng nhãn nhỏ "Miễn phí · AI · Tiếng Việt", 2 nút CTA (Bắt đầu miễn phí / Đăng nhập). Nền gradient blue-50 → white.
- **6 thẻ tính năng** (lưới 3 cột, icon `lucide-react` + tiêu đề + mô tả ngắn):
  1. Tạo CV chuyên nghiệp (FileText)
  2. Xuất PDF tiếng Việt (Download)
  3. Nhập CV từ PDF (Upload)
  4. AI đánh giá theo JD (Sparkles)
  5. Chatbot tư vấn (MessageCircle)
  6. Kết nối nhà tuyển dụng (Briefcase)
- **"Cách hoạt động"** — 3 bước đánh số (1 Tạo/nhập CV → 2 AI đánh giá theo JD → 3 Cải thiện & ứng tuyển).
- **Footer** ở cuối.

## 4. Navbar (`components/Navbar.tsx`)

- Đã đăng nhập: logo (về dashboard) · link "Việc làm" · **badge vai trò** (Ứng viên/NTD) · tên · nút Đăng xuất.
- Chưa đăng nhập: logo · nút Đăng nhập/Đăng ký.
- Hover xanh nhất quán; nền trắng mờ + viền dưới (giữ như hiện tại).

## 5. Footer (`components/Footer.tsx`) — component mới

- Nền trắng, viền trên mảnh; logo nhỏ "SmartHire" + dòng "Nền tảng CV thông minh · Dự án demo © 2026".
- Dùng ở trang chủ (và có thể các trang public khác).

## 6. Trang app — tinh chỉnh

- **Trình sửa CV (`CvEditor.tsx`)**: thanh nút (Chat tư vấn / Đánh giá theo JD / Xuất PDF / Lưu) cho phép **xuống dòng gọn trên mobile** (`flex-wrap`), nút Lưu là primary xanh nổi bật; các nút phụ `variant outline`.
- **Trạng thái rỗng** (dashboard, /jobs): thêm icon + chữ hướng dẫn trong card viền đứt (đã có một phần — chuẩn hóa).
- **Trang đánh giá (`EvaluateClient.tsx`)**: cụm điểm + tóm tắt trong một khối nổi bật; giữ vòng tròn điểm + badge từ khóa.
- **Đồng bộ**: tiêu đề trang `text-2xl font-bold text-slate-900`; card `border-slate-200`; nền trang app `bg-slate-50`.

## 7. Kỹ thuật & ràng buộc

- Dùng `lucide-react` (đã có). Không thêm phụ thuộc.
- Giữ nguyên props/luồng dữ liệu; chỉ đổi JSX/class.
- Không sửa `lib/`, `app/api/`, `prisma/`, test.
- Sau khi xong: `npx tsc --noEmit` + `npm run build` sạch; `npm test` vẫn 44/44 PASS.

## 8. Kiểm thử

- Không thêm test tự động (thuần hình thức).
- Xác minh: type-check + build sạch; test cũ PASS; kiểm tra bằng mắt trên trình duyệt (trang chủ đủ 6 tính năng, navbar, footer, các trang đồng bộ).

## 9. Cấu trúc file

```
Sửa:
  app/page.tsx                 làm lại trang chủ (hero + 6 tính năng + cách hoạt động + footer)
  components/Navbar.tsx        thêm badge vai trò
  app/cv/[id]/CvEditor.tsx     thanh nút responsive
  app/cv/[id]/evaluate/EvaluateClient.tsx  cụm điểm gọn (nếu cần)
Thêm:
  components/Footer.tsx        footer dùng chung
```

## 10. Thứ tự triển khai (plan sẽ chi tiết hóa)

1. Footer component + làm lại trang chủ (6 tính năng + cách hoạt động + footer).
2. Navbar (badge vai trò).
3. Tinh chỉnh trình sửa CV (thanh nút responsive) + trang đánh giá.
