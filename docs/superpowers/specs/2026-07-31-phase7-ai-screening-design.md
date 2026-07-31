# Thiết kế: Sàng lọc & xếp hạng AI hàng loạt (Gói B)

**Ngày:** 2026-07-31
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)

## 1. Bối cảnh & Mục tiêu

Sau Phase 6 + follow-ups, mỗi đơn ứng tuyển đã có sẵn một `Evaluation` (điểm match) chấm **độc lập** lúc nộp. Gói B thêm một tầng khác biệt: **một lệnh AI nhìn toàn bộ ứng viên của một job cùng lúc để xếp hạng có so sánh tương đối và đề xuất shortlist**. Đây là công cụ phía nhà tuyển dụng (NTD), giúp quyết định nên phỏng vấn ai trước.

Điểm khác cốt lõi so với đánh giá từng đơn: đánh giá từng đơn chấm một CV với JD một cách độc lập; sàng lọc hàng loạt **so sánh các ứng viên với nhau** trong cùng một lời gọi.

## 2. Thiết kế phần AI

### 2.1 Đầu vào
- JD của job (`rawText`).
- Danh sách CV ứng viên **không tính trạng thái WITHDRAWN** (lấy từ `Application.cvSnapshot`).
- **Cap tối đa 20 ứng viên** mỗi lần (`MAX_SCREENING_APPLICANTS = 20`). Nếu nhiều hơn, lấy 20 đơn có điểm `Evaluation.overallScore` cao nhất sẵn có (đơn chưa có điểm xếp sau). Mục tiêu: giữ prompt không quá lớn.

### 2.2 Tham chiếu an toàn (ref → applicationId)
Không đưa `applicationId` (cuid dài) vào prompt để model đọc lại — dễ sai. Thay vào đó gán số thứ tự `#1, #2, …` cho từng ứng viên trong prompt theo đúng thứ tự mảng đầu vào. Model trả về `ref` (số 1-based). **Server map `ref → applications[ref-1]`** sau khi nhận kết quả.

### 2.3 Schema kết quả (Zod, structured output)
```
{
  ranking: [
    { ref: number, score: number (0-100), shortlisted: boolean, reason: string }
  ],
  summary: string
}
```
- `ranking` trả về theo thứ tự đã xếp hạng (tốt nhất trước).
- `reason`: nhận xét so sánh ngắn cho ứng viên đó (vì sao ở hạng này).
- `summary`: nhận xét tổng quan về nhóm ứng viên.

### 2.4 Model & prompt
- Dùng client OpenAI-compat sẵn có (`getAiClient`, `AI_MODEL` — Gemini), structured output qua `zodResponseFormat`, giống `requestEvaluation`.
- System prompt: vai trò chuyên gia tuyển dụng, yêu cầu **so sánh các ứng viên với nhau**, chấm điểm tương đối 0–100, chỉ ra shortlist nên phỏng vấn, trả lời tiếng Việt đúng schema. Yêu cầu rõ: **xếp hạng TẤT CẢ ứng viên được cung cấp**.

## 3. Mô hình dữ liệu mới

```
Screening
  id             String   @id @default(cuid())
  jobId          String   @unique          -- mỗi job giữ 1 kết quả mới nhất; chạy lại = upsert
  job            JobDescription @relation(fields: [jobId], references: [id], onDelete: Cascade)
  summary        String
  result         Json                        -- mảng ĐÃ xếp hạng (xem dưới)
  rawModelOutput Json                        -- nguyên output model để debug
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
```
Quan hệ ngược: `JobDescription.screening Screening?`.

**Hình dạng `result` (đã chốt tại thời điểm chạy):**
```
[
  { applicationId: string, candidateName: string, score: number | null,
    shortlisted: boolean, reason: string }
]
```
Lưu kèm tên + điểm để trang render ổn định, không phụ thuộc thay đổi về sau. Ứng viên AI bỏ sót được nối cuối với `score: null`, `shortlisted: false`, `reason: "Chưa được AI xếp hạng"`.

**Quyết định:** `jobId @unique` → chỉ giữ bản mới nhất (upsert), không lưu lịch sử nhiều lần (YAGNI).

## 4. Logic & Server action

### 4.1 Core thuần `runScreening(params, deps)`
Mô phỏng pattern `runApply`/`runCvEvaluation` (DI, test không cần DB/AI thật). Trách nhiệm thuần:
- Nếu không có ứng viên → `{ ok: false, error: "Chưa có ứng viên để sàng lọc" }`.
- Gọi `deps.requestScreening(prompt)` lấy `{ ranking, summary }`.
- **Map `ref → application`**: theo đúng thứ tự `ranking` trả về; bỏ `ref` ngoài phạm vi `[1..n]`; bỏ `ref` trùng (giữ lần đầu).
- Ứng viên không xuất hiện trong `ranking` → nối cuối, `score: null`, `shortlisted: false`, `reason: "Chưa được AI xếp hạng"`.
- Gọi `deps.saveScreening(...)` lưu `result` + `summary` + `rawModelOutput`.
- Trả `{ ok: true }`.

