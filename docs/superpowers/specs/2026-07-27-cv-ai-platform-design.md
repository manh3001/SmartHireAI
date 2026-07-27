# Thiết kế: Nền tảng tìm việc kết hợp AI đánh giá & tạo CV

**Ngày:** 2026-07-27
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)

## 1. Bối cảnh & Mục tiêu

Dự án **portfolio cá nhân**, làm một mình, mục tiêu là một **bản demo chạy được** để gây ấn tượng với nhà tuyển dụng. Ưu tiên: chạy được và demo đẹp, dùng công nghệ phổ biến mà nhà tuyển dụng nhận ra, làm sâu vài chức năng "wow" thay vì làm hời hợt tất cả.

**Ngôi sao của sản phẩm:** Đánh giá CV bằng AI theo mô tả công việc (JD).

**Phạm vi chọn:** Hướng 1 — "Chuyên sâu phía ứng viên". Tập trung toàn bộ trải nghiệm ứng viên; phần nhà tuyển dụng chỉ ở mức tối giản để thể hiện ý tưởng kết nối hai bên.

## 2. Công nghệ (Stack)

- **Framework:** Next.js (App Router) — client + server (API routes) chung một repo, deploy Vercel.
- **Ngôn ngữ:** TypeScript.
- **Database:** PostgreSQL (Neon hoặc Supabase, free tier) + Prisma ORM.
- **Auth:** Auth.js (NextAuth) — email/password hoặc đăng nhập Google.
- **UI:** Tailwind CSS + shadcn/ui.
- **AI:** OpenAI API, gọi qua backend route; dùng Structured Outputs (JSON schema).
- **PDF:** xuất CV bằng `react-pdf`; parse PDF (stretch) bằng `pdf-parse`.
- **Validation:** Zod (dùng chung client + server).
- **Test:** Vitest.

## 3. Kiến trúc tổng thể

```
Browser (React/Next client)
        │
        ▼
Next.js App Router  ──►  API Routes (server)  ──►  OpenAI API
        │                      │
        │                      ▼
        │                 Prisma ORM
        │                      │
        ▼                      ▼
   Auth.js session        PostgreSQL (Neon)
```

- Toàn bộ chạy trong một Next.js app, deploy một lần lên Vercel.
- Mọi lệnh gọi OpenAI đi qua server route — API key nằm trong biến môi trường, không lộ ra client.
- Prisma + PostgreSQL giữ dữ liệu người dùng, CV, JD, kết quả đánh giá, lịch sử chat.

## 4. Phạm vi MVP

| # | Chức năng | Vai trò | Mức độ |
|---|-----------|---------|--------|
| 1 | Đăng ký / đăng nhập | Ứng viên | Cơ bản |
| 2 | Tạo/sửa CV qua form, xuất PDF | Ứng viên | Sâu |
| 3 | Đánh giá CV bằng AI theo JD (điểm, mạnh/yếu) | Ứng viên | Ngôi sao |
| 4 | Phân tích skill gap + gợi ý học | Ứng viên | Sâu |
| 5 | Chatbot AI tư vấn CV/nghề nghiệp (có ngữ cảnh CV) | Ứng viên | Vừa |
| 6 | Nhà tuyển dụng đăng JD tối giản | NTD | Tối giản |
| — | Upload PDF tự động điền form | Ứng viên | Stretch |
| — | Marketplace đầy đủ (ứng tuyển, lọc CV) | — | Ngoài phạm vi |

## 5. Mô hình dữ liệu (Prisma models)

```
User            — người dùng (ứng viên hoặc NTD)
  id, email, passwordHash, name, role (CANDIDATE | RECRUITER), createdAt

CV              — hồ sơ của ứng viên (một user có nhiều CV)
  id, userId → User, title, updatedAt

  Bảng con của CV:
  Profile       — họ tên, chức danh, email, phone, tóm tắt bản thân
  Experience[]  — công ty, vị trí, thời gian, mô tả
  Education[]   — trường, ngành, thời gian
  Skill[]       — tên kỹ năng, mức độ
  Project[]     — tên, mô tả, công nghệ, link

JobDescription  — JD do NTD đăng, hoặc ứng viên tự dán vào để đánh giá
  id, authorId → User, title, company, rawText, createdAt

Evaluation      — kết quả AI đánh giá 1 CV theo 1 JD
  id, cvId → CV, jobDescriptionId → JD, userId
  overallScore (0-100)
  strengths (JSON), weaknesses (JSON)
  skillGaps (JSON)          — kỹ năng còn thiếu + gợi ý học
  matchedKeywords (JSON), missingKeywords (JSON)
  rawModelOutput (JSON)     — lưu nguyên output để debug/hiển thị lại
  createdAt

ChatSession     — id, userId, createdAt
ChatMessage     — id, sessionId, role (user|assistant), content, createdAt
```

