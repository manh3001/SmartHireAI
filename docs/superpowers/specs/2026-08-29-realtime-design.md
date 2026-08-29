# Gói E — Realtime: SSE + Status-Change Email + Web Push

- **Ngày**: 2026-08-29
- **Trạng thái**: Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh**: Vòng 5 của lộ trình "nâng cấp bám sát web tuyển dụng thật". Gói A–D đã merge. Gói E thêm real-time notifications (SSE thay polling), email khi status ứng tuyển thay đổi, và web push cho tất cả in-app notifications.

## 1. Mục tiêu & vấn đề hiện tại

**Mục tiêu**: giảm latency notification từ 12s polling → SSE 8s; email candidate khi status thay đổi; web push khi app đóng/nền.

**Hiện trạng**:
- `RealtimeProvider` dùng `setInterval(12000)` + `fetch("/api/realtime")` — mỗi 12s mở một HTTP connection mới.
- `lib/notifications/create.ts` không gọi `revalidateTag` → Navbar cache (60s TTL) không bị clear khi có notification mới.
- Email: chỉ có job-alert email; không có email khi status ứng tuyển thay đổi.
- Web push: zero infrastructure (không có service worker, không có `web-push` package, không có `PushSubscription` DB model).

**Phạm vi loại trừ**: không có polling fallback cho SSE (EventSource tự reconnect); không email cho status SUBMITTED/REVIEWING/WITHDRAWN; không push notification tùy chỉnh per-user (tất cả notification đều push).

## 2. Quyết định kiến trúc

**SSE approach**: Server polls DB trực tiếp mỗi 8s (KHÔNG dùng `unstable_cache`). Tránh stale data từ 60s TTL. `unstable_cache` vẫn giữ cho Navbar initial render — chỉ SSE bypass.

**Tại sao không Redis pub/sub**: Phức tạp hơn mà latency gain không đáng kể cho portfolio scope. SSE + 8s poll đủ.

**`revalidateTag` trong `createNotification`**: Bổ sung `revalidateTag(CACHE_TAGS.notifications, "max")` vào `lib/notifications/create.ts`. Hiện tại `revalidateTag` chỉ được gọi khi mark-read — không khi tạo mới. Fix này cần thiết cho cả SSE (freshness) và Navbar cache.

## 3. Kiến trúc chi tiết

### 3.1 SSE — Polling → EventSource

**Server: `app/api/realtime/route.ts`** (rewrite toàn bộ):
- Export `dynamic = "force-dynamic"` (giữ nguyên)
- Không set `runtime` — mặc định Node.js (đủ cho SSE streaming)
- Authenticate bằng `auth()` → 401 nếu không có session
- Export `getNotificationSignalRaw(userId: string)` từ `lib/notifications/poll.ts` — raw DB query không có cache
- `ReadableStream` với `start(controller)`:
  - Gọi `getNotificationSignalRaw` ngay lập tức, enqueue `data: {...}\n\n`
  - `setInterval(8000)`: gọi lại mỗi 8s, enqueue signal; nếu lỗi DB enqueue `: ping\n\n`
  - `req.signal.addEventListener("abort", cleanup)` để detect client disconnect
