# Thiết kế Phase 3: AI đánh giá CV theo JD (chức năng "ngôi sao")

**Ngày:** 2026-07-28
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)
**Tiền đề:** Nối tiếp Phase 1 (auth) và Phase 2 (CV builder). Xem `2026-07-27-cv-ai-platform-design.md` cho thiết kế tổng thể.

## 1. Mục tiêu

Cho ứng viên dán một mô tả công việc (JD) và để AI **đánh giá độ phù hợp của CV** với JD đó: chấm điểm tổng, liệt kê điểm mạnh/yếu, từ khóa khớp/thiếu, và kỹ năng còn thiếu kèm gợi ý học. Đây là chức năng trọng tâm của sản phẩm.

## 2. Nhà cung cấp AI

- **Google Gemini API**, model **`gemini-2.5-flash`**, gọi qua **endpoint tương thích OpenAI** bằng SDK `openai` (base URL `https://generativelanguage.googleapis.com/v1beta/openai/`).
- Dùng **structured output** (`client.chat.completions.parse()` với **Zod schema** qua `zodResponseFormat`) để ép model trả JSON đúng cấu trúc — tái dùng Zod đã có từ Phase 2.
- Key `GEMINI_API_KEY` trong `.env`, **chỉ gọi từ server**, không lộ ra client.

> **Ghi chú quyết định:** ban đầu spec dự kiến dùng Claude (Haiku), nhưng cả Anthropic lẫn OpenAI đều không còn credit miễn phí thật (tài khoản mới $0). Đã chuyển sang **Gemini** vì có bậc miễn phí thật (không cần thẻ) và hỗ trợ JSON Schema tốt. Nhờ thiết kế tách dependencies (mục 4), việc đổi nhà cung cấp chỉ ảnh hưởng client + hàm gọi model.

## 3. Phạm vi

**Trong phạm vi:**
- Ô dán JD (text) + nút Đánh giá trên trang `/cv/[id]/evaluate`.
- Một lần gọi AI trả về đầy đủ: điểm, mạnh/yếu, từ khóa khớp/thiếu, skill gap + gợi ý học, tóm tắt.
- Lưu kết quả đánh giá vào DB; xem lại lịch sử đánh giá của mỗi CV.
- Rate limit đơn giản mỗi user (chống cháy credit).
- Kiểm soát quyền: chỉ chủ CV đánh giá/xem kết quả CV của mình.

**Ngoài phạm vi (Phase sau):**
- NTD đăng JD để ứng viên chọn (Phase 5).
- Chatbot tư vấn (Phase 4).
- Upload PDF (stretch).
- Streaming kết quả (đánh giá trả về một cục JSON, không cần streaming).

## 4. Kiến trúc & luồng

```
/cv/[id]/evaluate (client)
   │  dán JD, bấm Đánh giá
   ▼
Server Action / API route  ──►  build prompt (CV + JD)  ──►  Gemini 2.5 Flash (structured output)
   │                                                              │
   │  validate bằng Zod                                           ▼
   │                                                         JSON kết quả
   ▼
Prisma → PostgreSQL (lưu JobDescription + Evaluation)
   │
   ▼
Hiển thị kết quả + lịch sử
```

- Gọi Gemini qua **API route** (`/api/cv/[id]/evaluate`) — tách rõ ranh giới gọi AI; logic điều phối nhận dependencies để mock được khi test.
- Mọi thao tác kiểm tra `userId` từ session.

## 5. Mô hình dữ liệu (thêm vào `prisma/schema.prisma`)

```prisma
model JobDescription {
  id          String       @id @default(cuid())
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String       @default("")
  company     String       @default("")
  rawText     String
  evaluations Evaluation[]
  createdAt   DateTime     @default(now())
}

model Evaluation {
  id                String   @id @default(cuid())
  cvId              String
  cv                CV       @relation(fields: [cvId], references: [id], onDelete: Cascade)
  jobDescriptionId  String
  jobDescription    JobDescription @relation(fields: [jobDescriptionId], references: [id], onDelete: Cascade)
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  overallScore      Int
  strengths         Json
  weaknesses        Json
  matchedKeywords   Json
  missingKeywords   Json
  skillGaps         Json
  summary           String
  rawModelOutput    Json
  createdAt         DateTime @default(now())
}
```

Thêm quan hệ ngược vào `User` (`jobDescriptions`, `evaluations`) và `CV` (`evaluations`).

**Quyết định thiết kế:**
- Các mảng (`strengths`, `skillGaps`...) lưu kiểu `Json` — linh hoạt, khớp cấu trúc AI trả về.
- `rawModelOutput` lưu nguyên JSON từ model → dễ debug khi kết quả bất thường, hiển thị lại không cần gọi API.
- `Evaluation` được lưu (không tính rồi vứt) → xem lại lịch sử, demo không tốn credit mỗi lần.
- Skill gap nằm trong cùng một lần gọi AI (một trường `skillGaps` trong schema) → tiết kiệm 1 lần gọi, dữ liệu nhất quán.

