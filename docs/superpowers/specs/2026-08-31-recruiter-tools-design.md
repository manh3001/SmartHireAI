# Recruiter Tools — Vòng 2 Design Spec

**Ngày:** 2026-08-31  
**Tính năng:** Ghi chú nội bộ ứng viên · Lịch phỏng vấn · Tìm kiếm ứng viên chủ động  
**Trạng thái:** Approved, chờ implementation plan

---

## 1. Bối cảnh

Vòng 2 bổ sung công cụ cho nhà tuyển dụng (RECRUITER):

1. **Ghi chú nội bộ** — NTD ghi note riêng trên từng đơn ứng tuyển, ứng viên không thấy
2. **Lịch phỏng vấn** — đặt ngày giờ + địa điểm khi chuyển sang `INTERVIEW`, gửi thông báo in-app
3. **Tìm kiếm ứng viên** — trang `/candidates` tìm CV công khai (shareToken != null từ Vòng 1) theo từ khóa + bộ lọc

**Phụ thuộc Vòng 1:** Tìm kiếm ứng viên dùng `CV.shareToken` đã có từ Vòng 1 (đã merge).

---

## 2. Schema Changes

### Model mới `ApplicantNote`

```prisma
model ApplicantNote {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  recruiterId   String
  recruiter     User        @relation(fields: [recruiterId], references: [id], onDelete: Cascade)
  content       String
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}
```

- Nhiều note / application (append-only — không edit/xóa, giữ lịch sử)
- Cascade xóa khi Application hoặc User bị xóa

### Model mới `Interview`

```prisma
model Interview {
  id            String      @id @default(cuid())
  applicationId String      @unique
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  scheduledAt   DateTime
  location      String      @default("")
  meetingLink   String      @default("")
  note          String      @default("")
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}
```

- `@unique` trên `applicationId` — 1 lịch / đơn (upsert ghi đè khi reschedule)
- `location` và `meetingLink` là 2 trường riêng (NTD điền một hoặc cả hai)
- Không có trạng thái confirm của ứng viên (YAGNI)

### Cập nhật `Application` relation

Thêm vào model `Application` trong schema:
```prisma
notes      ApplicantNote[]
interview  Interview?
```

### Không thêm model mới cho Candidate Search

Query trực tiếp bảng `CV` lọc `shareToken != null`.

---

## 3. Ghi chú nội bộ ứng viên

### Vị trí

Trang `/jobs/[id]/applicants/[appId]` — panel "Ghi chú nội bộ" phía dưới CV snapshot.

### UX

```
┌─────────────────────────────────────────┐
│  Ghi chú nội bộ          [Chỉ NTD thấy]│
├─────────────────────────────────────────┤
│  [09/08] "Ứng viên có kinh nghiệm      │
│   React tốt, cần hỏi thêm về system    │
│   design."                              │
│                                         │
│  [31/08] "Đã gọi điện, hẹn phỏng vấn" │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │ Thêm ghi chú...                 │   │
│  └─────────────────────────────────┘   │
│                        [Lưu ghi chú]   │
└─────────────────────────────────────────┘
```

### Luồng

- NTD nhập text → "Lưu ghi chú" → tạo `ApplicantNote` mới
- **Append-only:** không có nút edit/xóa — intentional để giữ lịch sử
- Danh sách hiển thị thứ tự tăng dần (cũ nhất trên cùng)
- Ứng viên không thấy ghi chú này ở bất kỳ route nào

### Server action

`addNote(applicationId: string, content: string): Promise<{ ok: boolean; error?: string }>`
- Verify NTD là chủ job của application đó (qua `job.userId === session.user.id`)
- Max 2000 ký tự
- `revalidateTag` sau khi lưu

### Trang chi tiết ứng viên — data fetch

Page load thêm query:
```typescript
prisma.applicantNote.findMany({
  where: { applicationId },
  orderBy: { createdAt: "asc" },
  select: { id: true, content: true, createdAt: true },
})
```

---

## 4. Lịch phỏng vấn

### Trigger

Khi NTD bấm chuyển ứng viên sang `INTERVIEW` trên kanban board (`/jobs/[id]/applicants`), hiện modal đặt lịch.

### Modal UX

```
┌──────────────────────────────────────┐
│  Đặt lịch phỏng vấn (không bắt buộc)│
├──────────────────────────────────────┤
│  Ngày giờ *                          │
│  [  2026-09-10  ] [  09:00  ]        │
│                                      │
│  Địa điểm / Link meeting             │
│  [ meet.google.com/abc-def-ghi     ] │
│                                      │
│  Ghi chú thêm                        │
│  [ Phỏng vấn kỹ thuật 45 phút...  ] │
│                                      │
│  [Bỏ qua]              [Lưu lịch]   │
└──────────────────────────────────────┘
```

- **Bỏ qua** → chuyển trạng thái bình thường, không tạo `Interview`
- **Lưu lịch** → upsert `Interview` + gửi `Notification` in-app cho ứng viên
- Nếu đã có `Interview` trước (reschedule) → modal pre-filled với dữ liệu cũ

### Notification gửi cho ứng viên

Nội dung: `"Bạn có lịch phỏng vấn với [tên công ty / tên NTD] vào [ngày] lúc [giờ]"`  
Link thông báo: `/applications` (trang đơn ứng tuyển của ứng viên)

### Hiển thị lịch

