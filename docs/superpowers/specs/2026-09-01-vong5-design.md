# Vòng 5 — Hoàn thiện quản lý phỏng vấn

**Ngày:** 2026-09-01
**Tính năng:** Chi tiết lịch cho ứng viên (+.ics) · Sửa/huỷ lịch · Trang lịch sắp tới · Nhắc lịch (cron) + Kết quả phỏng vấn
**Trạng thái:** Approved, chờ implementation plan

---

## 1. Bối cảnh

Lịch phỏng vấn đã được xây **gần hoàn chỉnh phía NTD**. Đang có sẵn:

- `components/InterviewModal.tsx` — NTD đặt lịch (ngày/giờ/địa điểm/link/ghi chú) khi kéo ứng viên sang trạng thái INTERVIEW trên Kanban (`ApplicantsBoard`); nút "Bỏ qua" chỉ đổi trạng thái.
- `lib/applications/interview.ts` (`scheduleInterview` action) + `lib/applications/interview-logic.ts` (`runScheduleInterview` thuần) + test + gửi thông báo ứng viên (`createNotification`).
- Trang chi tiết ứng viên `/jobs/[id]/applicants/[appId]` hiển thị lịch đã đặt (read-only).
- Trang `/applications` (ứng viên) hiển thị **badge** "Có lịch phỏng vấn" (chưa có chi tiết).
- `CACHE_TAGS.applications` dùng cho revalidate.

**Khoảng trống Vòng 5 lấp:**
1. Ứng viên không xem được chi tiết lịch (chỉ badge).
2. Không sửa/huỷ lịch; không đặt lịch từ trang chi tiết ứng viên.
3. Không có trang tổng hợp lịch sắp tới.
4. Không nhắc lịch tự động; không ghi nhận kết quả phỏng vấn.

**Nguyên tắc:** tái dùng tối đa (`scheduleInterview`, `InterviewModal`, notifications); chỉ thêm phần thiếu.

---

## 2. Schema Changes (prisma db push)

Thêm 2 field vào model `Interview` hiện có:

```prisma
model Interview {
  // ...các field hiện có (id, applicationId @unique, scheduledAt, location, meetingLink, note, timestamps)...
  outcome        String    @default("")   // kết quả phỏng vấn, NTD tự ghi sau
  reminderSentAt DateTime?                 // đánh dấu đã gửi nhắc, tránh gửi lặp
}
```

- `outcome`: free-text. **Không** dùng enum PASSED/FAILED để tránh trùng luồng trạng thái đơn (INTERVIEW→OFFER/REJECTED đã ngầm thể hiện đậu/rớt).
- `reminderSentAt`: nullable; cron set khi đã nhắc.

Không thêm model mới.

---

## 3. Phần 1 — Chi tiết lịch cho ứng viên + .ics

### 3.1 Card chi tiết trên `/applications`

Thay badge "Có lịch phỏng vấn" bằng card đầy đủ khi `interview` tồn tại: thời gian (vi-VN `dateStyle: medium, timeStyle: short`), địa điểm, link meeting (mở tab mới), ghi chú. Bố cục giống card ở trang chi tiết ứng viên NTD. Query `/applications` bổ sung các field interview cần thiết (hiện chỉ select `scheduledAt`).

### 3.2 Nút "Thêm vào lịch" (.ics)

**Hàm thuần** `lib/applications/ics.ts`:
```typescript
export type IcsInput = {
  scheduledAt: Date;
  summary: string;      // "Phỏng vấn: {jobTitle}"
  location: string;
  description: string;  // ghi chú + link meeting
  uid: string;          // applicationId để ổn định
};
export function buildIcs(input: IcsInput): string;
// VCALENDAR/VEVENT: DTSTART = scheduledAt, DTEND = +1h; escape ký tự đặc biệt (, ; \n)
```

**Route** `app/api/applications/[id]/interview.ics/route.ts` — `GET`:
- Auth: cho phép **ứng viên chủ đơn** HOẶC **NTD chủ job**; ngoài ra 404.
- Lấy interview theo applicationId; nếu không có → 404.
- Trả `text/calendar; charset=utf-8`, header `Content-Disposition: attachment; filename="interview.ics"`.
- Nút trên card gọi link này (thẻ `<a href download>`).

---

## 4. Phần 2 — Sửa + huỷ lịch (NTD)

### 4.1 Sửa lịch