## 6. Schema kết quả AI (Zod, dùng chung)

```
evaluationResultSchema = {
  overallScore: number (0-100),
  strengths: string[],
  weaknesses: string[],
  matchedKeywords: string[],
  missingKeywords: string[],
  skillGaps: { skill: string, why: string, howToLearn: string }[],
  summary: string
}
```

- Dùng cho `chat.completions.parse()` (ép model qua `zodResponseFormat`) và validate lại trước khi lưu.
- Prompt: vai trò chuyên gia tuyển dụng, nhận CV có cấu trúc (từ DB) + JD (text), chấm điểm khách quan theo tiêu chí, trả về đúng schema, viết bằng tiếng Việt.

## 7. Xử lý lỗi & lạm dụng

- **Gemini lỗi/timeout/hết quota:** try/catch ở server, trả mã lỗi rõ ràng; client hiện thông báo + nút thử lại.
- **Output không hợp lệ:** structured output giảm rủi ro; vẫn validate bằng Zod trước khi lưu; sai schema → báo lỗi mềm, không crash.
- **Rate limit:** giới hạn đơn giản số lần đánh giá mỗi user trong một khoảng thời gian (vd tối đa N lần/phút), lưu đếm trong bộ nhớ tiến trình hoặc bảng phụ; vượt → trả lỗi 429 thân thiện.
- **Auth:** chỉ chủ CV mới đánh giá/xem; JD và Evaluation gắn `userId`.
- **Thiếu API key:** nếu `GEMINI_API_KEY` chưa cấu hình, báo lỗi rõ ràng hướng dẫn thêm key (không crash server).

## 8. Kiểm thử (Vitest, TDD cho logic thuần)

- Hàm build prompt (ghép CV có cấu trúc + JD thành nội dung gửi model) — TDD.
- `evaluationResultSchema` (Zod): validate kết quả hợp lệ, từ chối thiếu trường/điểm ngoài 0-100 — TDD.
- Hàm chuyển kết quả model → dữ liệu lưu DB (map sang các trường Json) — TDD.
- Hàm tính hiển thị điểm (vd màu theo mức: đỏ/vàng/xanh) — TDD.
- **Điều phối `runCvEvaluation`** test với model + DB **được mock** (không tốn tiền, nhanh, ổn định) — kiểm tra: gọi đúng, lưu Evaluation, trả kết quả; nhánh lỗi model.
- Không E2E browser (YAGNI).

## 9. Cấu trúc file (thêm mới)

```
/app
  /cv/[id]/evaluate/page.tsx      trang đánh giá (server: nạp CV + lịch sử)
  /cv/[id]/evaluate/EvaluateClient.tsx   client: ô JD, nút, hiển thị kết quả
  /api/cv/[id]/evaluate/route.ts  gọi Gemini, validate, lưu, trả kết quả
/lib
  /ai/client.ts        khởi tạo OpenAI client trỏ tới Gemini + AI_MODEL
  /ai/prompt.ts        build prompt từ CV + JD (thuần, có test)
  /ai/schema.ts        evaluationResultSchema (Zod) + types
  /ai/evaluate.ts      logic gọi model + validate (nhận client để mock được)
  /ai/rate-limit.ts    rate limit đơn giản
  /ai/score.ts         tính hiển thị điểm (thuần, có test)
/components            hiển thị kết quả (điểm, mạnh/yếu, skill gap)
```

## 10. Giao diện

- Trang `/cv/[id]/evaluate`: ô `Textarea` dán JD (+ tuỳ chọn tiêu đề/công ty), nút **Đánh giá** với trạng thái loading rõ ràng.
- Khu kết quả: điểm tổng nổi bật (vòng tròn/thanh + màu theo mức), hai cột điểm mạnh/điểm yếu, dải từ khóa khớp (xanh) / thiếu (xám), bảng skill gap (kỹ năng → vì sao → học thế nào), đoạn tóm tắt.
- Danh sách lịch sử đánh giá của CV (điểm + ngày, bấm xem lại — đọc từ DB, không gọi lại API).
- Dùng shadcn/ui đã có.

## 11. Thứ tự triển khai (dự kiến, plan sẽ chi tiết hóa)

1. Prisma: thêm `JobDescription` + `Evaluation` + quan hệ, `db push`.
2. Cài `openai`; thêm `GEMINI_API_KEY` vào `.env` + `.env.example`.
3. `evaluationResultSchema` (Zod) + build prompt + score (TDD).
4. `evaluate.ts` gọi model (nhận client để mock) + validate (TDD với mock).
5. Rate limit đơn giản (TDD).
6. API route `/api/cv/[id]/evaluate` (integration test, model mock).
7. Trang `/cv/[id]/evaluate` + hiển thị kết quả + lịch sử.
