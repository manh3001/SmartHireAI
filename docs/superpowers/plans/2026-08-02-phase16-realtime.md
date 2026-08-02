# Phase 16 — Realtime (polling) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho badge thông báo, danh sách `/notifications` và thread `/messages` tự cập nhật (kèm toast) mà không cần F5, bằng client polling.

**Architecture:** Một vòng poll client duy nhất gọi `GET /api/realtime` mỗi 12s (tạm dừng khi tab ẩn). Vì badge/list/thread đều là server component `force-dynamic`, phát hiện `unreadCount` đổi → `router.refresh()` làm cả ba render lại; notification mới nhất → bắn toast. Logic quyết định tách thành hàm thuần `decidePollAction` để test được.

**Tech Stack:** Next.js 16 (route handler + server component), React 19 client component, Prisma 6 / Neon, sonner (toast), vitest.

## Global Constraints

- Prisma pinned v6 — không nâng v7.
- UI/copy tiếng Việt, khớp phong cách hiện có (màu blue/slate, sonner cho toast).
- Convention test của repo: **chỉ unit-test hàm thuần**, KHÔNG mock prisma. Hàm chạm DB không có unit test.
- Client component gọi server logic rồi dùng `router.refresh()` để render lại server component (pattern sẵn có ở `MessageComposer`, `MarkAllButton`).
- Route handler theo mẫu `app/api/register/route.ts`: `import { NextResponse } from "next/server"`, `export async function GET/POST`.
- Auth qua `import { auth } from "@/auth"`, lấy `session?.user?.id`.
- Prisma import mặc định: `import prisma from "@/lib/db/prisma"`.
- Chạy 1 file test: `npx vitest run <path>`. Chạy toàn bộ: `npm test`.

## File Structure

- Create `lib/notifications/poll-decision.ts` — type `NotificationSignal`, hàm thuần `decidePollAction`. Sở hữu type dùng chung.
- Create `lib/notifications/__tests__/poll-decision.test.ts` — test `decidePollAction`.
- Create `lib/notifications/poll.ts` — `getNotificationSignal(userId)` (chạm prisma, không unit-test).
- Create `app/api/realtime/route.ts` — GET handler trả tín hiệu poll.
- Create `components/RealtimeProvider.tsx` — client provider poll + toast + refresh.
- Modify `components/Navbar.tsx` — dùng `getNotificationSignal`, mount `RealtimeProvider`.

---

### Task 1: Hàm quyết định thuần `decidePollAction`

**Files:**
- Create: `lib/notifications/poll-decision.ts`
- Test: `lib/notifications/__tests__/poll-decision.test.ts`

**Interfaces:**
- Consumes: (không)
- Produces:
  - `type NotificationSignal = { unreadCount: number; latest: { id: string; message: string; link: string } | null }`
  - `type PollAction = { shouldRefresh: boolean; toast: { message: string; link: string } | null }`
  - `function decidePollAction(prev: NotificationSignal, next: NotificationSignal, currentPath: string): PollAction`

Quy tắc: `shouldRefresh = next.unreadCount !== prev.unreadCount`. `toast = next.latest` khi `next.latest` khác id với `prev.latest` **và** `next.latest.link !== currentPath`, ngược lại `null`.

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/notifications/__tests__/poll-decision.test.ts
import { describe, it, expect } from "vitest";
import { decidePollAction, type NotificationSignal } from "../poll-decision";

const n = (id: string, link = "/notifications"): NotificationSignal["latest"] => ({
  id,
  message: `msg ${id}`,
  link,
});

