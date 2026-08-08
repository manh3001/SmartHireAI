# CV Templates — Chọn mẫu CV (Classic / Modern / Sidebar)

- **Ngày:** 2026-08-08
- **Trạng thái:** Đã duyệt (chờ review file spec)
- **Bối cảnh:** Nợ UI màu đã đóng. Đây là chức năng mới đầu tiên sau chuỗi đại tu UI. Người dùng chọn mẫu CV để xem trước và xuất PDF. Xây trên nền sẵn có: `CvPreview` (HTML), `CvDocument` (react-pdf), helper `cv-format` dùng chung, và luồng `saveCv`.

## Mục tiêu

Cho ứng viên chọn **1 trong 3 mẫu CV khác layout rõ rệt**; mẫu áp dụng cho cả **bản xem trước sống** và **PDF xuất ra**. Giữ nguyên dữ liệu CV (`CvInput`) — mẫu chỉ là lớp trình bày.

## Ba mẫu (cùng dữ liệu, khác layout)

- **`classic`** — 1 cột như hiện tại: tên lớn, headline, dòng liên hệ, tóm tắt, các mục (Kinh nghiệm/Học vấn/Kỹ năng/Dự án) với tiêu đề gạch chân. Trung tính. (Chính là layout `CvPreview`/`CvDocument` hiện tại.)
- **`modern`** — dải **header màu nhấn** (indigo thương hiệu) chứa tên/headline/liên hệ chữ trắng; thân 1 cột; tiêu đề mục có vạch/chấm nhấn màu.
- **`sidebar`** — 2 cột: **trái (~1/3, nền nhạt)** chứa liên hệ + kỹ năng; **phải (~2/3)** chứa tóm tắt + kinh nghiệm + học vấn + dự án.

Màu nhấn dùng **indigo thương hiệu cố định** (không cho tùy chọn màu ở vòng này).

## Kiến trúc & thành phần

### Dữ liệu
- Thêm trường **`template String @default("classic")`** vào `model CV` (`prisma/schema.prisma`). Đồng bộ bằng `npm run db:push` (cột có default, an toàn; CV cũ mặc định `classic`).
- **`lib/cv/templates.ts`** (logic thuần, có test):
  - `type CvTemplate = "classic" | "modern" | "sidebar"`
  - `CV_TEMPLATES: readonly { id: CvTemplate; label: string; description: string }[]`
  - `isCvTemplate(v: unknown): v is CvTemplate`
  - `normalizeTemplate(v: unknown): CvTemplate` — hợp lệ → chính nó; lạ/rỗng/null → `"classic"`.
- **Template tách khỏi `CvInput`** (nội dung). Truyền như prop/tham số riêng.

### Renderer (hai engine, cùng cấu trúc mục)
- **`components/cv/CvPreview.tsx`** nhận thêm prop `template: CvTemplate`; chọn render một trong ba layout. Tách mỗi layout thành component con để mỗi file gọn:
  - `components/cv/preview/ClassicPreview.tsx`, `ModernPreview.tsx`, `SidebarPreview.tsx` (mỗi cái nhận `cv: CvInput`).
  - `CvPreview` chỉ điều phối: `switch(template)`.
  - Tất cả dùng chung helper `cv-format` (`dateRange`/`contactLine`/`eduSubLine`).
- **`lib/pdf/CvDocument.tsx`** nhận thêm prop `template: CvTemplate`; render layout tương ứng (Sidebar dùng `flexDirection: "row"` của react-pdf). Có thể tách các mảnh dùng chung (section title, item) nội bộ file hoặc `lib/pdf/` con — tùy độ dài; giữ `Font.register` một chỗ.
- **Trùng lặp cố hữu:** HTML và PDF là hai engine khác nhau nên mỗi layout viết hai lần. Chấp nhận; giữ **cùng thứ tự và tập mục** để hai bên nhất quán về nội dung.

### Luồng chọn & lưu
- `app/cv/[id]/page.tsx` (server) đọc `cv.template` (qua `normalizeTemplate`) và truyền `initialTemplate` cho `CvEditor`.
- `app/cv/[id]/CvEditor.tsx`:
  - Thêm state `template` (khởi tạo từ `initialTemplate`).
  - **Bộ chọn mẫu** (3 nút, hiện nhãn `CV_TEMPLATES`) trong thanh hành động dính; đổi → cập nhật state → `CvPreview` đổi ngay.
  - `onSave` gọi `saveCv(cvId, cv, template)`.
