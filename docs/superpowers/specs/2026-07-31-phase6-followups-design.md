# Thiết kế: Tinh chỉnh sau Phase 6 (vòng ứng tuyển)

**Ngày:** 2026-07-31
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)

## 1. Bối cảnh

Phase 6 (vòng ứng tuyển) đã merge vào `main`. Final review để lại 3 mục Minor đã hoãn. Spec này xử lý cả 3 trong một lần triển khai.

## 2. Mục #3 — "Rút đơn" chuyển sang trạng thái WITHDRAWN (mềm)

**Vấn đề hiện tại:** `withdrawApplication` **xoá cứng** `Application` (và cascade `ApplicationEvent`), NTD mất dấu vết, không có trạng thái phản ánh việc rút.

**Thiết kế:**

- Thêm giá trị `WITHDRAWN` vào enum `ApplicationStatus` (Prisma + `lib/applications/status.ts`), nhãn `STATUS_LABELS.WITHDRAWN = "Đã rút"`.
- Tách hai khái niệm trong `status.ts`:
  - `BOARD_STATUSES` = 6 bước pipeline kéo-thả: SUBMITTED, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED.
  - `APPLICATION_STATUSES` = tất cả trạng thái hợp lệ, gồm cả WITHDRAWN (dùng cho validate enum, nhãn).
- `withdrawApplication`: thay `prisma.application.delete` bằng cập nhật `status = WITHDRAWN` + ghi `ApplicationEvent(fromStatus, toStatus=WITHDRAWN)`, trong một `$transaction`. Guard giữ nguyên `canWithdraw(status)` (chỉ rút khi SUBMITTED hoặc SCREENING).
- `canTransition`: chặn mọi chuyển **vào** WITHDRAWN (`to === "WITHDRAWN"` → false) và **ra khỏi** WITHDRAWN (`from === "WITHDRAWN"` → false). Chỉ hành động rút của ứng viên mới đặt được WITHDRAWN. (Giữ nguyên các luật cũ: `from === to` → false; `to === "SUBMITTED"` → false.)
- Board NTD (`ApplicantsBoard`): render cột từ `BOARD_STATUSES` (không có cột WITHDRAWN). Đơn WITHDRAWN gom vào mục "Đã rút" thu gọn dưới board (danh sách + số lượng), không kéo-thả.
- Trang "Ứng tuyển của tôi": đơn WITHDRAWN hiển thị nhãn "Đã rút"; `canWithdraw` trả false nên nút rút tự ẩn.

## 3. Mục #4 — Preview không ghi DB; điểm chính thức tính lúc nộp

**Vấn đề hiện tại:** `previewMatch` tạo một `Evaluation` mỗi lần bấm "Xem điểm phù hợp" → mồ côi nếu không nộp.

**Thiết kế:**

- `previewMatch(jobId, cvId)`: **chỉ tính và trả về điểm để hiển thị, KHÔNG lưu `Evaluation`**. Trả `{ ok: true, score, summary } | { ok: false, error }`. Vẫn giữ rate-limit + soft-fail.
- `submitApplication`: bỏ tham số `evaluationId` khỏi input client (client chỉ gửi `{ jobId, cvId, coverLetter }`). Khi nộp, **server tự tính lại** Evaluation từ `cvSnapshot` + JD của job, lưu bản chính thức và gắn `evaluationId` vào `Application`. AI lỗi → đơn vẫn nộp với `evaluationId = null` (soft-fail).
- **Lý do:** không cho client tự khai điểm (giữ tính toàn vẹn đã vá ở lỗ IDOR trước); không còn Evaluation mồ côi. Đánh đổi: mỗi lần nộp gọi AI một lần (Gemini miễn phí), điểm lưu có thể lệch nhẹ so với preview do LLM không tất định.
- **Xoá code cũ:** bỏ đoạn validate `trustedEvaluationId` trong `submitApplication` (không còn `evaluationId` từ client để validate). Bỏ trường `evaluationId` khỏi `ApplyParams`/`CreateApplicationData` trong `lib/applications/apply.ts`.
- **Vị trí tính điểm:** trong dep `createApplication` của action (đã có sẵn `cvSnapshot` = `CvInput` và cần thêm `rawText` của job). Mở rộng `findPublicJob` để trả thêm `rawText`; action dùng `buildEvaluationPrompt(cvSnapshot, rawText)` + `requestEvaluation`, try/catch → `evaluationId` hoặc null, rồi tạo `Application` (kèm event SUBMITTED) trong cùng luồng.
- Thêm rate-limit cho `submitApplication` (tái dùng `createRateLimiter`) vì giờ nó gọi AI.
- `ApplyForm` (client): bỏ state `evaluationId`; preview chỉ để hiển thị điểm; submit chỉ gửi `{ jobId, cvId, coverLetter }`. Vẫn reset điểm hiển thị khi đổi CV.