- `cancel()` callback: `clearInterval` + đánh dấu `closed`
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`

**Client: `components/RealtimeProvider.tsx`** (update):
- Xóa `setInterval` + `fetch` pattern
- `useRef<EventSource | null>` thay `useRef<NodeJS.Timeout | null>`
- `useEffect`: `new EventSource("/api/realtime")` → `es.onmessage = (e) => { const signal = JSON.parse(e.data); decidePollAction(...); }` → `es.onerror` không làm gì (EventSource tự reconnect)
- Cleanup: `es.close()` on unmount

**`lib/notifications/poll.ts`** (update):
- Extract inner async fn ra `getNotificationSignalRaw(userId: string): Promise<NotificationSignal>` — export named
- `unstable_cache` wrap vẫn giữ nguyên (dùng cho Navbar render)
- SSE route import `getNotificationSignalRaw` trực tiếp

**`lib/notifications/create.ts`** (update):
- Sau `db.notification.create(...)`, thêm `revalidateTag(CACHE_TAGS.notifications, "max")`
- Import `revalidateTag` từ `next/cache` và `CACHE_TAGS` từ `lib/cache/tags`

### 3.2 Email — Status Change

**Trigger**: `changeStatus` trong `lib/applications/actions.ts`, khi status mới thuộc `["INTERVIEWING", "OFFERED", "ACCEPTED", "REJECTED"]`.

**Data query**: Mở rộng `prisma.application.update(...)` thêm `include`:
```ts
include: {
  user: { select: { email: true, name: true } },
  job: { select: { title: true, company: { select: { name: true } } } },
}
```

**Template** (`lib/email/templates/status-change.ts`):
- Export `statusChangeEmail({ candidateName, jobTitle, companyName, status }): { subject: string; html: string }`
- 4 status messages:

| Status | Subject | Headline |
|--------|---------|---------|
| INTERVIEWING | "Bạn đã được mời phỏng vấn" | "Chúc mừng! Bạn đã được mời phỏng vấn cho vị trí {jobTitle}." |
| OFFERED | "Bạn đã nhận được offer từ {companyName}" | "Chúc mừng! {companyName} đã gửi offer cho bạn." |
| ACCEPTED | "Đơn ứng tuyển được chấp nhận" | "Chúc mừng! Đơn ứng tuyển của bạn đã được chấp nhận." |
| REJECTED | "Thông báo về đơn ứng tuyển" | "Cảm ơn bạn đã ứng tuyển tại {companyName}." |

**Email send** (trong `changeStatus` action, sau update):
```ts
if (["INTERVIEWING", "OFFERED", "ACCEPTED", "REJECTED"].includes(newStatus)) {
  await sendStatusChangeEmail(app).catch(e => console.warn("[status-email]", e));
}
```
- `isEmailConfigured()` guard bên trong helper — không throw, chỉ return sớm
- Non-fatal: wrapped `try/catch` + `console.warn`

### 3.3 Web Push

#### Env vars mới
| Key | Mô tả |
|-----|-------|
| `VAPID_PUBLIC_KEY` | Base64url public key (generate: `npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | Base64url private key |
| `VAPID_SUBJECT` | `mailto:minhnguyen120898@gmail.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Giống `VAPID_PUBLIC_KEY`, expose cho client |

#### Prisma model mới
```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  @@index([userId])
}
```

#### Service worker (`public/sw.js`)
```js
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "SmartHire", {
      body: data.message,
      data: { link: data.link },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.link ?? "/"));
});
```

#### `lib/push/send.ts`
```ts
export function isPushConfigured(): boolean
export async function sendPushToUser(
  userId: string,
  payload: { title: string; message: string; link: string }
): Promise<void>
```
- `isPushConfigured()`: kiểm tra 3 VAPID env vars
- `sendPushToUser()`: gọi `db.pushSubscription.findMany({ where: { userId } })` → `Promise.allSettled()` → `webpush.sendNotification()` per subscription
- Nếu subscription hết hạn (410/404 response): xóa khỏi DB
- `webpush.setVapidDetails(...)` gọi mỗi lần (idempotent, không có state toàn cục)

#### API routes
- `POST /api/push/subscribe`: auth required, body `{ endpoint, p256dh, auth }`, upsert `PushSubscription` by `endpoint`
- `DELETE /api/push/unsubscribe`: auth required, body `{ endpoint }`, delete record

#### Client `components/PushRegistrar.tsx`
- Invisible `"use client"` component, render trong `app/layout.tsx` (bên trong session check)
- On mount (một lần duy nhất): check `"PushManager" in window` + `localStorage.getItem("push-registered")`
- Nếu chưa subscribed và chưa denied: `navigator.serviceWorker.register("/sw.js")` → `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY })`
- POST subscription object tới `/api/push/subscribe`
- Set `localStorage.setItem("push-registered", "1")` sau khi subscribe thành công
- Permission `denied`: set `localStorage.setItem("push-registered", "denied")` → không prompt lại

#### Integration trong `lib/notifications/create.ts`
Sau `db.notification.create(...)`:
```ts
sendPushToUser(userId, { title: "SmartHire", message, link }).catch(
  (e) => console.warn("[push]", e)
);
```
- Non-fatal
- `isPushConfigured()` guard bên trong `sendPushToUser`

## 4. Tasks

### Task 1: SSE route + RealtimeProvider
**Files tạo/sửa:**
- `lib/notifications/poll.ts` — export `getNotificationSignalRaw`
- `lib/notifications/create.ts` — thêm `revalidateTag`
- `app/api/realtime/route.ts` — rewrite sang SSE streaming
- `components/RealtimeProvider.tsx` — EventSource thay setInterval
- `lib/notifications/__tests__/poll.test.ts` — test `getNotificationSignalRaw` exported

### Task 2: Status-change email
**Files tạo/sửa:**
- `lib/email/templates/status-change.ts` — template + 4 status messages
- `lib/email/templates/__tests__/status-change.test.ts` — unit test template
- `lib/applications/actions.ts` — hook `sendStatusChangeEmail` vào `changeStatus`

### Task 3: Web Push server infrastructure
**Files tạo/sửa:**
- `package.json` — thêm `web-push` + `@types/web-push`
- `prisma/schema.prisma` — thêm `PushSubscription` model
- `prisma/migrations/...` — migration file
- `lib/push/send.ts` — `isPushConfigured`, `sendPushToUser`
- `lib/push/__tests__/send.test.ts` — unit test với mock webpush
- `app/api/push/subscribe/route.ts` — POST handler
- `app/api/push/unsubscribe/route.ts` — DELETE handler
- `public/sw.js` — service worker
- `.env.example` — thêm 4 VAPID vars

### Task 4: Push registration UI
**Files tạo/sửa:**
- `components/PushRegistrar.tsx` — client component (permission + subscribe)
- `app/layout.tsx` — thêm `<PushRegistrar />`

### Task 5: Integrate push into notification creation
**Files sửa:**
- `lib/notifications/create.ts` — gọi `sendPushToUser` sau DB create
- `lib/notifications/__tests__/create.test.ts` — mock `sendPushToUser`, verify gọi được

## 5. Kiểm thử

- Mỗi task: `npx tsc --noEmit` + `npm run build` pass, `npm test` xanh (266 tests baseline).
- Task 1 smoke: mở DevTools → Network → filter EventSource → `/api/realtime` phải là 1 connection duy nhất, nhận events mỗi 8s.
- Task 2 smoke: recruiter đổi status → candidate nhận email (kiểm tra Resend dashboard hoặc log).
- Task 3 smoke: POST `/api/push/subscribe` với mock body → record xuất hiện trong DB.
- Task 4 smoke: load trang → DevTools → Application → Service Workers → `sw.js` registered; Notifications permission prompt hiện (nếu chưa grant).
- Task 5 smoke: tạo notification → Resend gửi push (kiểm tra qua browser notification hoặc log).

## 6. Môi trường

**Env mới (tùy chọn — thiếu → feature gracefully disabled):**
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — web push
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — client-side push subscription

**Không thay đổi**: `DATABASE_URL`, `NODE_OPTIONS`, Prisma v6, proxy.ts conventions, RESEND_API_KEY.

## 7. Global Constraints (kế thừa từ cả dự án)

- Prisma v6 — không nâng v7
- Mọi lệnh chạm DB: `NODE_OPTIONS=--dns-result-order=ipv4first`
- Next 16: `proxy.ts` (không phải middleware.ts); không set `runtime` trong proxy
- Server Actions tự guard (không dựa vào proxy)
- Giá trị user input LUÔN qua tham số `$1,$2...` — không nội suy SQL

## 8. Definition of Done

- `/api/realtime` trả về `text/event-stream`, client không còn `setInterval`.
- Notification mới → `revalidateTag(notifications)` được gọi.
- Recruiter đổi status INTERVIEWING/OFFERED/ACCEPTED/REJECTED → candidate nhận email.
- `PushSubscription` model tồn tại trong DB, `public/sw.js` phục vụ service worker.
- Trang load → service worker registered, push subscription gửi lên server.
- Notification mới → push được gửi qua `web-push` (non-fatal nếu VAPID chưa set).
- `npm test` xanh, `npm run build` pass.

## 9. Ngoài phạm vi

- Redis pub/sub cho true real-time (latency <1s) → Gói F hoặc sau
- Push notification settings per-user (opt-out specific types) → sau
- Email cho status SUBMITTED/REVIEWING/WITHDRAWN
- Push unsubscribe UI (chỉ có API route)