describe("decidePollAction", () => {
  it("count tăng → shouldRefresh", () => {
    const prev: NotificationSignal = { unreadCount: 1, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 2, latest: n("a") };
    expect(decidePollAction(prev, next, "/dashboard").shouldRefresh).toBe(true);
  });

  it("count giảm (mark read) → shouldRefresh, không toast", () => {
    const prev: NotificationSignal = { unreadCount: 3, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 0, latest: n("a") };
    const r = decidePollAction(prev, next, "/dashboard");
    expect(r.shouldRefresh).toBe(true);
    expect(r.toast).toBeNull();
  });

  it("không đổi gì → không refresh, không toast", () => {
    const prev: NotificationSignal = { unreadCount: 2, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 2, latest: n("a") };
    const r = decidePollAction(prev, next, "/dashboard");
    expect(r.shouldRefresh).toBe(false);
    expect(r.toast).toBeNull();
  });

  it("latest id mới, link khác path → toast", () => {
    const prev: NotificationSignal = { unreadCount: 1, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 2, latest: n("b", "/messages/x") };
    const r = decidePollAction(prev, next, "/dashboard");
    expect(r.toast).toEqual({ message: "msg b", link: "/messages/x" });
  });

  it("latest id mới nhưng link trùng path → không toast (vẫn refresh nếu count đổi)", () => {
    const prev: NotificationSignal = { unreadCount: 1, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 2, latest: n("b", "/messages/x") };
    const r = decidePollAction(prev, next, "/messages/x");
    expect(r.toast).toBeNull();
    expect(r.shouldRefresh).toBe(true);
  });

  it("prev.latest null → next.latest coi là mới", () => {
    const prev: NotificationSignal = { unreadCount: 0, latest: null };
    const next: NotificationSignal = { unreadCount: 1, latest: n("a", "/applications") };
    expect(decidePollAction(prev, next, "/dashboard").toast).toEqual({
      message: "msg a",
      link: "/applications",
    });
  });

  it("next.latest null → không toast", () => {
    const prev: NotificationSignal = { unreadCount: 1, latest: n("a") };
    const next: NotificationSignal = { unreadCount: 0, latest: null };
    expect(decidePollAction(prev, next, "/dashboard").toast).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npx vitest run lib/notifications/__tests__/poll-decision.test.ts`
Expected: FAIL — không tìm thấy module `../poll-decision`.

- [ ] **Step 3: Viết implementation tối thiểu**

```ts
// lib/notifications/poll-decision.ts
export type NotificationSignal = {
  unreadCount: number;
  latest: { id: string; message: string; link: string } | null;
};

export type PollAction = {
  shouldRefresh: boolean;
  toast: { message: string; link: string } | null;
};

export function decidePollAction(
  prev: NotificationSignal,
  next: NotificationSignal,
  currentPath: string,
): PollAction {
  const shouldRefresh = next.unreadCount !== prev.unreadCount;

  const isNewLatest =
    next.latest != null && next.latest.id !== (prev.latest?.id ?? null);
  const toast =
    isNewLatest && next.latest!.link !== currentPath
      ? { message: next.latest!.message, link: next.latest!.link }
      : null;

  return { shouldRefresh, toast };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npx vitest run lib/notifications/__tests__/poll-decision.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/poll-decision.ts lib/notifications/__tests__/poll-decision.test.ts
git commit -m "feat(realtime): pure decidePollAction for poll signals"
```

---

### Task 2: Truy vấn tín hiệu `getNotificationSignal`

**Files:**
- Create: `lib/notifications/poll.ts`

**Interfaces:**
- Consumes: `NotificationSignal` từ `./poll-decision`.
- Produces: `function getNotificationSignal(userId: string): Promise<NotificationSignal>`

Không có unit test (chạm prisma — theo convention repo).

- [ ] **Step 1: Viết implementation**

```ts
// lib/notifications/poll.ts
import prisma from "@/lib/db/prisma";
import type { NotificationSignal } from "./poll-decision";

export async function getNotificationSignal(
  userId: string,
): Promise<NotificationSignal> {
  const [unreadCount, latest] = await Promise.all([
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.notification.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, message: true, link: true },
    }),
  ]);

  return { unreadCount, latest };
}
```

- [ ] **Step 2: Kiểm tra typecheck/build không lỗi**

Run: `npx tsc --noEmit`
Expected: Không có lỗi liên quan `lib/notifications/poll.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/notifications/poll.ts
git commit -m "feat(realtime): getNotificationSignal query"
```

---

### Task 3: Route handler `GET /api/realtime`

**Files:**
- Create: `app/api/realtime/route.ts`

**Interfaces:**
- Consumes: `getNotificationSignal` từ `@/lib/notifications/poll`; `auth` từ `@/auth`.
- Produces: HTTP GET trả JSON:
  - Chưa đăng nhập: `{ authenticated: false }`
  - Đã đăng nhập: `{ authenticated: true, unreadCount: number, latest: {...}|null }`

- [ ] **Step 1: Viết implementation**

```ts
// app/api/realtime/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getNotificationSignal } from "@/lib/notifications/poll";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  const signal = await getNotificationSignal(userId);
  return NextResponse.json(
    { authenticated: true, ...signal },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

- [ ] **Step 2: Kiểm tra typecheck**

Run: `npx tsc --noEmit`
Expected: Không có lỗi liên quan `app/api/realtime/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/realtime/route.ts
git commit -m "feat(realtime): GET /api/realtime poll endpoint"
```

---

### Task 4: Client `RealtimeProvider`

**Files:**
- Create: `components/RealtimeProvider.tsx`

**Interfaces:**
- Consumes: `decidePollAction`, `NotificationSignal` từ `@/lib/notifications/poll-decision`; `GET /api/realtime`.
- Produces: `export default function RealtimeProvider(props: { initialUnreadCount: number; initialLatestId: string | null }): JSX.Element` (render `null`).

Hành vi: poll mỗi 12s, tạm dừng khi `document.hidden`, poll ngay khi tab hiện lại; guard chống chồng request; `authenticated:false` → dừng; lỗi → nuốt lặng lẽ; áp dụng `decidePollAction` (refresh + toast). `prev` khởi tạo đầy đủ từ props (không cần sentinel).

- [ ] **Step 1: Viết implementation**

```tsx
// components/RealtimeProvider.tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  decidePollAction,
  type NotificationSignal,
} from "@/lib/notifications/poll-decision";

const POLL_INTERVAL_MS = 12_000;

export default function RealtimeProvider({
  initialUnreadCount,
  initialLatestId,
}: {
  initialUnreadCount: number;
  initialLatestId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const prevRef = useRef<NotificationSignal>({
    unreadCount: initialUnreadCount,
    latest: initialLatestId
      ? { id: initialLatestId, message: "", link: "" }
      : null,
  });
  const inFlightRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      if (stopped || inFlightRef.current || document.hidden) return;
      inFlightRef.current = true;
      try {
        const res = await fetch("/api/realtime", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.authenticated === false) {
          stopped = true;
          if (timer) clearInterval(timer);
          return;
        }
        const next: NotificationSignal = {
          unreadCount: data.unreadCount,
          latest: data.latest,
        };
        const action = decidePollAction(prevRef.current, next, pathRef.current);
        prevRef.current = next;
        if (action.shouldRefresh) router.refresh();
        if (action.toast) {
          const link = action.toast.link;
          toast(action.toast.message, {
            action: { label: "Xem", onClick: () => router.push(link) },
          });
        }
      } catch {
        // nuốt lỗi, thử lại chu kỳ sau
      } finally {
        inFlightRef.current = false;
      }
    }

    function onVisible() {
      if (!document.hidden) poll();
    }

    timer = setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
```

- [ ] **Step 2: Kiểm tra typecheck**

Run: `npx tsc --noEmit`
Expected: Không có lỗi liên quan `components/RealtimeProvider.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/RealtimeProvider.tsx
git commit -m "feat(realtime): RealtimeProvider polling client"
```

---

### Task 5: Nối `RealtimeProvider` vào Navbar

**Files:**
- Modify: `components/Navbar.tsx`

**Interfaces:**
- Consumes: `getNotificationSignal` từ `@/lib/notifications/poll`; `RealtimeProvider` từ `@/components/RealtimeProvider`.
- Produces: (không có interface mới)

Thay query `count` cũ bằng `getNotificationSignal`; badge dùng `unreadCount`; mount provider với 2 props initial trong nhánh đã đăng nhập.

- [ ] **Step 1: Đổi import và truy vấn**

Trong `components/Navbar.tsx`, bỏ import prisma, thêm import mới:

```ts
// XÓA dòng: import prisma from "@/lib/db/prisma";
// THÊM:
import { getNotificationSignal } from "@/lib/notifications/poll";
import RealtimeProvider from "@/components/RealtimeProvider";
```

Thay khối tính `unread`:

```ts
// CŨ:
//  const unread = loggedIn
//    ? await prisma.notification.count({ where: { userId: session!.user!.id, read: false } })
//    : 0;
// MỚI:
  const signal = loggedIn
    ? await getNotificationSignal(session!.user!.id)
    : { unreadCount: 0, latest: null };
  const unread = signal.unreadCount;
```

- [ ] **Step 2: Mount provider trong nhánh đã đăng nhập**

Ngay sau `{loggedIn ? (` và `<>`, thêm dòng đầu tiên trong fragment (trước link "Bảng điều khiển"):

```tsx
              <RealtimeProvider
                initialUnreadCount={signal.unreadCount}
                initialLatestId={signal.latest?.id ?? null}
              />
```

(Badge `unread` giữ nguyên như hiện tại — không đổi.)

- [ ] **Step 3: Kiểm tra typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: Không lỗi liên quan `components/Navbar.tsx`.

- [ ] **Step 4: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS (bao gồm `poll-decision.test.ts`; không hồi quy).

- [ ] **Step 5: Kiểm thử thủ công (2 phiên/2 vai)**

Mở 2 trình duyệt (ứng viên & nhà tuyển dụng) trên cùng đơn ứng tuyển:
- NTD gửi tin ở `/messages/<id>` → trong ≤12s, phía ứng viên: badge tăng, thread hiện tin mới, và toast "… đã nhắn tin…" nếu ứng viên đang ở trang khác; nếu đang ở đúng thread → không toast nhưng tin vẫn xuất hiện.
- Chuyển tab sang ẩn → xác nhận không có request `/api/realtime` (Network tab); hiện lại tab → poll ngay.

- [ ] **Step 6: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat(realtime): wire RealtimeProvider into Navbar"
```

---

## Self-Review

**Spec coverage:**
- Badge live → Task 5 (`router.refresh` re-render Navbar). ✓
- Danh sách /notifications live → Task 4 refresh (force-dynamic page). ✓
- Thread /messages live → Task 4 refresh (message tạo notification → count đổi). ✓
- Toast → Task 1 (quyết định) + Task 4 (bắn toast). ✓
- Polling 12s, visibility-aware, guard chồng request → Task 4. ✓
- Endpoint auth-aware → Task 3. ✓
- Truy vấn tín hiệu → Task 2. ✓
- Xử lý lỗi nuốt lặng lẽ, dừng khi hết phiên → Task 4. ✓

**Placeholder scan:** Không có TBD/TODO; mọi step có code/command cụ thể.

**Type consistency:** `NotificationSignal`/`PollAction`/`decidePollAction` định nghĩa ở Task 1, dùng nhất quán ở Task 2/4. `getNotificationSignal` (Task 2) khớp cách gọi ở Task 3/5. Props `RealtimeProvider` (`initialUnreadCount`, `initialLatestId`) khớp Task 4↔5.

**Ghi chú lệch spec:** Spec nêu `poll.test.ts` mock prisma — bỏ theo convention repo (không mock prisma); toàn bộ hành vi đã phủ qua `poll-decision.test.ts` thuần. Provider thêm prop `initialUnreadCount` (ngoài `initialLatestId` trong spec) để khởi tạo `prev` đầy đủ, tránh refresh giả ở lần poll đầu.