Trang chi tiết ứng viên thêm nút:
- "Đặt lịch phỏng vấn" khi chưa có interview.
- "Sửa lịch" khi đã có.

Cả hai mở `InterviewModal` (client). Bổ sung prop `initial?: { date; time; location; meetingLink; note }` để pre-fill; khi có `initial`, tiêu đề modal là "Sửa lịch phỏng vấn". `scheduleInterview` dùng upsert nên lưu = cập nhật. Vì trang chi tiết là Server Component, cần một wrapper client nhỏ (`ScheduleInterviewButton`) giữ state `open` và render modal.

**Lưu ý tương thích:** `InterviewModal` hiện luôn gọi `changeStatus(INTERVIEW)` sau khi lưu. Khi mở từ trang chi tiết cho đơn đã INTERVIEW, gọi lại `changeStatus(INTERVIEW)` là no-op/không đổi — chấp nhận được. Giữ hành vi hiện tại để không phá luồng Kanban.

### 4.2 Huỷ lịch

**Hàm thuần** `lib/applications/interview-logic.ts` (thêm vào file hiện có):
```typescript
export type CancelInterviewDeps = {
  findApplicationForRecruiter: (appId: string, recruiterId: string) => Promise<{ id: string; candidateId: string } | null>;
  deleteInterview: (applicationId: string) => Promise<void>;
  notifyCandidate: (candidateId: string, message: string, link: string) => Promise<void>;
};
export async function runCancelInterview(
  params: { applicationId: string; recruiterId: string; recruiterName: string },
  deps: CancelInterviewDeps,
): Promise<{ ok: boolean; error?: string }>;
// kiểm quyền → deleteInterview → notifyCandidate("... đã huỷ lịch phỏng vấn", "/applications"); notify lỗi không làm hỏng kết quả
```

**Action** `cancelInterview(applicationId)` trong `lib/applications/interview.ts` — kiểm session RECRUITER, wire deps (prisma delete + createNotification), `revalidateTag(CACHE_TAGS.applications, "max")`.

- Không đổi trạng thái đơn (giữ INTERVIEW).
- Nút "Huỷ lịch" trên trang chi tiết ứng viên (client, có xác nhận `confirm`), chỉ hiện khi có interview.

---

## 5. Phần 3 — Trang "Lịch phỏng vấn sắp tới" (`/interviews`)

Server Component, cho cả hai vai trò; lọc `scheduledAt >= now`, sắp xếp tăng dần.

**Hàm thuần** `lib/applications/upcoming.ts`:
```typescript
export type UpcomingRow = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  counterpartName: string;   // ứng viên: tên NTD/công ty; NTD: tên ứng viên
  scheduledAt: Date;
  location: string;
  meetingLink: string;
};
export type UpcomingDeps = {
  listForCandidate: (candidateId: string, now: Date) => Promise<RawInterview[]>;
  listForRecruiter: (recruiterId: string, now: Date) => Promise<RawInterview[]>;
};
export async function getUpcomingInterviews(
  userId: string, role: "CANDIDATE" | "RECRUITER", now: Date, deps: UpcomingDeps,
): Promise<UpcomingRow[]>;
// chọn dep theo role, map RawInterview → UpcomingRow, sort scheduledAt asc
```

**Trang:**
- CANDIDATE: mỗi mục — job + công ty, thời gian, địa điểm/link, nút "Thêm vào lịch" (.ics), link "Nhắn tin".
- RECRUITER: mỗi mục — tên ứng viên + job, thời gian, link tới `/jobs/[id]/applicants/[appId]`.
- EmptyState khi rỗng.
- ADMIN vào `/interviews` → redirect `/dashboard` (ngoài phạm vi).

**Navbar:** thêm link "Lịch phỏng vấn" (`/interviews`) vào `NavLinks` + `MobileNavLinks` cho CANDIDATE và RECRUITER.

---

## 6. Phần 4 — Nhắc lịch (cron) + Kết quả

### 6.1 Nhắc lịch tự động

**Hàm thuần** `lib/applications/reminders.ts`:
```typescript
export type DueInterview = { applicationId: string; candidateId: string; recruiterId: string; jobTitle: string; scheduledAt: Date };
export function selectDueReminders(interviews: DueInterview[], now: Date): DueInterview[];
// chọn interview có now <= scheduledAt <= now+24h (đầu vào đã lọc reminderSentAt == null); trả danh sách cần nhắc
```

