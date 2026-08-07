# UI Overhaul — Vòng 2: Redesign luồng ứng viên (CV builder có xem trước trực tiếp)

- **Ngày:** 2026-08-07
- **Trạng thái:** Đã duyệt (chờ review file spec)
- **Bối cảnh:** Vòng 1 đã xong design system + trang chủ + việc làm (đã merge). Vòng 2 tiếp tục "UI trước": đồng bộ toàn bộ luồng ứng viên theo design system chàm-tím, điểm nhấn là CV builder có **xem trước trực tiếp** (2 cột).

## Mục tiêu

Redesign các trang phía ứng viên theo design system vòng 1 (token màu, `.bg-brand-gradient`/`.text-brand-gradient`, Card/Badge, container thống nhất), **giữ nguyên nghiệp vụ và server actions**. Trọng tâm: nâng CV builder từ form 1 cột phẳng thành trải nghiệm "xịn" với preview sống.

Trang trong phạm vi: `app/login`, `app/register`, `app/dashboard` (một file, phục vụ cả CANDIDATE và RECRUITER), CV builder (`app/cv/[id]/page.tsx` + `app/cv/[id]/CvEditor.tsx`), `app/cv/[id]/evaluate` (`EvaluateClient`), `app/cv/[id]/chat` (`ChatClient`), `app/applications`.

## Ngoài phạm vi (YAGNI — để vòng sau)

- Nhiều CV templates để người dùng chọn (vòng này chỉ 1 kiểu preview mặc định).
- Upload logo công ty thật; job alert; trang công ty dạng thư mục.
- Redesign messaging, admin, company pages, trang chi tiết công ty.
- Nợ kỹ thuật vòng 1: inline-save trên list desktop; mở rộng props `JobsBrowser`.
- Không đụng logic AI, auth, realtime polling, hay **output PDF** (chỉ refactor nội bộ, không đổi kết quả render PDF).
- Không bật UI toggle dark mode.

---

## 1. Tách helper format CV dùng chung (logic thuần, TDD)

**File:** tạo `lib/cv/cv-format.ts`, test `lib/cv/__tests__/cv-format.test.ts`; sửa `lib/pdf/CvDocument.tsx`.

`CvDocument.tsx` hiện có hàm `dateRange` nội bộ và logic ghép dòng liên hệ/dòng phụ. Tách thành hàm thuần dùng chung:

- `dateRange(a: string, b: string): string` — `"a - b"`, bỏ phần rỗng; cả hai rỗng → `""`.
- `contactLine(email: string, phone: string): string` — ghép bằng `"  •  "`, bỏ phần rỗng.
- `eduSubLine(major: string, dateRange: string): string` — ghép `major` + khoảng thời gian bằng `"  •  "` (đang lặp ở mục Học vấn).

Refactor `CvDocument.tsx` dùng các helper này. **Ràng buộc: output PDF không đổi** — test PDF hiện có (`lib/pdf/__tests__/CvDocument.test.tsx`) phải vẫn xanh. Preview (mục 2) dùng lại chính các helper này → một nguồn sự thật.

## 2. Component `CvPreview` (HTML soi theo PDF)

**File:** tạo `components/cv/CvPreview.tsx`.

- Nhận `cv: CvInput`, render một "trang CV" HTML/CSS **mô phỏng layout của `CvDocument`**: tên lớn đậm, headline xám, dòng liên hệ (dùng `contactLine`), summary, rồi các mục **Kinh nghiệm / Học vấn / Kỹ năng / Dự án** với tiêu đề mục gạch chân dưới (giống `sectionTitle` trong PDF), item title đậm, dòng phụ dùng `dateRange`/`eduSubLine`.
- Trình bày trên nền "giấy": `bg-white` (đây là tờ giấy CV — cố ý giữ trắng, không token nền), bo góc, bóng đổ, khung tỉ lệ giống A4 (chiều rộng cố định, cao tự giãn). Chỉ mục nào có dữ liệu mới hiện (giống PDF).
- Không cần khớp pixel với PDF — chỉ nhất quán thị giác. Component, không unit-test.

## 3. CV builder redesign (2 cột + xem trước sống)

**File:** `app/cv/[id]/CvEditor.tsx` (client, đã giữ toàn bộ state `cv` qua `useState`).

