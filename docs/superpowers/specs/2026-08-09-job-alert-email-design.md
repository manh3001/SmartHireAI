# Email cho Job Alert — Design Spec

**Ngày:** 2026-08-09

## Mục tiêu

Bổ sung **email** cho thông báo việc làm: khi NTD đăng tin công khai mới khớp alert của ứng viên, ngoài thông báo in-app (đã có), gửi thêm email cho ứng viên đã bật email cho alert đó. Gửi qua Resend REST API, cấu hình bằng env-var, **degrade mềm** — chưa cấu hình thì bỏ qua email êm, in-app vẫn chạy, đăng tin không bao giờ bị cản.

## Quyết định thiết kế (đã chốt khi brainstorm)

- **Nhà cung cấp:** Resend qua REST (`fetch`), **không thêm dependency**. Đọc `RESEND_API_KEY` + `EMAIL_FROM` từ env; thiếu → bỏ qua gửi (log nhẹ), không ném lỗi.
- **Opt-in:** mỗi `JobAlert` có `emailEnabled Boolean @default(true)`; công tắc "Gửi email" ở `/jobs/alerts`. Alert bật thì chủ nhân nhận email.
- **Trigger:** cùng hook lúc đăng tin (`notifyMatchingAlerts`), gửi ngay song song in-app. Không cron, không digest.
- **Link tuyệt đối:** email cần URL đầy đủ → thêm env `APP_URL` (fallback `http://localhost:3000`).

## Phạm vi

**Trong phạm vi:** transport email (Resend REST, degrade mềm); builder nội dung email thuần; cột `emailEnabled` trên `JobAlert`; mở rộng `notifyMatchingAlerts` gửi email cho tập con opt-in; công tắc email ở `/jobs/alerts`; biến env + `.env.example`.

**Ngoài phạm vi:** email cho thông báo khác (tin nhắn, trạng thái đơn...); digest/cron; template engine/React Email; theo dõi mở/click; hủy đăng ký qua link (dùng công tắc in-app là đủ); đổi luồng in-app hiện có.

## Kiến trúc

### 1. Transport email (`lib/email/send.ts`)

```ts
export function isEmailConfigured(): boolean; // true khi có RESEND_API_KEY && EMAIL_FROM

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; skipped?: boolean }>;
```

- `isEmailConfigured`: `!!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM`.
- `sendEmail`:
  - Chưa cấu hình → `{ ok: true, skipped: true }` (không gọi mạng).
  - Có cấu hình → `fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }) })`. HTTP không ok → `{ ok: false }`. Bọc try/catch, lỗi → `{ ok: false }`. Không ném.
- Không dependency mới (dùng `fetch` toàn cục của Node/Next 16).

### 2. Nội dung email thuần (`lib/email/job-alert-email.ts`)

```ts
export function buildJobAlertEmail(
  job: { id: string; title: string; company: string; location: string | null; salaryMin: number | null; salaryMax: number | null },
  appUrl: string,
): { subject: string; html: string };
```

- `subject = "Việc làm mới khớp thông báo: " + job.title`.
- `html`: tiêu đề (h2), dòng công ty; nếu `location` có → dòng địa điểm; nếu `formatSalary(salaryMin, salaryMax, false)` khác null → dòng lương (tái dùng `lib/jobs/salary.ts`); một nút/link `<a href="{appUrl}/jobs/{id}">Xem chi tiết</a>`; chân trang "Bạn nhận email này vì đã bật thông báo việc làm trên SmartHire." Nội dung tiếng Việt, HTML inline đơn giản (không CSS ngoài).
- Hàm thuần → unit-test. `appUrl` truyền vào từ lớp gọi (đọc env ở đó).

### 3. Schema (`prisma/schema.prisma`)

Thêm vào `model JobAlert`:

```prisma
  emailEnabled    Boolean          @default(true)
```

Đồng bộ `npm run db:push` (chỉ thêm cột có default, an toàn). Alert cũ mặc định bật email.

### 4. Nối vào `notifyMatchingAlerts` (`lib/jobs/alert-notify.ts`)

- `select` alert thêm `emailEnabled`.
- Đổi vòng lặp gom recipient thành 2 tập:
  - `inAppRecipients: Set<string>` — mọi user có alert khớp (loại người đăng) — như hiện tại.
  - `emailRecipients: Set<string>` — user có ≥1 alert khớp với `emailEnabled === true` (loại người đăng).
  - Bỏ tối ưu `if (recipients.has(userId)) continue;` (cần xét cờ email của từng alert); vẫn khử trùng bằng Set. Chạy `matchesAlert` mỗi alort một lần (chấp nhận được).
