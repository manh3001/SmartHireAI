# Thiết kế: Nhắn tin theo đơn ứng tuyển (Gói E1)

**Ngày:** 2026-08-01
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)

## 1. Bối cảnh & Mục tiêu

Đơn ứng tuyển `Application` đã nối ứng viên ↔ NTD, nhưng hai bên chưa có kênh trao đổi. Gói E (mảng cuối của lộ trình) gồm nhắn tin và thông báo; **E1 làm nhắn tin trước** — luồng hội thoại giữa ứng viên và NTD gắn theo từng đơn ứng tuyển. Thông báo (E2) làm ở vòng sau, spec riêng; khi đó "tin nhắn mới" và "đổi trạng thái đơn" sẽ cùng bắn thông báo.

## 2. Mô hình dữ liệu

```prisma
model Message {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  senderId      String
  sender        User        @relation(fields: [senderId], references: [id], onDelete: Cascade)
  body          String
  createdAt     DateTime    @default(now())
}
```
Quan hệ ngược: `Application.messages Message[]`, `User.messages Message[]`.

Mỗi đơn ứng tuyển = một luồng hội thoại giữa **ứng viên** (`application.candidateId`) và **NTD chủ job** (`application.job.userId`). Đơn WITHDRAWN (rút mềm) vẫn giữ luồng; xoá đơn (không xảy ra ở luồng hiện tại) sẽ cascade xoá tin nhắn.

## 3. Logic thuần (test được — TDD)

### 3.1 `lib/messages/schema.ts`
- `messageSchema` (Zod): `body` bắt buộc (min 1, "Vui lòng nhập nội dung"), tối đa 2000 ký tự ("Tin nhắn tối đa 2000 ký tự").
- `type MessageInput = z.infer<typeof messageSchema>`.

### 3.2 `lib/messages/access.ts`
- `isThreadParticipant(userId: string, thread: { candidateId: string; recruiterId: string }): boolean` — true nếu `userId === candidateId || userId === recruiterId`. Dùng cho cả xem trang lẫn gửi tin.

## 4. Server action `lib/messages/actions.ts`

- `sendMessage(applicationId: string, body: string): Promise<{ ok: true } | { ok: false; error: string }>`:
  - `auth()`; chưa đăng nhập → lỗi.
  - Nạp đơn: `application.findUnique({ where: { id: applicationId }, select: { candidateId, job: { select: { userId } } } })`. Không có → lỗi "Không tìm thấy đơn ứng tuyển".
  - `isThreadParticipant(userId, { candidateId, recruiterId: job.userId })` — false → lỗi "Bạn không có quyền nhắn tin trong đơn này".
  - Validate `messageSchema` → sai → lỗi (thông điệp từ Zod).
  - Tạo `Message(applicationId, senderId = userId, body)`.
  - `revalidatePath(\`/messages/${applicationId}\`)`.

## 5. Trang hội thoại `/messages/[applicationId]`

- `app/messages/[applicationId]/page.tsx` (SSR, `force-dynamic`). `await params`.
- Yêu cầu đăng nhập. Nạp đơn kèm: `candidateId`, `candidate.name`, `job.userId`, `job.title`, `job.user.name`, `status`, và `messages` (orderBy createdAt asc, kèm `sender.name`, `senderId`).
- Phân quyền: `isThreadParticipant(userId, { candidateId, recruiterId: job.userId })` — false → `notFound()`.
- Header: tên đối phương (nếu tôi là ứng viên → tên NTD; nếu tôi là NTD → tên ứng viên) + tiêu đề job + nhãn trạng thái đơn (dùng `STATUS_LABELS`).
- Danh sách tin nhắn: bong bóng canh phải nếu `senderId === userId`, canh trái nếu của đối phương; kèm tên người gửi + giờ. Rỗng → gợi ý "Chưa có tin nhắn nào".
- Ô soạn: client component `MessageComposer` (`applicationId` prop) — textarea + nút gửi → gọi `sendMessage` → `router.refresh()` + toast; lỗi → toast.

## 6. Liên kết

- **"Ứng tuyển của tôi" (`/applications`):** mỗi đơn thêm link **"Nhắn tin"** → `/messages/[appId]`.
- **Chi tiết ứng viên của NTD (`/jobs/[id]/applicants/[appId]`):** thêm link **"Nhắn tin"** → `/messages/[appId]`.

## 7. Xử lý lỗi & phân quyền

- Người không phải ứng viên/NTD của đơn → `notFound()` (trang) hoặc lỗi mềm (action).
- `applicationId` không tồn tại → `notFound()` / lỗi.
- Body rỗng/quá dài → chặn bởi `messageSchema`, báo lỗi mềm.
- Cho nhắn ở mọi trạng thái đơn (không khoá theo HIRED/REJECTED/WITHDRAWN) — YAGNI.

## 8. Ranh giới (YAGNI, để E2)

- Chưa có thông báo, chưa đếm tin chưa đọc, chưa realtime (tải lại trang để thấy tin mới).
- Không sửa/xoá tin nhắn; không đính kèm file.

## 9. Kiểm thử

- **Unit (Vitest, TDD):**
  - `messageSchema`: chấp nhận body hợp lệ; từ chối rỗng; từ chối > 2000 ký tự.
  - `isThreadParticipant`: true cho candidateId và recruiterId; false cho người ngoài.
- **Glue (action)/UI/trang:** không unit-test (chuẩn dự án); an toàn bằng `npx tsc --noEmit` + `npm test` xanh.

## 10. Cấu trúc thư mục (dự kiến)

```
/prisma
  schema.prisma                 thêm model Message + quan hệ ngược (Application, User)
/lib/messages
  schema.ts                     Zod messageSchema
  access.ts                     isThreadParticipant (thuần)
  actions.ts                    "use server": sendMessage
  __tests__/schema.test.ts, __tests__/access.test.ts
/app/messages/[applicationId]
  page.tsx                      trang hội thoại (SSR)
  MessageComposer.tsx           ô soạn tin (client)
/app/applications/page.tsx      thêm link "Nhắn tin" (sửa)
/app/jobs/[id]/applicants/[appId]/page.tsx  thêm link "Nhắn tin" (sửa)
```

## 11. Thứ tự xây dựng (dự kiến)

1. Prisma `Message` + quan hệ + `db push`.
2. `messageSchema` (Zod) — TDD.
3. `isThreadParticipant` (thuần) — TDD.
4. `sendMessage` action.
5. Trang `/messages/[applicationId]` + `MessageComposer`.
6. Liên kết từ `/applications` + chi tiết ứng viên NTD.