- **Desktop (lg+):** layout 2 cột — trái là form chỉnh sửa (cuộn tự nhiên), phải là `<CvPreview cv={cv} />` (mục 2) trong khối **dính (`sticky top-...`)**. Preview cập nhật realtime theo state hiện có; không thêm cơ chế đồng bộ mới.
- **Mobile:** 2 tab **"Chỉnh sửa" / "Xem trước"** (state cục bộ), không side-by-side.
- **Thanh hành động dính trên cùng:** Lưu / Xuất PDF / Chat tư vấn / Đánh giá theo JD — dùng token, nút Lưu là primary.
- Token hóa toàn bộ: `text-blue-*`/`bg-slate-*` → token; `CardTitle text-blue-700` → `text-foreground`/`text-primary`. Giữ nguyên `addRow`/`removeRow`/`setRow`/`setProfile`/`saveCv`, các placeholder, và cấu trúc 5 mục.
- `app/cv/[id]/page.tsx` (server) không đổi logic — chỉ truyền `initial` như cũ.

## 4. Token hóa + trau chuốt các trang còn lại

- **Auth** (`app/login/page.tsx`, `app/register/page.tsx`): card giữa trang trên nền `bg-gradient` token, logo `.text-brand-gradient`, đổi `blue-*/slate-*` → token. Giữ nguyên logic `signIn`/gọi API đăng ký, xử lý lỗi.
- **Dashboard** (`app/dashboard/page.tsx` + `RecruiterStats.tsx` + `CandidateStats.tsx` + `ImportCvButton.tsx`): token hóa; card danh sách CV/tin dùng lại phong cách vòng 1 (icon trong ô `bg-primary/10 text-primary`, viền/hover token). `StatCard` token hóa. Giữ nguyên `createCv`/`deleteCv`/`deleteJobDescription`/import.
- **Applications** (`app/applications/page.tsx`): danh sách đơn của ứng viên token hóa; badge trạng thái nhất quán (tái dùng `Badge` nếu phù hợp). Giữ nguyên truy vấn/hiển thị trạng thái.
- **Evaluate & Chat** (`app/cv/[id]/evaluate/EvaluateClient.tsx`, `app/cv/[id]/chat/ChatClient.tsx`): token hóa màu, bố cục gọn nhất quán. Giữ nguyên toàn bộ gọi AI và luồng dữ liệu.

## 5. Kiểm thử

- **TDD** cho `lib/cv/cv-format.ts`: `dateRange` (cả rỗng, một rỗng, đủ hai), `contactLine`, `eduSubLine`.
- **Ràng buộc regression:** `lib/pdf/__tests__/CvDocument.test.tsx` phải vẫn xanh sau khi refactor `CvDocument` dùng helper.
- Component/route (CvPreview, CvEditor, các trang) không unit-test (theo quy ước dự án).
- Chạy `npm test` + `npm run build` ở bước rà soát cuối.

---

## Ràng buộc chung (Global Constraints)

- Prisma **pinned v6**; không thay đổi schema ở vòng này (không có field mới). Không `db:push`.
- Test bằng **Vitest**: chỉ unit-test logic thuần; không test component/route/DB.
- **Không đổi**: logic auth, phân quyền vai trò, realtime polling, server actions, và **output PDF**.
- Dùng **token màu** design-system vòng 1, không hardcode `blue-*/slate-*` (ngoại lệ hợp lệ: nền "giấy" CV trong `CvPreview` cố ý `bg-white`; `text-white` trên nút/badge gradient).
- Nội dung tiếng Việt; thương hiệu **SmartHire**.
- Windows: `npm test`, `npm run lint`, `npm run build`.

## Rủi ro & lưu ý

- **Refactor PDF phải giữ output**: chỉ rút hàm ra ngoài, không đổi chuỗi/định dạng. Test PDF là chốt chặn.
- **CvEditor là client component có nhiều state**: chỉ thay lớp trình bày + thêm cột preview; không động vào các hàm cập nhật state để tránh vỡ hành vi lưu.
- **Preview khớp thị giác, không khớp pixel** với PDF — chấp nhận sai khác nhỏ; mục tiêu là cảm giác cao cấp và phản hồi tức thì.
- Dashboard là file dùng chung 2 vai — token hóa cả hai nhánh, nhưng trọng tâm trau chuốt là phía ứng viên.

## Thứ tự triển khai đề xuất

1. Tách `lib/cv/cv-format.ts` + refactor `CvDocument` (kèm test, giữ PDF xanh).
2. `CvPreview` (HTML soi theo PDF).
3. `CvEditor` 2 cột + preview sống + thanh dính.
4. Auth (login/register).
5. Dashboard (+ stats + import).
6. Applications.
7. Evaluate & Chat.
8. Rà soát màu trong phạm vi + `npm test` + `npm run build`.
