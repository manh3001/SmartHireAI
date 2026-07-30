# Thiết kế: Vòng ứng tuyển (Gói A — sàn hai chiều)

**Ngày:** 2026-07-30
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)

## 1. Bối cảnh & Mục tiêu

Dự án hiện làm sâu phía ứng viên (CV builder, đánh giá AI theo JD, skill gap, chatbot, import PDF) nhưng phía nhà tuyển dụng (NTD) mới ở mức tối giản: chỉ đăng JD (một ô `rawText` + cờ `isPublic`) và trang liệt kê jobs. Marketplace (ứng tuyển, lọc CV) trước đây bị đánh dấu "ngoài phạm vi".

**Mục tiêu gói A:** biến sản phẩm thành **sàn hai chiều thực sự** bằng cách xây **vòng ứng tuyển** — xương sống nối ứng viên và NTD. Ứng viên *ứng tuyển* vào tin tuyển dụng; NTD *quản lý ứng viên* theo pipeline trạng thái. Đây là gói đầu tiên trong lộ trình mở rộng; các gói sau (B: sàng lọc AI hàng loạt, C: tìm & gợi ý việc, D: hồ sơ công ty + JD có cấu trúc, E: nhắn tin/thông báo) sẽ có spec riêng.

Gói A là nền tảng: không có nó thì các gói sau không có gì để bám vào.

## 2. Quyết định data model

`JobDescription` hiện **kiêm hai việc**: (a) NTD đăng tin tuyển dụng, (b) ứng viên dán JD để đánh giá nhanh.

**Quyết định:** giữ nguyên `JobDescription` làm entity "tin tuyển dụng". Tin có `isPublic=true` là job **ứng tuyển được**; JD ứng viên tự dán vẫn `isPublic=false`, không hiện ra để ứng tuyển. Lý do:

- Ít đụng schema cũ, không phải migrate trang jobs hiện tại.
- Tận dụng luôn liên kết `Evaluation` sẵn có (điểm match dùng chung một mô hình).

**Phương án loại bỏ:** tách hẳn model `Job` mới, riêng biệt với `JobDescription`. Sạch hơn về ngữ nghĩa nhưng trùng lặp dữ liệu và tốn công migrate — không tương xứng lợi ích ở giai đoạn này.

## 3. Mô hình dữ liệu mới

```
Application
  id            String   @id
  jobId         String   → JobDescription   (job được ứng tuyển)
  candidateId   String   → User             (ứng viên)
  cvId          String   → CV               (CV được chọn để nộp)
  cvSnapshot    Json                         -- CHỤP dữ liệu CV tại thời điểm nộp
  coverLetter   String   @default("")
  status        ApplicationStatus @default(SUBMITTED)
  evaluationId  String?  → Evaluation        -- điểm match tính lúc nộp (tuỳ chọn)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  events        ApplicationEvent[]
  @@unique([jobId, candidateId])             -- chặn nộp trùng vào cùng một job

enum ApplicationStatus {
  SUBMITTED    -- Đã nộp
  SCREENING    -- Đang sàng lọc
  INTERVIEW    -- Phỏng vấn
  OFFER        -- Offer
  HIRED        -- Nhận
  REJECTED     -- Từ chối
}

ApplicationEvent            -- lịch sử đổi trạng thái (timeline)
  id             String   @id
  applicationId  String   → Application
  fromStatus     ApplicationStatus?   -- null khi tạo đơn
  toStatus       ApplicationStatus
  note           String   @default("")
  createdAt      DateTime @default(now())
```

**Quyết định thiết kế:**

- **`cvSnapshot` (chụp CV)**: lưu dữ liệu CV có cấu trúc tại thời điểm nộp. Nếu ứng viên sửa CV sau khi nộp, NTD vẫn thấy đúng bản đã ứng tuyển. Chuyên nghiệp hơn và tránh bug "CV đổi sau khi nộp". `cvId` vẫn giữ để tham chiếu nguồn, nhưng nội dung hiển thị lấy từ `cvSnapshot`.
- **`evaluationId`**: điểm match AI tính ngay lúc nộp (tái dùng engine `evaluate` sẵn có), NTD thấy luôn mà không cần bước sàng lọc riêng. Là tuỳ chọn (nullable) để đơn vẫn nộp được nếu AI lỗi.
- **`@@unique([jobId, candidateId])`**: một ứng viên chỉ nộp một đơn cho mỗi job.
- **`ApplicationEvent`**: mỗi lần đổi trạng thái ghi một bản ghi → dựng timeline "chi tiết" cho cả hai bên. Tạo đơn cũng ghi một event đầu (`fromStatus=null, toStatus=SUBMITTED`).

## 4. Luồng ứng viên

