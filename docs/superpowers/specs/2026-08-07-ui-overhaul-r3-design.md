# UI Overhaul — Vòng 3: Hoàn tất UI luồng việc làm / nhà tuyển dụng

- **Ngày:** 2026-08-07
- **Trạng thái:** Đã duyệt (chờ review file spec)
- **Bối cảnh:** Vòng 1 (design system + landing + jobs master-detail) và vòng 2 (luồng ứng viên + CV live preview) đã merge. Vòng 3 token hóa + trau chuốt **toàn bộ các trang còn lại trong `app/jobs/`**, đối xứng với luồng ứng viên đã xong.

## Mục tiêu

Áp design system chàm-tím (token, `Badge`, `CompanyAvatar`, `JobCard`) cho các trang job còn hardcode màu, **giữ nguyên nghiệp vụ**: kéo-thả trạng thái, server actions, sàng lọc AI, submit ứng tuyển, gợi ý, lưu tin.

## Phạm vi (các file trong `app/jobs/` còn hardcode `blue-*`/`slate-*`)

**Nhà tuyển dụng:**
- `app/jobs/[id]/applicants/ApplicantsBoard.tsx` (kanban kéo-thả)
- `app/jobs/[id]/applicants/page.tsx`
- `app/jobs/[id]/applicants/[appId]/page.tsx` (chi tiết ứng viên)
- `app/jobs/[id]/screening/ScreeningClient.tsx`, `app/jobs/[id]/screening/page.tsx`

**Ứng viên (job-flow còn sót):**
- `app/jobs/[id]/apply/ApplyForm.tsx`, `app/jobs/[id]/apply/page.tsx`
- `app/jobs/recommendations/RecommendClient.tsx`, `app/jobs/recommendations/page.tsx`
- `app/jobs/saved/page.tsx`
- `app/jobs/SaveJobButton.tsx`
- `app/jobs/[id]/EvaluateFromJob.tsx`

## Cách tiếp cận

- Đổi mọi `blue-*`/`slate-*` → token vòng 1 (`primary`, `foreground`, `muted-foreground`, `border`, `input`, `background`, `card`, `bg-muted/*`, `bg-primary/10`, `hover:text-destructive`...).
- **Tái dùng component có sẵn**, không tự vẽ lại:
  - `CompanyAvatar` (`@/components/CompanyAvatar`) — avatar chữ cái sinh màu, vốn generic theo `name` → dùng cho **avatar ứng viên** trên board/list/detail.
  - `Badge` (`@/components/ui/badge`) — nhãn trạng thái đơn (dùng `STATUS_LABELS`).
  - **Điểm phù hợp**: giữ **màu ngữ nghĩa** đỏ/vàng/xanh qua `scoreColor` (`@/lib/ai/score`), không tokenize thành brand.
  - `JobCard` (`@/components/JobCard`) cho các trang **liệt kê việc** (saved, recommendations) nếu shape dữ liệu khớp `JobCardData`; nơi khác token hóa tại chỗ.
- Mọi `className` phải dùng **dấu nháy thẳng ASCII** (`"`), không dấu ngoặc cong (đã gặp sự cố tooling ở vòng 2 trên Windows).

## Xử lý từng nhóm

- **Applicants board (kanban):** token hóa cột/thẻ; thêm `CompanyAvatar` cho ứng viên, badge điểm (ngữ nghĩa qua `scoreColor`), nhãn trạng thái. **Giữ nguyên toàn bộ drag-drop + `changeStatus` + optimistic update + rollback.**
- **Applicants list + applicant detail:** token hóa; avatar ứng viên; badge điểm/trạng thái. Giữ truy vấn + hành động.
- **Screening (AI):** token hóa client + page; **không đụng** logic gọi AI/hiển thị kết quả; giữ màu ngữ nghĩa điểm.
- **Apply form + page:** token hóa form/nút; giữ submit + validate + xử lý lỗi.
- **Recommendations + saved:** token hóa; tái dùng `JobCard`/`Badge` nếu khớp; giữ logic gợi ý/lưu.
- **SaveJobButton:** token hóa màu nút (giữ icon Bookmark/BookmarkCheck + `toggleSaveJob` + toast).
- **EvaluateFromJob:** token hóa màu; giữ hành vi gọi đánh giá.

## Ngoài phạm vi (YAGNI — vòng sau)

- Messaging/notifications, trang công ty (xem/sửa), admin → vòng 4.
- Không đụng logic AI, auth, phân quyền, realtime, output PDF, schema.
- `CvPreview` giữ nguyên (nền "giấy" slate/white cố ý).
- **Không** làm lại inline-save trên list desktop (nợ kỹ thuật vòng 1 — để riêng).

## Ràng buộc chung (Global Constraints)

- Prisma **pinned v6**; KHÔNG đổi schema, KHÔNG `db:push`.
- Vitest: chỉ unit-test logic thuần; không test component/route/DB. Vòng này chủ yếu trình bày → không thêm test trừ khi phát sinh hàm thuần mới (khi đó TDD).
- **Không đổi**: logic auth, phân quyền vai trò, realtime, server actions, AI, output PDF.
- Dùng token vòng 1, KHÔNG hardcode `blue-*/slate-*`. Ngoại lệ hợp lệ: màu ngữ nghĩa điểm số (đỏ/vàng/xanh) và trạng thái mang ý nghĩa; `text-white` trên nút/badge gradient.
- `className` dùng dấu nháy thẳng ASCII.
- Nội dung tiếng Việt; thương hiệu **SmartHire**.
- Windows: `npm test`, `npm run lint`, `npm run build`.

## Kiểm thử

- Test hiện có phải vẫn xanh; `npm run build` phải qua ở bước rà soát cuối.
- Rà soát cuối: grep `blue-[0-9]|text-slate-|bg-slate-|border-slate-` trong các file thuộc phạm vi → không còn (trừ ngoại lệ ngữ nghĩa). Không dấu ngoặc cong trong `className`.

## Rủi ro & lưu ý

- **ApplicantsBoard** có drag-drop + optimistic state — chỉ đổi lớp trình bày, tuyệt đối không động vào `onDrop`/`setCards`/`changeStatus`.
- **`CompanyAvatar` dùng cho ứng viên**: hàm sinh màu/chữ cái là generic theo `name`; đặt cạnh tên ứng viên (đã có text) nên `aria-hidden` không gây mất thông tin.
- Trang liệt kê việc (saved/recommendations) có thể có shape khác `JobCardData` (ví dụ kèm điểm gợi ý) — nếu không khớp gọn, token hóa tại chỗ thay vì ép dùng `JobCard`.

## Thứ tự triển khai đề xuất

1. Applicants board (kanban).
2. Applicants list + applicant detail.
3. Screening (client + page).
4. Apply (form + page).
5. Recommendations + saved + SaveJobButton.
6. EvaluateFromJob.
7. Rà soát màu trong phạm vi + `npm test` + `npm run build`.