**Quyết định thiết kế:**

- CV tách thành các bảng con có cấu trúc → AI đánh giá chính xác hơn (dữ liệu sạch), tái dùng để xuất PDF.
- `Evaluation` được lưu lại (không tính rồi vứt) → xem lại lịch sử, demo không cần gọi API mỗi lần.
- `rawModelOutput` lưu nguyên JSON từ OpenAI → dễ debug khi kết quả bất thường.
- `JobDescription` dùng chung cho cả NTD đăng lẫn ứng viên tự dán JD.

## 6. Thiết kế phần AI

Cả 3 tính năng AI gọi OpenAI qua server route.

### 6.1 Đánh giá CV theo JD (Structured Output)

- **Đầu vào:** dữ liệu CV có cấu trúc (từ DB) + nội dung JD (text).
- **Cách gọi:** OpenAI Structured Outputs (`response_format` = `json_schema`) → ép model trả JSON đúng schema.
- **Schema kết quả:**
  ```json
  {
    "overallScore": 0,
    "strengths": ["..."],
    "weaknesses": ["..."],
    "matchedKeywords": ["..."],
    "missingKeywords": ["..."],
    "skillGaps": [
      { "skill": "...", "why": "...", "howToLearn": "...", "resource": "..." }
    ],
    "summary": "..."
  }
  ```
- **Model:** `gpt-4o-mini` mặc định (rẻ, đủ tốt); có thể chuyển `gpt-4o` khi cần sâu hơn.
- **Prompt:** vai trò chuyên gia tuyển dụng + CV + JD + yêu cầu chấm điểm khách quan theo tiêu chí.

### 6.2 Phân tích Skill Gap + gợi ý học

- Là một phần của cùng lời gọi 6.1 (`skillGaps` trong schema) → tiết kiệm 1 lần gọi API, dữ liệu nhất quán.
- UI hiển thị danh sách: kỹ năng thiếu → vì sao cần → học thế nào → gợi ý tài nguyên.

### 6.3 Chatbot tư vấn (có ngữ cảnh CV)

- Chat streaming qua server route (Vercel AI SDK).
- Nạp sẵn CV hiện tại + kết quả đánh giá gần nhất vào system prompt → trả lời đúng ngữ cảnh.
- Lưu lịch sử vào `ChatSession` / `ChatMessage`.

### 6.4 Vấn đề thực tế đã tính đến

- **Chi phí & lạm dụng:** rate limit đơn giản số lần đánh giá/phút mỗi user.
- **Độ trễ:** đánh giá mất vài giây → UI có trạng thái loading rõ ràng.
- **AI sai định dạng:** Structured Outputs giảm rủi ro; vẫn validate bằng Zod trước khi lưu; báo lỗi mềm.
- **Bảo mật key:** chỉ gọi từ server, key trong biến môi trường.

## 7. Xử lý lỗi

- **OpenAI lỗi/timeout/hết quota:** try/catch ở server route, trả mã lỗi rõ ràng; client hiện thông báo + nút thử lại.
- **Structured Output không hợp lệ:** validate bằng Zod trước khi lưu; sai schema → báo lỗi mềm, không crash.
- **Auth:** chặn route riêng tư nếu chưa đăng nhập; user chỉ xem/sửa CV của chính mình.
- **Form CV:** validate client + server bằng schema Zod dùng chung.

## 8. Kiểm thử

- **Unit test (Vitest):** hàm thuần — build prompt, validate schema Zod, tính hiển thị điểm.
- **Integration test:** API route đánh giá với OpenAI được mock (không tốn tiền, nhanh, ổn định).
- **Không** làm E2E browser test cho MVP (YAGNI).
- Áp dụng TDD cho logic cốt lõi (validate, xử lý kết quả AI).

## 9. Cấu trúc thư mục

```
/app
  /(auth)            đăng nhập, đăng ký
  /dashboard         trang chính ứng viên
  /cv/[id]           tạo/sửa CV
  /cv/[id]/evaluate  đánh giá theo JD + skill gap
  /chat              chatbot
  /api               route: /evaluate, /chat, /cv, /auth
/lib
  /ai                gọi OpenAI, prompt, schema Zod
  /db                Prisma client
  /pdf               xuất CV ra PDF
/prisma
  schema.prisma
/components           UI (shadcn/ui)
```

## 10. Thứ tự xây dựng

1. Khởi tạo dự án + DB + Auth (đăng nhập được).
2. CV builder (tạo/sửa/xem CV, xuất PDF).
3. Đánh giá CV bằng AI + skill gap (ngôi sao).
4. Chatbot có ngữ cảnh CV.
5. NTD đăng JD tối giản.
6. (Stretch) Upload PDF tự động điền.