## 4. Mục #6 — Trang chi tiết ứng viên cho NTD

**Vấn đề hiện tại:** thẻ trên board không có cách xem CV đã nộp (`cvSnapshot`); spec Phase 6 §5 có nhắc.

**Thiết kế:**

- Route mới `app/jobs/[id]/applicants/[appId]/page.tsx` (SSR). Phân quyền: đăng nhập + `RECRUITER` + là chủ job (`application.job.userId === session.user.id`), nếu không → `notFound()`.
- Nội dung: CV đã nộp (render từ `cvSnapshot`), cover letter, điểm match (nếu có), timeline `ApplicationEvent`.
- Tách component đọc-CV dùng lại `components/CvView.tsx`: nhận `CvInput`, render read-only (profile, kinh nghiệm, học vấn, kỹ năng, dự án). Trang chi tiết dùng component này với dữ liệu `cvSnapshot` (ép kiểu `CvInput`).
- Board card: thêm link "Xem chi tiết →" (`Link` sang route trên). Thân thẻ vẫn `draggable`; link là phần tử riêng để bấm điều hướng không xung đột với kéo-thả.

## 5. Phân quyền & xử lý lỗi

- Trang chi tiết ứng viên: chỉ chủ job xem được; đơn không thuộc job của NTD → `notFound()`.
- `submitApplication`/`previewMatch`: giữ gate role CANDIDATE + rate-limit; AI lỗi → soft-fail (đơn vẫn nộp, không điểm).
- `withdrawApplication`: giữ gate role CANDIDATE + ownership (`candidateId`) + `canWithdraw`.
- `changeStatus`: `canTransition` mới tự chặn WITHDRAWN, không cần sửa thêm ở action.

## 6. Kiểm thử

- **Unit (Vitest):**
  - `status.ts`: `canTransition` chặn vào/ra WITHDRAWN; `BOARD_STATUSES` có 6 phần tử không gồm WITHDRAWN; `APPLICATION_STATUSES` gồm WITHDRAWN; nhãn "Đã rút"; `canWithdraw` không đổi.
  - `apply.ts`: cập nhật test bỏ `evaluationId` (core không còn nhận trường này); các nhánh job/trùng/CV giữ nguyên.
- **Glue (actions), UI, trang chi tiết:** không unit-test (đúng chuẩn dự án); an toàn bằng `npx tsc --noEmit` + `npm test` xanh.
- Áp dụng TDD cho phần logic thuần thay đổi (`status.ts`, `apply.ts`).

## 7. Ranh giới (YAGNI)

- Không thêm cột WITHDRAWN vào board (đã chốt: gom mục thu gọn).
- Không tính lại điểm tự động cho đơn cũ; không có thông báo/email (thuộc gói E).
- Không dọn Evaluation mồ côi lịch sử (sau thay đổi này sẽ không sinh thêm; dữ liệu cũ để nguyên).
- `CvView` chỉ hiển thị read-only, không sửa/không xuất PDF (đã có luồng riêng).
