# Thiết kế Phase 4: Chatbot tư vấn (có ngữ cảnh CV)

**Ngày:** 2026-07-29
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)
**Tiền đề:** Nối tiếp Phase 1–3. Dùng lại Gemini + Zod + shadcn. Xem `2026-07-27-cv-ai-platform-design.md`.

## 1. Mục tiêu

Cho ứng viên trò chuyện với một chatbot AI để được tư vấn về CV và nghề nghiệp. Chatbot **biết ngữ cảnh CV cụ thể** đang mở và **kết quả đánh giá gần nhất** của CV đó, trả lời **streaming (chạy dần từng chữ)**, và **lưu lịch sử** để xem lại.

## 2. Nhà cung cấp AI

- Dùng lại **Gemini** (`gemini-2.5-flash`) qua SDK `openai` (endpoint tương thích OpenAI), bật `stream: true`.
- Key `GEMINI_API_KEY` trong `.env`, **chỉ gọi từ server**.

## 3. Phạm vi

**Trong phạm vi:**
- Chat gắn theo **từng CV**: mở từ trang CV, bot biết CV đó + đánh giá gần nhất.
- Trả lời **streaming**; hiển thị chữ chạy dần.
- **Lưu lịch sử** vào DB (`ChatSession` + `ChatMessage`); tải lại trang vẫn còn.
- Rate limit đơn giản mỗi user.
- Chỉ chủ CV chat/xem lịch sử CV của mình.

**Ngoài phạm vi (sau này):**
- Chat chung không gắn CV; chọn CV trong trang chat.
- Nhiều phiên chat mỗi CV (chỉ 1 phiên/CV).
- Đính kèm file, voice, v.v.

## 4. Kiến trúc & luồng

```
/cv/[id]/chat (client)
   │  gõ tin, bấm Gửi (chỉ gửi TIN MỚI)
   ▼
POST /api/cv/[id]/chat  ──► auth + rate limit
   │                     ──► lưu ChatMessage (user)
   │                     ──► nạp: CV + đánh giá gần nhất + lịch sử tin nhắn
   │                     ──► build messages (system + history + new)
   │                     ──► Gemini stream=true
   ▼ (đẩy từng đoạn text về client)
client hiển thị chữ chạy dần
   │
khi stream xong ──► server lưu ChatMessage (assistant)
```

- Client **không gửi cả lịch sử** — server tự đọc từ DB (nguồn sự thật).
- API route trả về **luồng văn bản thuần** (`ReadableStream`); client đọc `response.body` bằng reader.
- Mọi thao tác kiểm tra `userId` từ session.

## 5. Mô hình dữ liệu (thêm vào `prisma/schema.prisma`)

```prisma
enum ChatRole {
  USER
  ASSISTANT
}

model ChatSession {
  id        String        @id @default(cuid())
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  cvId      String
  cv        CV            @relation(fields: [cvId], references: [id], onDelete: Cascade)
  messages  ChatMessage[]
  createdAt DateTime      @default(now())
}

model ChatMessage {
  id        String      @id @default(cuid())
  sessionId String
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      ChatRole
  content   String
  createdAt DateTime    @default(now())
}
```

Thêm quan hệ ngược `chatSessions ChatSession[]` vào `User` và `CV`.

**Quyết định thiết kế:**
- Một `ChatSession` cho mỗi cặp (user, CV) — mở chat thì lấy phiên có sẵn hoặc tạo mới; không tạo nhiều phiên rối.
- Lưu tin assistant **sau khi stream xong** (khi đã có nội dung đầy đủ).
- `role` dùng enum `ChatRole` cho rõ ràng ở tầng DB.

## 6. Ngữ cảnh (system prompt)

`buildChatSystemPrompt(cv, evaluation?)` (hàm thuần) ghép:
- Vai trò: cố vấn nghề nghiệp thân thiện, trả lời bằng tiếng Việt, ngắn gọn, thực tế.
- Tóm tắt CV (họ tên, chức danh, kinh nghiệm, kỹ năng, dự án).
- Nếu CV đã có đánh giá gần nhất: điểm tổng + điểm mạnh/yếu + kỹ năng còn thiếu → để bot tư vấn sát.
- Nhắc bot chỉ tư vấn dựa trên ngữ cảnh, không bịa thông tin ngoài CV.

## 7. Xử lý lỗi & lạm dụng

- **Gemini lỗi/timeout/hết quota:** try/catch ở server; nếu lỗi trước khi stream, trả JSON lỗi + status; nếu lỗi giữa stream, kết thúc luồng và client hiện thông báo lỗi mềm.
- **Rate limit:** dùng lại `createRateLimiter` (vd tối đa N tin/phút mỗi user); vượt → 429 thân thiện.
- **Auth:** chỉ chủ CV; `ChatSession`/`ChatMessage` gắn theo user qua CV.
- **Thiếu API key:** báo lỗi rõ ràng (không crash).
- **Tin rỗng:** bỏ qua, không gọi model.

## 8. Kiểm thử (Vitest, TDD cho logic thuần)

- `buildChatSystemPrompt(cv, evaluation?)` — có/không có đánh giá; chứa tên, kỹ năng, điểm — TDD.
- (Tuỳ chọn) hàm ghép mảng `messages` từ lịch sử + tin mới — TDD nếu tách ra.
- Phần streaming + DB: kiểm tra bằng `tsc` + `build` + chạy thật (live) — nhất quán các phase trước; không mock stream.
- Không E2E browser.

## 9. Cấu trúc file (thêm mới)

```
/app
  /cv/[id]/chat/page.tsx        server: nạp CV + phiên + lịch sử tin nhắn
  /cv/[id]/chat/ChatClient.tsx  client: khung chat, gửi tin, đọc stream
  /api/cv/[id]/chat/route.ts    POST streaming: lưu user msg, gọi Gemini, lưu assistant msg
/lib
  /ai/chat.ts                   buildChatSystemPrompt (thuần, có test)
```

Sửa: `app/cv/[id]/CvEditor.tsx` — thêm nút "Chat tư vấn" (cạnh nút Đánh giá/PDF).

## 10. Giao diện

- Trang `/cv/[id]/chat`: khung tin nhắn cuộn được — tin người dùng bên phải (nền xanh, chữ trắng), tin bot bên trái (nền trắng, viền). Ô nhập + nút Gửi ở dưới. Chữ bot **chạy dần** khi stream. Có trạng thái "đang trả lời". Dùng shadcn + tông xanh hiện có.
- Nút "Chat tư vấn" ở trang sửa CV.

## 11. Thứ tự triển khai (plan sẽ chi tiết hóa)

1. Prisma: `ChatSession` + `ChatMessage` + enum + quan hệ, `db push`.
2. `buildChatSystemPrompt` (TDD).
3. API route streaming `/api/cv/[id]/chat` (lưu user → stream Gemini → lưu assistant + rate limit).
4. Trang chat `/cv/[id]/chat` + `ChatClient` (đọc stream, hiển thị) + nút vào chat.