- `lib/cv/actions.ts` — `saveCv(cvId, input, template)` thêm tham số; validate bằng `normalizeTemplate`; ghi `cv.template` trong cùng transaction cập nhật.
- `app/api/cv/[id]/pdf/route.tsx` — đọc `cv.template`, `normalizeTemplate`, truyền vào `<CvDocument cv={data} template={t} />`. **PDF phản ánh mẫu đã lưu** (như nội dung — cần Lưu trước khi xuất).

## Ngoài phạm vi (YAGNI)

- Tùy chọn màu nhấn / font; thêm mục CV mới; ảnh chân dung / upload ảnh.
- Áp mẫu vào `CvView` (xem CV ứng viên phía NTD) — giữ nguyên bản gọn hiện tại.
- Không đụng auth, AI, realtime, phân quyền.

## Ràng buộc chung (Global Constraints)

- Prisma **pinned v6**; thay đổi schema DUY NHẤT là thêm cột `template` nullable-default; đồng bộ bằng `npm run db:push` (không migration tay).
- Vitest: unit-test **logic thuần** (`normalizeTemplate`/`isCvTemplate`); mở rộng test PDF cho 3 template. Component/route không unit-test.
- Dùng **design token** + màu nhấn indigo thương hiệu; `className` dùng dấu nháy thẳng ASCII. Nền "giấy" CV trong preview giữ slate/white cố ý (như `CvPreview` hiện tại).
- **Không đổi** output PDF của mẫu `classic` so với hiện tại (regression): mẫu `classic` phải giữ layout/kết quả cũ.
- Nội dung tiếng Việt; thương hiệu **SmartHire**.
- Windows: `npm test`, `npm run lint`, `npm run build`, `npm run db:push`.

## Kiểm thử

- **TDD** `lib/cv/templates.ts`: `normalizeTemplate` (từng giá trị hợp lệ; lạ/rỗng/null/không phải chuỗi → `classic`); `isCvTemplate`; `CV_TEMPLATES` đủ 3 id, id duy nhất, khớp nhãn.
- **PDF regression mở rộng** (`lib/pdf/__tests__/CvDocument.test.tsx`): render cả `classic`, `modern`, `sidebar` → mỗi bản `%PDF-`, >2000 bytes. `classic` giữ hành vi cũ.
- `CvPreview`, các preview con, `CvEditor`, route: không unit-test (quy ước).
- Rà soát cuối: `npm test` + `npm run build`.

## Rủi ro & lưu ý

- **react-pdf Sidebar**: dùng `View` với `flexDirection: "row"`; cột trái có `width`/`backgroundColor`. Kiểm tra ngắt trang hợp lý (dùng `wrap` mặc định; sidebar dài có thể tràn — chấp nhận cho bản đầu, dữ liệu CV thường 1 trang).
- **Giữ `classic` bất biến**: tách layout hiện tại thành nhánh `classic` trước, xác nhận PDF/preview `classic` không đổi, rồi mới thêm `modern`/`sidebar`.
- **Tham số `saveCv`**: đổi chữ ký hàm — cập nhật nơi gọi duy nhất (`CvEditor.onSave`); không có nơi khác gọi `saveCv`.
- **db:push** chạm Neon; cột default an toàn cho hàng cũ.

## Thứ tự triển khai đề xuất

1. `lib/cv/templates.ts` + test (TDD) + thêm cột `template` (schema + `db:push`).
2. Thread template: `saveCv` (tham số) + `app/cv/[id]/page.tsx` đọc + route PDF đọc (chưa đổi layout — vẫn classic).
3. `CvDocument` theo template: tách `classic` (giữ nguyên output) → thêm `modern` → thêm `sidebar`; mở rộng test PDF 3 mẫu.
4. `CvPreview` theo template: tách `ClassicPreview` (giữ nguyên) → `ModernPreview` → `SidebarPreview`.
5. Bộ chọn mẫu trong `CvEditor` (state + UI + truyền `template` cho preview & saveCv).
6. Rà soát + `npm test` + `npm run build`.