1. Trang job công khai (`isPublic=true`) hiển thị nút **"Ứng tuyển"** (ẩn/khoá nếu đã nộp hoặc chưa đăng nhập).
2. Form ứng tuyển:
   - **Chọn CV**: dropdown các CV của ứng viên (bắt buộc).
   - **"Xem điểm phù hợp"**: gọi AI (tái dùng `lib/ai/evaluate`) chấm CV đã chọn theo JD, hiện điểm + tóm tắt ngắn trước khi nộp. Không bắt buộc bấm.
   - **Cover letter**: ô nhập lời nhắn/thư ngắn (tuỳ chọn, nhập tay — không có AI viết hộ ở gói này).
   - **Nộp**: tạo `Application` (kèm `cvSnapshot`, `evaluationId` nếu đã tính điểm), ghi `ApplicationEvent` đầu.
3. Trang mới **"Ứng tuyển của tôi"**: danh sách job đã nộp + trạng thái hiện tại + timeline các bước. **Rút đơn** được khi trạng thái còn `SUBMITTED` hoặc `SCREENING`.

## 5. Luồng nhà tuyển dụng

1. Trang job của NTD có tab **"Ứng viên"**.
2. **Board kéo-thả 6 cột** theo `ApplicationStatus`. Mỗi thẻ hiển thị: tên ứng viên, điểm match AI (nếu có), nút xem CV đã nộp (`cvSnapshot`), cover letter.
3. Kéo thẻ sang cột khác = đổi trạng thái → cập nhật `Application.status` + ghi `ApplicationEvent`. Có thể kèm ghi chú (`note`) khi đổi.

## 6. Phân quyền & ranh giới (YAGNI)

- **Phân quyền:** ứng viên chỉ xem/rút đơn của chính mình; NTD chỉ xem & quản lý ứng viên của job do mình đăng. Chỉ ứng viên (`role=CANDIDATE`) mới ứng tuyển được; chỉ NTD mới thấy board.
- **Thông báo/email** khi đổi trạng thái → thuộc **gói E**. Ở gói A, ứng viên tự vào trang "Ứng tuyển của tôi" để xem.
- **Xếp hạng/sàng lọc AI hàng loạt** → thuộc **gói B**. Ở gói A, điểm match tính theo từng đơn lúc nộp.
- Không làm rút gọn/ẩn danh CV, không đánh giá lại tự động — ngoài phạm vi.

## 7. Xử lý lỗi

- **AI lỗi khi tính điểm match:** đơn vẫn nộp được với `evaluationId=null`; UI báo mềm "chưa tính được điểm", không chặn nộp.
- **Nộp trùng:** ràng buộc `@@unique` + kiểm tra trước ở server → báo "Bạn đã ứng tuyển job này".
- **Đổi trạng thái không hợp lệ / sai quyền:** server từ chối, trả lỗi rõ ràng.
- **Job không công khai / đã đóng:** không cho ứng tuyển.
- Validate form ứng tuyển bằng Zod dùng chung client + server.

## 8. Kiểm thử (theo chuẩn dự án)

- **Unit test (Vitest):** logic chuyển trạng thái (map bước hợp lệ), chặn nộp trùng, kiểm tra phân quyền (ứng viên vs NTD vs chủ job), tạo `ApplicationEvent` đúng.
- **Integration test:** action nộp đơn với AI được mock (không tốn tiền, ổn định); action đổi trạng thái ghi event.
- Áp dụng **TDD** cho logic cốt lõi (chuyển trạng thái, phân quyền, chặn trùng).
- Không làm E2E browser test (YAGNI, nhất quán với các phase trước).

## 9. Cấu trúc thư mục (dự kiến)

```
/app
  /jobs/[id]                trang job — thêm nút "Ứng tuyển" (ứng viên) / tab "Ứng viên" (NTD)
  /jobs/[id]/apply          form ứng tuyển
  /jobs/[id]/applicants     board kéo-thả (NTD)
  /applications             "Ứng tuyển của tôi" (ứng viên)
/lib
  /applications
    actions.ts              nộp đơn, rút đơn, đổi trạng thái (server actions)
    status.ts               logic chuyển trạng thái hợp lệ + nhãn tiếng Việt
    schema.ts               Zod schema form ứng tuyển
    __tests__/              unit test
/prisma
  schema.prisma             thêm Application, ApplicationEvent, ApplicationStatus
```

## 10. Thứ tự xây dựng (dự kiến)

1. Schema Prisma (Application, ApplicationEvent, enum) + `db push`.
2. Logic thuần + test: `status.ts` (chuyển trạng thái), `schema.ts` (Zod) — TDD.
3. Server actions: nộp đơn (kèm snapshot + điểm match), rút đơn, đổi trạng thái — test mock AI.
4. UI ứng viên: nút ứng tuyển + form + "Ứng tuyển của tôi".
5. UI NTD: tab ứng viên + board kéo-thả 6 cột.
6. Rà phân quyền + xử lý lỗi mềm.
