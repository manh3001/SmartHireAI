# Thiết kế: Thông báo in-app (Gói E2)

**Ngày:** 2026-08-01
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)

## 1. Bối cảnh & Mục tiêu

Sau E1 (nhắn tin), các sự kiện quan trọng (đổi trạng thái đơn, tin nhắn mới, ứng tuyển mới) chưa được báo cho người liên quan. E2 (mảng cuối của lộ trình) thêm **thông báo in-app**: model thông báo, tạo thông báo tại các sự kiện, chuông đếm chưa đọc trên Navbar, và trang danh sách thông báo. Đây là gói cuối khép trọn lộ trình A–E.

## 2. Mô hình dữ liệu

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  message   String
  link      String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, read])
}
```
Quan hệ ngược: `User.notifications Notification[]`. `message` là nội dung tiếng Việt dựng sẵn; `link` là đích khi bấm; `read` cờ đã đọc; index `[userId, read]` để đếm chưa đọc nhanh.

## 3. Bộ dựng nội dung thuần `lib/notifications/messages.ts` (TDD)

Ba hàm thuần, trả `{ message: string; link: string }`:
- `statusChangeNotification(jobTitle: string, statusLabel: string)` →
  - message: `Đơn ứng tuyển "<jobTitle>" đã chuyển sang "<statusLabel>"`
  - link: `/applications`
- `newMessageNotification(senderName: string, jobTitle: string, applicationId: string)` →
  - message: `<senderName> đã nhắn tin cho bạn về "<jobTitle>"`
  - link: `/messages/<applicationId>`
- `newApplicationNotification(candidateName: string, jobTitle: string, jobId: string)` →
  - message: `<candidateName> đã ứng tuyển "<jobTitle>"`
  - link: `/jobs/<jobId>/applicants`

Người gọi truyền tiêu đề hiển thị (đã xử lý rỗng, ví dụ `job.title || "(chưa có tiêu đề)"`).

## 4. Tạo thông báo tại sự kiện

### 4.1 Helper `lib/notifications/create.ts`
- `createNotification(userId: string, data: { message: string; link: string }): Promise<void>` — mỏng, `prisma.notification.create`.

### 4.2 Gắn vào 3 sự kiện có sẵn (người nhận luôn là **đối phương**)
- `changeStatus` (`lib/applications/actions.ts`): sau khi đổi trạng thái thành công → thông báo cho **ứng viên** (`application.candidateId`) bằng `statusChangeNotification(jobTitle, STATUS_LABELS[toStatus])`. Cần nạp thêm `candidateId` + `job.title` của đơn.
- `sendMessage` (`lib/messages/actions.ts`): sau khi tạo tin → thông báo cho **người còn lại** trong đơn (nếu người gửi là ứng viên → NTD = `job.userId`; ngược lại → ứng viên = `candidateId`) bằng `newMessageNotification(tên người gửi, job.title, applicationId)`. Cần nạp thêm `job.title` + tên người gửi (từ session).
- `submitApplication` (`lib/applications/actions.ts`): sau khi tạo đơn → thông báo cho **NTD chủ tin** (`job.userId`) bằng `newApplicationNotification(tên ứng viên, job.title, jobId)`. Cần nạp thêm `job.userId` + `job.title` + tên ứng viên (từ session).

**An toàn:** lỗi khi tạo thông báo được bọc `try/catch` và **không** làm hỏng hành động chính (đổi trạng thái/gửi tin/nộp đơn vẫn thành công dù thông báo lỗi).

## 5. Chuông trên Navbar

- Trong `components/Navbar.tsx` (server, đã có `auth()`): khi đăng nhập, đếm chưa đọc `prisma.notification.count({ where: { userId, read: false } })`.
- Hiện icon chuông (lucide `Bell`) link tới `/notifications`; nếu số chưa đọc > 0 → badge nhỏ hiển thị số (giới hạn hiển thị "9+" nếu > 9). Cập nhật mỗi lần tải trang (không realtime).

## 6. Trang `/notifications` + actions

### 6.1 Actions `lib/notifications/actions.ts`
- `markNotificationRead(id: string): Promise<void>` — `updateMany({ where: { id, userId }, data: { read: true } })` (chỉ của mình); `revalidatePath("/notifications")`.
- `markAllNotificationsRead(): Promise<void>` — `updateMany({ where: { userId, read: false }, data: { read: true } })`; `revalidatePath("/notifications")`.

### 6.2 Trang `app/notifications/page.tsx` (SSR, `force-dynamic`)
- Yêu cầu đăng nhập. Nạp thông báo của `userId`, mới nhất trước.
- Rỗng → thông báo "Chưa có thông báo nào".
- Có nút **"Đánh dấu tất cả đã đọc"** (client, gọi `markAllNotificationsRead` → `router.refresh`).
- Mỗi mục là client `NotificationItem`: hiển thị message + thời gian; chưa đọc → nền nổi bật; bấm → gọi `markNotificationRead(id)` rồi `router.push(link)`.

## 7. Xử lý lỗi & phân quyền

- `markNotificationRead`/`markAllNotificationsRead` chỉ sửa thông báo của người đăng nhập (scope `userId`); id không thuộc mình → không đổi gì (updateMany trả count 0), không lỗi.
- Tạo thông báo lỗi → nuốt lỗi mềm, không ảnh hưởng hành động chính.
- Không tự thông báo cho chính mình (người nhận luôn là đối phương của sự kiện).

## 8. Ranh giới (YAGNI)

- Không realtime/push/email; không gộp/nhóm thông báo; không xoá thông báo; không phân loại theo type/icon (chỉ message + link).

## 9. Kiểm thử

- **Unit (Vitest, TDD):** ba bộ dựng nội dung `messages.ts` — message + link đúng cho từng sự kiện (kèm chèn đúng tham số).
- **Glue (create/actions, tích hợp sự kiện)/UI/trang/navbar:** không unit-test (chuẩn dự án); an toàn bằng `npx tsc --noEmit` + `npm test` xanh.

## 10. Cấu trúc thư mục (dự kiến)

```
/prisma
  schema.prisma                 thêm model Notification + quan hệ ngược + index
/lib/notifications
  messages.ts                   3 bộ dựng nội dung (thuần)
  create.ts                     createNotification helper
  actions.ts                    "use server": markNotificationRead, markAllNotificationsRead
  __tests__/messages.test.ts
/app/notifications
  page.tsx                      trang danh sách (SSR)
  NotificationItem.tsx          mục thông báo (client)
  MarkAllButton.tsx             nút đánh dấu tất cả (client)
/components/Navbar.tsx          chuông + badge chưa đọc (sửa)
/lib/applications/actions.ts    changeStatus + submitApplication tạo thông báo (sửa)
/lib/messages/actions.ts        sendMessage tạo thông báo (sửa)
```

## 11. Thứ tự xây dựng (dự kiến)

1. Prisma `Notification` + quan hệ + index + `db push`.
2. `messages.ts` (3 bộ dựng) — TDD.
3. `create.ts` + gắn thông báo vào `changeStatus`, `sendMessage`, `submitApplication`.
4. `actions.ts` (mark read / mark all).
5. Chuông + badge trên Navbar.
6. Trang `/notifications` + `NotificationItem` + `MarkAllButton`.