**Route** `app/api/cron/interview-reminders/route.ts` — `GET`:
- Bảo vệ: header `Authorization: Bearer ${process.env.CRON_SECRET}`; sai/thiếu → 401.
- Query interview có `reminderSentAt == null` và `scheduledAt` trong `[now, now+24h]` (kèm application → candidateId, job.userId, job.title).
- Chạy `selectDueReminders`; với mỗi mục: `createNotification` cho **cả** candidate và recruiter ("Nhắc: phỏng vấn {job} vào {giờ}", link `/interviews`), rồi set `reminderSentAt = now`.
- Trả `{ sent: number }`.

**Hạ tầng:**
- `vercel.json` mới:
  ```json
  { "crons": [{ "path": "/api/cron/interview-reminders", "schedule": "0 * * * *" }] }
  ```
- Thêm `CRON_SECRET` vào `.env.example`.
- **Lưu ý:** chỉ chạy thật trên Vercel Cron (production). Ở dev gọi tay: `curl -H "Authorization: Bearer <secret>" localhost:3000/api/cron/interview-reminders`. Sẽ ghi rõ trong plan.

### 6.2 Kết quả phỏng vấn

**Hàm thuần** `lib/applications/interview-logic.ts` (thêm):
```typescript
export type SaveOutcomeDeps = {
  findApplicationForRecruiter: (appId: string, recruiterId: string) => Promise<{ id: string } | null>;
  updateOutcome: (applicationId: string, outcome: string) => Promise<void>;
};
export async function runSaveOutcome(
  params: { applicationId: string; recruiterId: string; outcome: string },
  deps: SaveOutcomeDeps,
): Promise<{ ok: boolean; error?: string }>;
// kiểm quyền → updateOutcome (trim, tối đa 1000 ký tự)
```

**Action** `saveInterviewOutcome(applicationId, outcome)` — session RECRUITER, wire prisma, revalidate.

**UI:** trang chi tiết ứng viên — trong/khi có card "Lịch phỏng vấn", thêm ô Textarea "Kết quả phỏng vấn" + nút Lưu (client wrapper). Hiển thị `outcome` nếu đã có.

---

## 7. Error Handling

| Tình huống | Xử lý |
|---|---|
| Ứng viên/khách tải .ics đơn không phải của mình | Route trả 404 |
| Huỷ/sửa lịch bởi NTD không phải chủ job | Action trả `{ ok:false, error:"Không tìm thấy đơn ứng tuyển" }` |
| Cron gọi thiếu/sai secret | 401 |
| Thông báo (notify) lỗi | Bọc try/catch, không làm hỏng việc lưu/huỷ (như `runScheduleInterview` hiện có) |
| `/interviews` chưa có lịch | EmptyState |
| Kết quả > 1000 ký tự | Cắt/từ chối trong hàm thuần |

---

## 8. Testing

**Unit (vitest, dep injection):**
- `buildIcs`: có VCALENDAR/VEVENT, DTEND = DTSTART+1h, escape `,`/`;`/`\n`.
- `runCancelInterview`: quyền hợp lệ → delete + notify; không phải chủ → error; notify lỗi → vẫn ok.
- `getUpcomingInterviews`: chọn đúng dep theo role, sort tăng dần, map field đúng.
- `selectDueReminders`: trong 24h → chọn; quá 24h hoặc đã qua → bỏ; biên đúng.
- `runSaveOutcome`: quyền; trim + giới hạn 1000 ký tự.

**Kiểm thủ công / route:**
- `.ics` mở được bằng Google Calendar.
- Cron: gọi tay với secret đúng/sai → 200/401.
- Ứng viên thấy card chi tiết; NTD sửa/huỷ được; trang `/interviews` hiện đúng cho từng vai trò.

---

## 9. Phạm vi không làm (YAGNI)

- Không đồng bộ 2 chiều với Google Calendar (chỉ xuất .ics 1 chiều).
- Không nhắc qua email/SMS (chỉ notification in-app; email digest để Vòng sau).
- Không nhiều mốc nhắc (chỉ 1 lần trong 24h trước).
- Không enum kết quả đậu/rớt (dùng free-text + luồng trạng thái đơn).
- Không lịch lặp lại / nhiều vòng phỏng vấn cho một đơn (1 Interview / 1 Application như schema hiện tại).
- Không huỷ tự đổi trạng thái đơn.