- **In-app:** tạo `Notification` cho `inAppRecipients` (không đổi hành vi).
- **Email:** nếu `isEmailConfigured()` và `emailRecipients.size > 0`:
  - `const appUrl = process.env.APP_URL || "http://localhost:3000";`
  - Truy `prisma.user.findMany({ where: { id: { in: [...emailRecipients] } }, select: { email: true } })`.
  - `const mail = buildJobAlertEmail(job, appUrl);` (dựng một lần).
  - `await Promise.all(users.map((u) => sendEmail({ to: u.email, subject: mail.subject, html: mail.html })));`
- Toàn bộ vẫn trong `try/catch` nuốt lỗi sẵn có — email lỗi không cản đăng tin.
- `NotifyJob` đã có `id/title/company/location/salaryMin/salaryMax` (đủ cho `buildJobAlertEmail`; bỏ qua `salaryNegotiable` cho email cho gọn).

### 5. UI opt-out mỗi alert (`/jobs/alerts`)

- **Server action** (`lib/jobs/alert-actions.ts`): `setAlertEmail(id: string, enabled: boolean): Promise<void>` — yêu cầu đăng nhập; `prisma.jobAlert.updateMany({ where: { id, userId }, data: { emailEnabled: enabled } })`; `revalidatePath("/jobs/alerts")`.
- **Trang `/jobs/alerts`**: `findMany` thêm `emailEnabled`; mỗi dòng thêm công tắc "Gửi email" phản ánh trạng thái.
- **Component client** `components/jobs/AlertEmailToggle.tsx`: nhận `{ id, enabled }`, checkbox gọi `setAlertEmail(id, !enabled)` trong `useTransition`.
- `createJobAlert` không đổi (cột default `true` lo phần khởi tạo).

### 6. Cấu hình env (`.env.example`)

Thêm (kèm chú thích tiếng Việt):

```
RESEND_API_KEY="re_... (lay tai resend.com; bo trong -> khong gui email, chi in-app)"
EMAIL_FROM="SmartHire <onboarding@resend.dev>"
APP_URL="http://localhost:3000"
```

`.env` thật do user điền khi sẵn sàng; chưa điền thì email tự bỏ qua.

## Cấu trúc file

**Tạo mới:**
- `lib/email/send.ts`
- `lib/email/job-alert-email.ts` + `lib/email/__tests__/job-alert-email.test.ts`
- `components/jobs/AlertEmailToggle.tsx`

**Sửa:**
- `prisma/schema.prisma` (`emailEnabled` trên `JobAlert`)
- `lib/jobs/alert-notify.ts` (2 tập recipient + gửi email)
- `lib/jobs/alert-actions.ts` (thêm `setAlertEmail`)
- `app/jobs/alerts/page.tsx` (công tắc email mỗi dòng)
- `.env.example`

## Kiểm thử

- **Unit (thuần):** `job-alert-email.test.ts` — `buildJobAlertEmail`: subject chứa `job.title`; html chứa `job.company` và link tuyệt đối `"{appUrl}/jobs/{id}"`; có dòng lương khi truyền salary, không có khi null; có địa điểm khi truyền.
- **Không** unit-test `send.ts` / `isEmailConfigured` (đọc env + fetch), `notifyMatchingAlerts`, route/action/UI (theo quy ước — chỉ test logic thuần).
- `npm run lint` + `npm run build` xanh.
- **Kiểm thử tay (user):** điền `RESEND_API_KEY`/`EMAIL_FROM`/`APP_URL` → NTD đăng tin khớp → ứng viên (email bật) nhận email + in-app; tắt "Gửi email" 1 alert → chỉ in-app; chưa cấu hình key → không lỗi, chỉ in-app.

## Ràng buộc & quy ước

- Prisma **pinned v6**; chỉ thêm 1 cột có default, `db:push` (không migration tay).
- **Không thêm dependency** (Resend qua `fetch`).
- Email **degrade mềm**: thiếu cấu hình → bỏ qua êm; lỗi gửi → nuốt; **không bao giờ** cản đăng tin (giữ `try/catch` bao ngoài trong `notifyMatchingAlerts`).
- Tái dùng: `notifyMatchingAlerts`/`matchesAlert` (job-alerts), `formatSalary` (`lib/jobs/salary.ts`), `Notification`/`createNotification`.
- `className` nháy thẳng ASCII; nội dung tiếng Việt; **SmartHire**.
- Không đổi AI, auth, realtime, phân quyền, `CvInput`, luồng in-app hiện có.
- Windows: `npm test`, `npm run lint`, `npm run build`, `npm run db:push`.
