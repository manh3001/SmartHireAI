# UI Overhaul — Vòng 4: Dứt điểm UI (nhắn tin, thông báo, công ty, admin)

- **Ngày:** 2026-08-08
- **Trạng thái:** Đã duyệt (chờ review file spec)
- **Bối cảnh:** Vòng 1–3 đã token hóa landing, jobs, luồng ứng viên và toàn bộ `app/jobs/`. Vòng 4 xử lý **cụm UI cuối cùng còn hardcode màu**: nhắn tin & thông báo, trang công ty, admin. Sau vòng này dự án không còn nợ UI hardcode `blue-*/slate-*`.

## Mục tiêu

Áp design system chàm-tím (token, `Badge`, `StatCard`, `CompanyAvatar`) cho các trang còn lại, **giữ nguyên nghiệp vụ** (gửi tin nhắn, realtime, đánh dấu thông báo, lưu hồ sơ công ty, hành động admin). Bổ sung **avatar công ty** ở trang công ty.

## Phạm vi (các file còn hardcode màu)

**Nhắn tin & thông báo:**
- `app/messages/[applicationId]/page.tsx`, `app/messages/[applicationId]/MessageComposer.tsx`
- `app/notifications/page.tsx`, `app/notifications/NotificationItem.tsx`

**Công ty:**
- `app/companies/[id]/page.tsx` (trang công khai — thêm `CompanyAvatar`)
- `app/company/edit/page.tsx` (form chỉnh sửa)

**Admin:**
- `app/admin/page.tsx`, `app/admin/layout.tsx`, `app/admin/users/page.tsx`, `app/admin/jobs/page.tsx`

## Cách tiếp cận

- Đổi mọi `blue-*/slate-*` → token vòng 1 (`primary`, `foreground`, `muted-foreground`, `border`, `input`, `background`, `card`, `bg-muted/*`, `bg-primary/10`, `text-primary-foreground`, `hover:text-destructive`...).
- **Tái dùng component**, không tự vẽ lại:
  - `Badge` (`@/components/ui/badge`) cho nhãn trạng thái đơn (header nhắn tin).
  - `StatCard` (`@/components/StatCard`) thay component `Stat` cục bộ trong `app/admin/page.tsx` — **DRY**, xóa bản trùng.
  - `CompanyAvatar` (`@/components/CompanyAvatar`) cho **avatar công ty** ở trang công ty (và có thể header nhắn tin cho đối phương).
- **Bong bóng chat** token hóa nhất quán với `ChatClient` (đã làm ở vòng 2): tin của mình `bg-primary text-primary-foreground`; đối phương `border-border bg-card text-foreground`; timestamp phụ `text-primary-foreground/70` (mình) và `text-muted-foreground` (đối phương).
- **Thanh bar trạng thái** ở admin: `bg-blue-500` → `bg-primary`; nền bar `bg-slate-100` → `bg-muted`.
- Mọi `className` dùng **dấu nháy thẳng ASCII** (`"`), không dấu ngoặc cong (sự cố tooling Windows các vòng trước).

## Xử lý từng nhóm

- **Messaging (`page` + `MessageComposer`):** token hóa khung, bong bóng, header; `Badge` cho trạng thái; (tùy chọn) `CompanyAvatar` cho tên đối phương ở header. Giữ nguyên `isThreadParticipant`, truy vấn, server action gửi tin, và realtime.
- **Notifications (`page` + `NotificationItem`):** token hóa list + item; giữ logic đánh dấu đã đọc / điều hướng / realtime.
- **Company:**
  - `companies/[id]` (công khai): token hóa; thêm `CompanyAvatar` (chữ cái tên công ty) ở phần đầu hồ sơ.
  - `company/edit`: token hóa form; giữ server action lưu hồ sơ.
- **Admin (`page` + `layout` + `users` + `jobs`):** token hóa; thay `Stat`→`StatCard` trong `page.tsx` (xóa định nghĩa `Stat` cục bộ); bar trạng thái dùng `bg-primary`/`bg-muted`. Giữ mọi truy vấn + hành động (xóa user/JD, toggle công khai) và guard admin.

## Ngoài phạm vi (YAGNI — sau này)

- Chức năng mới: job alert/email, nhiều CV templates, upload logo công ty **thật**, trang công ty dạng thư mục.
- Nợ kỹ thuật cũ (inline-save desktop list; props `JobsBrowser`; các nit cosmetic).
- Không đụng logic auth/phân quyền, realtime, AI, server actions, output PDF, schema.

## Ràng buộc chung (Global Constraints)

- Prisma **pinned v6**; KHÔNG đổi schema, KHÔNG `db:push`.
- Vitest: chỉ unit-test logic thuần; không test component/route/DB. Vòng này thuần trình bày → không thêm test.
- **Không đổi**: logic auth, phân quyền vai trò (đặc biệt guard admin), realtime, server actions, AI.
- Dùng token vòng 1, KHÔNG hardcode `blue-*/slate-*`. Ngoại lệ hợp lệ: `text-white`/`text-primary-foreground` trên nền màu; màu ngữ nghĩa nếu có.
- `className` dùng dấu nháy thẳng ASCII.
- Nội dung tiếng Việt; thương hiệu **SmartHire**.
- Windows: `npm test`, `npm run lint`, `npm run build`.

## Kiểm thử

- Test hiện có phải vẫn xanh; `npm run build` phải qua ở bước rà soát cuối.
- Rà soát cuối: grep `blue-[0-9]|text-slate-|bg-slate-|border-slate-` trong toàn bộ file thuộc phạm vi → không còn. Không dấu ngoặc cong trong `className`.
- Sau vòng 4, grep toàn repo (trừ `CvPreview` cố ý) nên còn rất ít/không còn hardcode màu ở trang người dùng.

## Rủi ro & lưu ý

- **Admin guard**: chỉ đổi trình bày, tuyệt đối không đụng `requireAdmin`/`adminAccess` và các action xóa/toggle.
- **Realtime**: notifications và messages đều là server component `force-dynamic` + polling; chỉ đổi className, không đụng cơ chế làm mới.
- **StatCard vs Stat**: `StatCard` nhận `{ label, value }` — khớp cách dùng của `Stat` cục bộ trong admin; kiểm tra props khớp khi thay.
- `CvView` (dùng ở chi tiết ứng viên) không thuộc phạm vi và không có hardcode màu — không đụng.

## Thứ tự triển khai đề xuất

1. Messaging (page + MessageComposer).
2. Notifications (page + NotificationItem).
3. Company (companies/[id] + company/edit) — thêm CompanyAvatar.
4. Admin (page + layout + users + jobs) — DRY StatCard.
5. Rà soát màu trong phạm vi + `npm test` + `npm run build`.
