# Liên kết nhãn↔input trong form (a11y) — Design

- **Ngày:** 2026-09-19
- **Trạng thái:** Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh:** Hướng UX/accessibility. Rà hiện trạng: `<html lang="vi">` đã có; nút chỉ-icon
  chính (chuông Navbar `aria-label="Thông báo"`, ThemeToggle `aria-label="Đổi giao diện"`) đã có
  nhãn. Khoảng trống rõ & liệt kê đủ: **24 `<Label>` chưa gắn `htmlFor`** ở 6 file — Label và input
  là anh-em (không liên kết), nên screen reader không đọc đúng nhãn cho input, và click nhãn không
  focus input.

## Mục tiêu & phạm vi

Gắn `htmlFor`/`id` cho mọi `<Label>` chưa liên kết trong các form, để screen reader đọc đúng nhãn
và click nhãn focus vào input. Refactor markup thuần — KHÔNG đổi hành vi.

**Ngoài phạm vi:** skip-to-content + landmark id; focus-visible/keyboard; ARIA roles cho dialog/bảng;
aria-label thêm (không tìm thấy control chỉ-icon nào thiếu nhãn).

## 1. Các file & quy tắc

6 file dùng `<Label>` (24 nhãn chưa liên kết):
- `app/company/edit/page.tsx`
- `app/cv/[id]/CvEditor.tsx`
- `app/cv/[id]/evaluate/EvaluateClient.tsx`
- `app/jobs/new/NewJobForm.tsx`
- `app/settings/profile/ProfileForm.tsx`
- `components/InterviewModal.tsx`

**Quy tắc gắn:**
- Với input có `name`: đặt `id="<name>"` trên input và `<Label htmlFor="<name>">` trên nhãn tương ứng.
  (`name` sẵn có, duy nhất trong 1 form → id an toàn, không trùng.)
- Với input KHÔNG có `name` (nếu có): đặt `id` mô tả (vd `id="jd-brief"`) và `htmlFor` khớp.
- Áp dụng cho `<Input>`/`<Textarea>` (shadcn — forward `id` qua spread props) và `<select>` native.
- Nếu một `<Label>` không kèm input cụ thể (nhãn nhóm/tiêu đề, hiếm) → giữ nguyên, ghi chú.
- KHÔNG đổi `name`, không đổi logic/handler, không đổi layout/class.

## 2. Bổ sung nhỏ (nếu gặp)
Nếu trong 6 file trên xuất hiện control chỉ-icon thiếu nhãn → thêm `aria-label` tiếng Việt. (Rà sơ:
không thấy; đây chỉ là dự phòng, không mở rộng ra ngoài 6 file.)

## 3. Kiểm thử & bằng chứng không đổi hành vi

Refactor markup — không thêm unit test mới:
- `npx tsc --noEmit` 0; `npm run lint` 0 error (2 warning tồn đọng chấp nhận); **toàn bộ 535 test
  giữ xanh** (không đổi hành vi); `npm run build` PASS.
- Reviewer đọc diff xác nhận: mỗi `<Label>` đã sửa có `htmlFor` khớp `id` của một input; không có
  thay đổi ngoài a11y attributes.
- User kiểm tay: axe DevTools / screen reader trên các form; click nhãn → input được focus.

## 4. Việc người dùng phải tự làm
Không env/DB/dependency. Kiểm tay bằng axe/screen reader như trên.

## Để dành vòng sau
Skip-to-content + landmark `id` cho `<main>` các trang; focus-visible; ARIA roles cho dialog/bảng;
a11y cho trang công khai (jobs, salaries, blog).