### 4.2 Server action `runScreening(jobId)`
- `auth()` + role `RECRUITER` + là chủ job (`job.userId === session.user.id`), nếu không → lỗi.
- Rate-limit (tái dùng `createRateLimiter`, ví dụ 5 lần/phút mỗi user).
- Nạp ứng viên không WITHDRAWN của job (kèm `cvSnapshot`, `candidate.name`, `evaluation.overallScore`), sắp theo điểm giảm dần, cắt còn `MAX_SCREENING_APPLICANTS`.
- Build prompt, gọi AI structured; AI lỗi → `{ ok: false, error }` (lỗi mềm, không crash).
- Upsert `Screening` theo `jobId`.
- `revalidatePath(\`/jobs/${jobId}/screening\`)` khi thành công.

### 4.3 Nút "Chuyển vào Sàng lọc"
**Tái dùng `changeStatus(applicationId, "SCREENING", "")`** sẵn có (đã có phân quyền RECRUITER + chủ job + `canTransition`). Nếu ứng viên đã WITHDRAWN → `canTransition` chặn → báo lỗi mềm. Không thêm action mới cho việc này.

## 5. Giao diện

- Trang mới `app/jobs/[id]/screening/page.tsx` (SSR, `force-dynamic`, chỉ chủ job — nếu không → `notFound()`):
  - Nút **"Chạy sàng lọc AI"** (client) → gọi `runScreening(jobId)` → `router.refresh()`.
  - Nếu đã có `Screening`: bảng xếp hạng (hạng #, tên, điểm, badge "Shortlist" khi `shortlisted`, `reason`) + `summary` tổng ở trên.
  - Hàng `shortlisted` có nút **"Chuyển vào Sàng lọc"** (client, gọi `changeStatus`).
  - Chưa chạy lần nào → trạng thái rỗng + nút chạy.
- Trang board ứng viên `app/jobs/[id]/applicants/page.tsx`: thêm link **"🔎 Sàng lọc AI"** sang trang trên.

## 6. Xử lý lỗi

- AI lỗi/timeout → action trả lỗi mềm; UI toast + cho chạy lại.
- Không có ứng viên (hoặc tất cả đã rút) → báo "Chưa có ứng viên để sàng lọc".
- Structured output sai schema → Zod chặn ở `requestScreening` (throw) → action bắt, báo lỗi mềm.
- Phân quyền: chỉ RECRUITER chủ job chạy được và xem được trang; sai quyền → `notFound()`/lỗi.
- "Chuyển vào Sàng lọc" cho ứng viên đã rút/không hợp lệ → lỗi mềm từ `changeStatus`.

## 7. Kiểm thử

- **Unit (Vitest, TDD):**
  - `runScreening` core: lỗi khi rỗng; map `ref → application` đúng thứ tự; bỏ ref ngoài phạm vi; bỏ ref trùng (giữ lần đầu); nối ứng viên bị sót ở cuối với `score: null` + reason mặc định; gọi `saveScreening` với `result` đúng.
  - Zod `screeningResultSchema`: chấp nhận kết quả hợp lệ; từ chối thiếu trường/kiểu sai.
- **Glue (action), UI, trang:** không unit-test (đúng chuẩn dự án); an toàn bằng `npx tsc --noEmit` + `npm test` xanh.

## 8. Cấu trúc thư mục (dự kiến)

```
/lib
  /ai
    screening-schema.ts     Zod schema kết quả + type
    screening-prompt.ts     SYSTEM prompt + buildScreeningPrompt(jd, applicants)
    request-screening.ts    requestScreening(prompt) -> gọi AI structured
  /applications
    screening.ts            runScreening core (DI) + types
    screening-actions.ts    "use server": runScreening(jobId)
    __tests__/screening.test.ts
/app/jobs/[id]/screening
  page.tsx                  trang bảng xếp hạng (SSR)
  ScreeningClient.tsx       nút chạy + nút chuyển vào Sàng lọc (client)
/prisma
  schema.prisma             thêm model Screening + quan hệ ngược
```

## 9. Thứ tự xây dựng (dự kiến)

1. Prisma `Screening` + quan hệ + `db push`.
2. Zod schema kết quả (`screening-schema.ts`) — TDD.
3. Core `runScreening` (map ref, sót, rỗng) — TDD.
4. Prompt + `requestScreening` (tái dùng pattern `requestEvaluation`).
5. Server action `runScreening(jobId)` (nạp ứng viên, cap 20, upsert).
6. Trang `/jobs/[id]/screening` + client (chạy + chuyển vào Sàng lọc) + link từ board.
