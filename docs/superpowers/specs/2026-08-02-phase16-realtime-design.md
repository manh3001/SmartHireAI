# Phase 16 — Realtime (polling) design

Ngày: 2026-08-02

## Mục tiêu

Cho badge thông báo (Navbar), danh sách `/notifications`, và thread `/messages/[applicationId]`
tự cập nhật mà không cần F5, kèm toast khi có thông báo/tin nhắn mới bất kể đang ở trang nào.

Triển khai bằng **client polling** — phù hợp Vercel serverless, không hạ tầng, không phí.

## Nguyên tắc cốt lõi

Badge, danh sách `/notifications` và thread `/messages` đều là **server component `force-dynamic`**.
Nên chỉ cần gọi `router.refresh()` là cả ba tự render lại với dữ liệu mới.

Mọi tin nhắn mới đều tạo notification cho người nhận (đã có trong `lib/messages/actions.ts` →
`createNotification`). Vì vậy "có tin nhắn mới" ⇔ "`unreadCount` thay đổi". Toàn bộ realtime quy về
**một vòng poll duy nhất** theo dõi thông báo:

- Poll phát hiện `unreadCount` đổi → `router.refresh()` → badge + list + thread cập nhật cùng lúc.
- Poll trả về notification mới nhất → provider bắn toast (kể cả khi đang ở trang khác).

Không quản lý danh sách phía client, không cursor tin nhắn, không trùng lặp — tận dụng đúng
pattern `router.refresh()` đã dùng khắp codebase (xem `MessageComposer`, `MarkAllButton`).

## Thành phần

### 1. `lib/notifications/poll.ts` — truy vấn tín hiệu (thuần, test được)

```ts
getNotificationSignal(userId: string): Promise<{
  unreadCount: number;
  latest: { id: string; message: string; link: string } | null; // mới nhất theo createdAt
}>
```

Hai query nhẹ: `notification.count({ where: { userId, read: false } })` và
`notification.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: {...} })`.
Dùng chung cho cả endpoint lẫn `Navbar` khi render lần đầu.

### 2. `app/api/realtime/route.ts` — GET handler

- `auth()` → nếu chưa đăng nhập trả `{ authenticated: false }` (provider ngừng poll).
- Ngược lại trả `{ authenticated: true, ...getNotificationSignal(userId) }`.
- Response `no-store` (không cache).

### 3. `lib/notifications/poll-decision.ts` — logic quyết định (thuần, test được)

```ts
type Signal = { unreadCount: number; latest: { id: string; message: string; link: string } | null };

decidePollAction(
  prev: Signal,
  next: Signal,
  currentPath: string,
): {
  shouldRefresh: boolean;            // true khi next.unreadCount !== prev.unreadCount
  toast: { message: string; link: string } | null; // khi latest.id mới & link !== currentPath
}
```

Tách riêng để unit-test toàn bộ hành vi mà không cần DOM/browser.

Quy tắc:
- `shouldRefresh` = `next.unreadCount !== prev.unreadCount`.
- `toast` = `next.latest` khi `next.latest?.id` khác `prev.latest?.id` **và** `next.latest.link !== currentPath`;
  ngược lại `null`. (prev khởi tạo từ `initialLatestId` nên lần poll đầu không toast thông báo cũ.)

### 4. `components/RealtimeProvider.tsx` — client, đặt trong nhánh đã-đăng-nhập của `Navbar`

- Poll `/api/realtime` mỗi **12s** (hằng số `POLL_INTERVAL_MS`).
- **Tạm dừng khi tab ẩn** (Page Visibility API); poll ngay khi tab hiện lại.
- Nhận prop `initialLatestId: string | null` để không toast các thông báo cũ lúc mới tải
  (khởi tạo `prev.latest.id = initialLatestId`).
- Mỗi chu kỳ: gọi `decidePollAction(prev, next, pathname)` →
  `router.refresh()` nếu `shouldRefresh`, và/hoặc `toast(...)` (bấm được → điều hướng tới `link`).
- `authenticated: false` → clear interval, ngừng poll.
- Guard chống chồng request bằng ref: bỏ qua chu kỳ mới nếu chu kỳ trước chưa xong.

### 5. Sửa `components/Navbar.tsx`

- Thay query `count` hiện tại bằng `getNotificationSignal(userId)` (lấy luôn `latest.id` cho badge và initial).
- Badge vẫn server-render như cũ (dùng `unreadCount`).
- Render `<RealtimeProvider initialLatestId={latest?.id ?? null} />` trong nhánh đã đăng nhập.

**Vì sao đặt provider trong Navbar?** Navbar chỉ có trên trang đã đăng nhập → không poll ở trang public.
Client component giữ nguyên state qua `router.refresh()` nên interval không bị reset.

## Luồng một chu kỳ poll

```
tab hiện? ──no──► chờ (không request)
   │yes
   ▼
đang có request dở? ──yes──► bỏ qua chu kỳ này
   │no
   ▼
GET /api/realtime ──► { authenticated, unreadCount, latest }
   │
   ├─ authenticated=false ► clear interval, dừng
   ▼
decidePollAction(prev, next, pathname)
   ├─ unreadCount đổi ► router.refresh()  (badge + list + thread)
   └─ latest.id mới & link≠path ► toast (clickable → link)
   │
   ▼
prev = next
```

## Xử lý lỗi

- Request lỗi mạng / 500 → **nuốt lỗi lặng lẽ**, giữ `prev`, thử lại chu kỳ sau. Không toast lỗi.
- `authenticated: false` (hết phiên) → clear interval, ngừng poll.
- Không chồng request: guard bằng ref (chu kỳ trước chưa xong thì bỏ qua chu kỳ mới).

## Testing

- `lib/notifications/__tests__/poll.test.ts` — mock prisma, kiểm tra shape `getNotificationSignal`.
- `lib/notifications/__tests__/poll-decision.test.ts` — test thuần:
  - count tăng → `shouldRefresh`.
  - latest mới → toast.
  - latest.link trùng `currentPath` → không toast (nhưng vẫn refresh nếu count đổi).
  - lần đầu (`prev.latest.id === initialLatestId`) → không toast.
  - count giảm (mark read) → refresh, không toast.
- `RealtimeProvider` (DOM/interval): không unit-test — logic nằm ở `decidePollAction` thuần;
  provider chỉ là lớp keo mỏng.

## Ngoài phạm vi (YAGNI)

Typing indicator, presence "online", read receipts, SSE/websocket, dịch vụ realtime ngoài,
đánh dấu đã đọc tự động khi mở thread.
