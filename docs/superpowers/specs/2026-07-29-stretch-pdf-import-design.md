# Thiết kế Stretch: Upload PDF tự động điền CV

**Ngày:** 2026-07-29
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)
**Tiền đề:** Nối tiếp Phase 1–5. Tái dùng Gemini + normalizeCv (Phase 2) + trình sửa CV (Phase 2).

## 1. Mục tiêu

Cho ứng viên tải lên một CV dạng PDF, AI đọc và trích xuất thông tin, tạo sẵn một CV có cấu trúc rồi mở trình sửa để người dùng xem lại và chỉnh trước khi lưu.

## 2. Nhà cung cấp AI & thư viện

- **Gemini** (`gemini-2.5-flash`) qua SDK `openai` (đã có `getAiClient` + `AI_MODEL`), structured output với Zod.
- Trích xuất text từ PDF bằng **`unpdf`** (hiện đại, hợp serverless/Vercel).
- Key `GEMINI_API_KEY` chỉ ở server.

## 3. Phạm vi

**Trong phạm vi:**
- Nút "Nhập CV từ PDF" trên dashboard ứng viên.
- API nhận file PDF → trích text → Gemini trích xuất → chuẩn hóa → tạo CV + mục con → trả `cvId`.
- Mở trình sửa CV (Phase 2) với dữ liệu đã điền để người dùng xem/chỉnh/lưu.
- Rate limit; chỉ user đăng nhập; giới hạn kích thước file.

**Ngoài phạm vi (YAGNI):**
- PDF scan ảnh (OCR) — chỉ hỗ trợ PDF có text.
- Nhập từ Word/ảnh.
- Lưu file gốc; tạo nhiều CV cùng lúc.

## 4. Luồng & kiến trúc

```
Dashboard ứng viên → "Nhập CV từ PDF" (chọn file)
   │  POST multipart /api/cv/import
   ▼
API route (nodejs runtime)
   │  auth + rate limit + kiểm tra file (pdf, <= ~5MB)
   │  unpdf: trích text từ PDF
   │  (text rỗng → lỗi "không đọc được nội dung")
   │  Gemini structured output (cvExtractionSchema) → dữ liệu CV
   │  normalizeCv (Phase 2)
   │  prisma: tạo CV + Profile + Experience/Education/Skill/Project
   ▼  trả { cvId }
client → chuyển tới /cv/[cvId] (trình sửa Phase 2, đã điền sẵn)
```

## 5. Mô hình dữ liệu

- **Không thêm model.** Tái dùng `CV` + các mục con đã có.
- CV tạo ra thuộc về user hiện tại (`userId`).

## 6. Trích xuất (Zod + prompt)

- `cvExtractionSchema` (Zod, `lib/ai/extract.ts`): mọi trường là chuỗi, **cho phép rỗng** (không `min`), khớp cấu trúc `CvInput` (title, profile, experiences[], educations[], skills[], projects[]) → để Gemini trả về một phần cũng hợp lệ.
- `buildExtractionPrompt(text)`: yêu cầu "trích xuất thông tin CV từ văn bản sau thành JSON đúng cấu trúc; để trống nếu không có; giữ nguyên tiếng Việt".
- Kết quả → `normalizeCv` (Phase 2) làm sạch (trim, bỏ dòng rỗng) → lưu.

## 7. Xử lý lỗi & lạm dụng

- File không gửi / không phải PDF (kiểm tra đuôi + MIME) → 400.
- File quá lớn (> ~5MB) → 400.
- PDF không có text (unpdf trả rỗng) → 422 "Không đọc được nội dung; hãy dùng PDF có chữ (không phải ảnh scan)".
- Gemini lỗi → 500 báo lỗi mềm.
- Thiếu API key → lỗi rõ ràng.
- **Rate limit** dùng lại `createRateLimiter` (vd 5 lần/phút mỗi user).
- Chỉ user đăng nhập; CV thuộc về họ.

## 8. Kiểm thử (Vitest, TDD cho logic thuần)

- `cvExtractionSchema`: chấp nhận dữ liệu đầy đủ; chấp nhận thiếu trường (điền rỗng) — TDD.
- `buildExtractionPrompt(text)`: chứa văn bản đầu vào + yêu cầu JSON — TDD.
- Phần đọc PDF + Gemini + tạo CV: build + chạy thật (live) với một PDF mẫu (tự sinh bằng react-pdf sẵn có).
- Không E2E browser.

## 9. Cấu trúc file

```
Thêm:
  lib/ai/extract.ts               cvExtractionSchema + buildExtractionPrompt (thuần, có test)
  app/api/cv/import/route.ts      nhận PDF → text → Gemini → tạo CV
  app/dashboard/ImportCvButton.tsx  client: input file + upload + chuyển hướng
Sửa:
  app/dashboard/page.tsx          thêm nút "Nhập CV từ PDF" (nhánh ứng viên)
Phụ thuộc:
  + unpdf (npm)
```

## 10. Giao diện

- Trên dashboard ứng viên, cạnh "Tạo CV mới": nút **"Nhập CV từ PDF"** mở hộp chọn file; khi đang xử lý hiện "Đang đọc PDF...". Xong → tự chuyển sang trình sửa CV đã điền.
- Dùng shadcn + tông xanh hiện có.

## 11. Thứ tự triển khai (plan sẽ chi tiết hóa)

1. `cvExtractionSchema` + `buildExtractionPrompt` (TDD). Cài `unpdf`.
2. API `/api/cv/import`: đọc PDF (unpdf) → Gemini → normalize → tạo CV.
3. Nút "Nhập CV từ PDF" trên dashboard + client upload + chuyển hướng.