- **Trang chi tiết ứng viên** `/jobs/[id]/applicants/[appId]`: hiện card lịch phỏng vấn nếu tồn tại (ngày giờ, địa điểm/link, ghi chú)
- **Trang `/applications` của ứng viên**: badge "Có lịch phỏng vấn" trên card đơn nếu `Interview` tồn tại

### Server action

`scheduleInterview(applicationId: string, data: { scheduledAt: Date; location: string; meetingLink: string; note: string }): Promise<{ ok: boolean; error?: string }>`
- Verify NTD là chủ job
- Upsert `Interview`
- Gọi `createNotification` cho candidateId

### Luồng trong ApplicantsBoard

Hiện tại `changeStatus` trong `lib/applications/actions.ts` xử lý việc đổi trạng thái. Cần:
1. Khi status mới = `INTERVIEW` → board hiện modal thay vì gọi `changeStatus` ngay
2. Modal submit → gọi `scheduleInterview` (nếu có lịch) + `changeStatus`
3. "Bỏ qua" → gọi `changeStatus` trực tiếp

---

## 5. Tìm kiếm ứng viên chủ động

### Route

`/candidates` — chỉ RECRUITER, redirect `/login` nếu chưa đăng nhập, redirect `/dashboard` nếu là CANDIDATE/ADMIN

### UX

```
┌─────────────────────────────────────────┐
│  Tìm ứng viên                           │
│  [🔍 React, Node.js, Hà Nội...    ] [Tìm]│
│  Kinh nghiệm: [Tất cả ▼]               │
├─────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐    │
│  │[Avatar] Nguyễn A│ │[Avatar] Trần B │
│  │ Frontend Dev   │ │ Fullstack     │  │
│  │ 📍 Hà Nội     │ │ 📍 HCM       │  │
│  │ React, TS, ...│ │ Node, React  │  │
│  │    [Xem CV →] │ │  [Xem CV →]  │  │
│  └──────────────┘  └──────────────┘    │
│  Hiển thị 23 ứng viên                  │
└─────────────────────────────────────────┘
```

### Nguồn dữ liệu

CV có `shareToken IS NOT NULL` — chỉ CV ứng viên đã bật public share.

### Query logic

**Từ khóa** — `?q=react nodejs` — khớp `contains insensitive` trên các trường:
- `profile.fullName`
- `profile.headline`
- `profile.location`
- `profile.summary`
- `skills.name` (via `some`)

**Bộ lọc kinh nghiệm** — `?exp=0|1|3|5`:
- `0` = "Chưa có" → `_count.experiences == 0`
- `1` = "1–2 năm" → `_count.experiences >= 1 && <= 4`
- `3` = "3–5 năm" → `_count.experiences >= 3 && <= 8`  
- `5` = "5+ năm" → `_count.experiences >= 5`

*(Ước lượng từ số experience entries vì không lưu số năm cụ thể)*

**Cap:** `take: 50` — không pagination (YAGNI cho quy mô hiện tại)

### Hiển thị card ứng viên

Mỗi card hiển thị:
- Avatar (CompanyAvatar chữ cái)
- `profile.fullName`, `profile.headline`
- `profile.location` (nếu có)
- Tối đa 4 kỹ năng đầu tiên (`skills[0..3].name`)
- Nút "Xem CV →" → mở `/cv/share/[token]` trên tab mới

### Navbar

Thêm link "Ứng viên" (`/candidates`) vào Navbar, chỉ hiện với RECRUITER (cạnh "Tin tuyển dụng").

### Data layer

`lib/candidates/search.ts` — hàm thuần `searchCandidates({ q, exp }): Promise<CandidateCard[]>` (testable, không import auth).

---

## 6. Error Handling

| Tình huống | Xử lý |
|---|---|
| `addNote` — không phải chủ job | Action trả `{ ok: false, error }`, UI toast error |
| `addNote` — content rỗng hoặc >2000 ký tự | Client validate trước khi submit |
| `scheduleInterview` — scheduledAt trong quá khứ | Client warn nhưng không block (NTD có thể nhập lịch cũ) |
| `scheduleInterview` — notification thất bại | Nuốt lỗi (không làm hỏng luồng chính) |
| `/candidates` — không có ứng viên nào public | Hiện EmptyState "Chưa có ứng viên nào chia sẻ CV công khai" |

---

## 7. Testing

**Unit tests (vitest):**
- `addNote`: verify authorization (không phải chủ job), max length, happy path
- `scheduleInterview`: verify authorization, upsert behavior, notification created
- `searchCandidates`: keyword match, exp filter, empty result

**Integration (manual):**
- Trang chi tiết ứng viên: thêm note → xuất hiện trong list
- Kanban board: chuyển sang INTERVIEW → modal hiện → lưu lịch → thông báo cho ứng viên
- `/candidates`: tìm "react" → thấy CV có kỹ năng React; lọc "5+ năm" → chỉ thấy ứng viên nhiều experience
- Ứng viên không thấy note NTD ở bất kỳ trang nào

---

## 8. Phạm vi không làm (YAGNI)

- Không edit/xóa note (append-only by design)
- Không email notification cho lịch phỏng vấn (chỉ in-app)
- Không xác nhận lịch từ phía ứng viên
- Không tích hợp Google Calendar / Zoom
- Không pagination trên `/candidates` (cap 50)
- Không lưu lịch sử tìm kiếm
- Không gợi ý AI cho tìm kiếm ứng viên
- Không CANDIDATE/ADMIN truy cập `/candidates`
