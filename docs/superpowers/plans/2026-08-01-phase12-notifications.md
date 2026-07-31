# Notifications (Phase 12 — Gói E2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thông báo in-app: sự kiện (đổi trạng thái đơn, tin nhắn mới, ứng tuyển mới) sinh thông báo cho đối phương; chuông đếm chưa đọc trên Navbar; trang `/notifications` xem + đánh dấu đã đọc.

**Architecture:** Model `Notification` (người nhận + message + link + read). Bộ dựng nội dung thuần (`messages.ts`) test được. Helper `createNotification` (ghi DB) gọi từ 3 action sự kiện, bọc try/catch để không làm hỏng hành động chính. Navbar (server) đếm chưa đọc. Trang `/notifications` + client mark-read.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 + PostgreSQL (Neon), Auth.js, Vitest, Tailwind 4, lucide-react, sonner.

## Global Constraints

- **Next.js là bản có breaking changes.** Trước khi viết route/page/server-action, đọc guide liên quan trong `node_modules/next/dist/docs/`. Pages `await params`.
- **Prisma giữ v6.** Đẩy schema bằng `npm run db:push` (đã bọc ipv4first), KHÔNG dùng `prisma db push` trần.
- **Test:** `npm test` (vitest run). Toàn bộ UI copy **tiếng Việt**.
- **Server actions** dùng `auth()` từ `@/auth`, `prisma` từ `@/lib/db/prisma`.
- **Palette:** blue-700 tiêu đề, slate-50 nền, dùng `Button` từ `@/components/ui`, icon `lucide-react`.
- Áp dụng **TDD** cho logic thuần (`messages.ts`); glue/UI/action/navbar không unit-test (an toàn bằng `npx tsc --noEmit` + `npm test` xanh).
- **An toàn sự kiện:** tạo thông báo phải bọc `try/catch`, lỗi thông báo KHÔNG được làm hành động chính (đổi trạng thái/gửi tin/nộp đơn) thất bại. Người nhận luôn là đối phương (không tự báo mình).
- **YAGNI:** không realtime/push/email; không type/icon; không xoá thông báo.

---

## File Structure

**Tạo mới:**
- `lib/notifications/messages.ts` — 3 bộ dựng nội dung thuần.
- `lib/notifications/create.ts` — `createNotification` helper.
- `lib/notifications/actions.ts` — `"use server"`: `markNotificationRead`, `markAllNotificationsRead`.
- `lib/notifications/__tests__/messages.test.ts`.
- `app/notifications/page.tsx`, `app/notifications/NotificationItem.tsx`, `app/notifications/MarkAllButton.tsx`.

**Sửa:**
- `prisma/schema.prisma` — model `Notification` + quan hệ ngược + index.
- `lib/applications/actions.ts` — `changeStatus` + `submitApplication` tạo thông báo.
- `lib/messages/actions.ts` — `sendMessage` tạo thông báo.
- `components/Navbar.tsx` — chuông + badge chưa đọc.

---

### Task 1: Prisma model Notification

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: model `Notification` (userId, message, link, read, createdAt, `@@index([userId, read])`); `User.notifications Notification[]`.

- [ ] **Step 1: Thêm model + quan hệ ngược**

Ở cuối `prisma/schema.prisma` thêm:
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
Trong `model User { ... }` thêm dòng:
```prisma
  notifications  Notification[]
```

- [ ] **Step 2: Validate**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 3: Đẩy schema + generate**

Run: `npm run db:push`
Expected: `Your database is now in sync with your Prisma schema.` + `Generated Prisma Client`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add Notification model"
```

---

### Task 2: Bộ dựng nội dung messages.ts

**Files:**
- Create: `lib/notifications/messages.ts`
- Test: `lib/notifications/__tests__/messages.test.ts`

**Interfaces:**
- Produces (mỗi hàm trả `{ message: string; link: string }`):
  - `statusChangeNotification(jobTitle: string, statusLabel: string)`
  - `newMessageNotification(senderName: string, jobTitle: string, applicationId: string)`
  - `newApplicationNotification(candidateName: string, jobTitle: string, jobId: string)`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/notifications/__tests__/messages.test.ts
import { describe, it, expect } from "vitest";
import {
  statusChangeNotification,
  newMessageNotification,
  newApplicationNotification,
} from "../messages";

describe("notification messages", () => {
  it("statusChangeNotification", () => {
    const r = statusChangeNotification("Frontend Dev", "Phỏng vấn");
    expect(r.message).toBe('Đơn ứng tuyển "Frontend Dev" đã chuyển sang "Phỏng vấn"');
    expect(r.link).toBe("/applications");
  });

  it("newMessageNotification", () => {
    const r = newMessageNotification("An", "Frontend Dev", "app_1");
    expect(r.message).toBe('An đã nhắn tin cho bạn về "Frontend Dev"');
    expect(r.link).toBe("/messages/app_1");
  });

  it("newApplicationNotification", () => {
    const r = newApplicationNotification("Bình", "Frontend Dev", "job_1");
    expect(r.message).toBe('Bình đã ứng tuyển "Frontend Dev"');
    expect(r.link).toBe("/jobs/job_1/applicants");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- notifications/__tests__/messages`
Expected: FAIL — không import được `../messages`.

- [ ] **Step 3: Viết `lib/notifications/messages.ts`**

```ts
export function statusChangeNotification(
  jobTitle: string,
  statusLabel: string,
): { message: string; link: string } {
  return {
    message: `Đơn ứng tuyển "${jobTitle}" đã chuyển sang "${statusLabel}"`,
    link: "/applications",
  };
}

export function newMessageNotification(
  senderName: string,
  jobTitle: string,
  applicationId: string,
): { message: string; link: string } {
  return {
    message: `${senderName} đã nhắn tin cho bạn về "${jobTitle}"`,
    link: `/messages/${applicationId}`,
  };
}

export function newApplicationNotification(
  candidateName: string,
  jobTitle: string,
  jobId: string,
): { message: string; link: string } {
  return {
    message: `${candidateName} đã ứng tuyển "${jobTitle}"`,
    link: `/jobs/${jobId}/applicants`,
  };
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- notifications/__tests__/messages`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/messages.ts lib/notifications/__tests__/messages.test.ts
git commit -m "feat(notifications): message builders"
```

---

### Task 3: createNotification + gắn vào 3 sự kiện

**Files:**
- Create: `lib/notifications/create.ts`
- Modify: `lib/applications/actions.ts`
- Modify: `lib/messages/actions.ts`

**Interfaces:**
- Consumes: `statusChangeNotification`/`newMessageNotification`/`newApplicationNotification` (`@/lib/notifications/messages`), `STATUS_LABELS` (`@/lib/applications/status`).
- Produces: `createNotification(userId: string, data: { message: string; link: string }): Promise<void>`.

Glue: an toàn bằng `npx tsc --noEmit` + `npm test`. Không được làm vỡ luồng chính; tạo thông báo bọc try/catch.

- [ ] **Step 1: Viết `lib/notifications/create.ts`**

```ts
import prisma from "@/lib/db/prisma";

export async function createNotification(
  userId: string,
  data: { message: string; link: string },
): Promise<void> {
  await prisma.notification.create({
    data: { userId, message: data.message, link: data.link },
  });
}
```

- [ ] **Step 2: `lib/applications/actions.ts` — thông báo ở changeStatus + submitApplication**

Thêm import (cạnh các import hiện có):
```ts
import { STATUS_LABELS } from "./status";
import { createNotification } from "@/lib/notifications/create";
import { statusChangeNotification, newApplicationNotification } from "@/lib/notifications/messages";
```
(Lưu ý: `./status` hiện đã import `APPLICATION_STATUSES, canWithdraw, type ApplicationStatus`; thêm `STATUS_LABELS` vào đúng import đó thay vì import trùng.)

**submitApplication:** mở rộng `select` của `job` để lấy `userId` + `title`:
```ts
  const job = await prisma.jobDescription.findFirst({
    where: { id: input.jobId, isPublic: true },
    select: {
      id: true, rawText: true, userId: true, title: true,
      location: true, employmentType: true, experienceLevel: true, skills: true,
    },
  });
```
Sau khối `if (outcome.ok) { revalidatePath(...); revalidatePath(...); }` (trước `return outcome;`), thêm tạo thông báo cho NTD:
```ts
  if (outcome.ok && job) {
    try {
      await createNotification(
        job.userId,
        newApplicationNotification(
          session.user.name ?? "Ứng viên",
          job.title || "(chưa có tiêu đề)",
          input.jobId,
        ),
      );
    } catch {
      // thông báo lỗi không làm hỏng việc nộp đơn
    }
  }
```

**changeStatus:** sau `if (outcome.ok) revalidatePath("/applications");` (trước `return outcome;`), thêm:
```ts
  if (outcome.ok) {
    try {
      const app = await prisma.application.findUnique({
        where: { id: applicationId },
        select: { candidateId: true, job: { select: { title: true } } },
      });
      if (app) {
        await createNotification(
          app.candidateId,
          statusChangeNotification(app.job.title || "(chưa có tiêu đề)", STATUS_LABELS[toStatus]),
        );
      }
    } catch {
      // thông báo lỗi không làm hỏng việc đổi trạng thái
    }
  }
```

- [ ] **Step 3: `lib/messages/actions.ts` — thông báo ở sendMessage**

Thêm import:
```ts
import { createNotification } from "@/lib/notifications/create";
import { newMessageNotification } from "@/lib/notifications/messages";
```
Mở rộng `select` của `app` để lấy `job.title`:
```ts
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { candidateId: true, job: { select: { userId: true, title: true } } },
  });
```
Sau `prisma.message.create(...)` và trước `revalidatePath(...)`, thêm tạo thông báo cho người còn lại:
```ts
  const recipientId = userId === app.candidateId ? app.job.userId : app.candidateId;
  try {
    await createNotification(
      recipientId,
      newMessageNotification(
        session.user.name ?? "Người dùng",
        app.job.title || "(chưa có tiêu đề)",
        applicationId,
      ),
    );
  } catch {
    // thông báo lỗi không làm hỏng việc gửi tin
  }
```

- [ ] **Step 4: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ (test hiện có không phụ thuộc thông báo).

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/create.ts lib/applications/actions.ts lib/messages/actions.ts
git commit -m "feat(notifications): emit on status change, message, and application"
```

---

### Task 4: Actions markNotificationRead / markAllNotificationsRead

**Files:**
- Create: `lib/notifications/actions.ts`

**Interfaces:**
- Produces: `markNotificationRead(id: string): Promise<void>`, `markAllNotificationsRead(): Promise<void>`.

Glue: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: Viết `lib/notifications/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";

export async function markNotificationRead(id: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
}
```

- [ ] **Step 2: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 3: Commit**

```bash
git add lib/notifications/actions.ts
git commit -m "feat(notifications): mark read actions"
```

---

### Task 5: Chuông + badge trên Navbar

**Files:**
- Modify: `components/Navbar.tsx`

Glue/UI: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: Sửa `components/Navbar.tsx`**

Thêm import ở đầu file:
```tsx
import { Sparkles, Bell } from "lucide-react";
import prisma from "@/lib/db/prisma";
```
(Thay dòng `import { Sparkles } from "lucide-react";` hiện có bằng dòng gộp `Sparkles, Bell`.)

Sau `const loggedIn = !!session?.user;`, thêm:
```tsx
  const unread = loggedIn
    ? await prisma.notification.count({ where: { userId: session!.user!.id, read: false } })
    : 0;
```

Trong khối `{loggedIn ? ( ... ) : ...}`, ngay trước `<form action={...}>` (nút Đăng xuất), thêm chuông:
```tsx
              <Link href="/notifications" className="relative text-slate-600 hover:text-blue-600" aria-label="Thông báo">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
```

- [ ] **Step 2: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 3: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat(notifications): navbar bell with unread badge"
```

---

### Task 6: Trang /notifications + client

**Files:**
- Create: `app/notifications/NotificationItem.tsx`
- Create: `app/notifications/MarkAllButton.tsx`
- Create: `app/notifications/page.tsx`

**Interfaces:**
- Consumes: `markNotificationRead`, `markAllNotificationsRead` (`@/lib/notifications/actions`).

Glue/UI: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: Tạo `app/notifications/NotificationItem.tsx` (client)**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead } from "@/lib/notifications/actions";

export default function NotificationItem({
  id,
  message,
  link,
  read,
  time,
}: {
  id: string;
  message: string;
  link: string;
  read: boolean;
  time: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    if (!read) await markNotificationRead(id);
    router.push(link);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
        read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"
      } hover:border-blue-300`}
    >
      <p className={read ? "text-slate-600" : "font-medium text-slate-800"}>{message}</p>
      <p className="mt-1 text-[11px] text-slate-400">{time}</p>
    </button>
  );
}
```

- [ ] **Step 2: Tạo `app/notifications/MarkAllButton.tsx` (client)**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/lib/notifications/actions";

export default function MarkAllButton() {
  const router = useRouter();

  async function onClick() {
    await markAllNotificationsRead();
    toast.success("Đã đánh dấu tất cả đã đọc");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      Đánh dấu tất cả đã đọc
    </Button>
  );
}
```

- [ ] **Step 3: Tạo `app/notifications/page.tsx` (server)**

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import NotificationItem from "./NotificationItem";
import MarkAllButton from "./MarkAllButton";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, message: true, link: true, read: true, createdAt: true },
  });
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-blue-700">Thông báo</h1>
          {hasUnread && <MarkAllButton />}
        </div>
        {notifications.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-slate-500">Chưa có thông báo nào.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                id={n.id}
                message={n.message}
                link={n.link}
                read={n.read}
                time={new Date(n.createdAt).toLocaleString("vi-VN")}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 5: Kiểm tra thủ công (cho người dùng)**

NTD đổi trạng thái đơn → ứng viên thấy chuông có badge + thông báo ở `/notifications`, bấm → tới `/applications`, thông báo thành đã đọc. Ứng viên nộp đơn mới → NTD nhận thông báo. Hai bên nhắn tin → người nhận nhận thông báo (link tới hội thoại). "Đánh dấu tất cả đã đọc" xoá badge.

- [ ] **Step 6: Commit**

```bash
git add "app/notifications/NotificationItem.tsx" "app/notifications/MarkAllButton.tsx" "app/notifications/page.tsx"
git commit -m "feat(notifications): notifications page with mark-read"
```

---

## Self-Review (đã thực hiện)

- **Bao phủ spec:** §2 model → Task 1. §3 builders → Task 2. §4 create + gắn 3 sự kiện (try/catch soft-fail) → Task 3. §5 chuông navbar → Task 5. §6 trang + actions → Task 4 (actions) + Task 6 (trang). §7 phân quyền/lỗi → updateMany scope userId (Task 4) + soft-fail (Task 3). §9 test → Task 2 (TDD thuần).
- **Placeholder:** không còn TBD/TODO; mọi bước có code hoặc lệnh cụ thể.
- **Nhất quán kiểu:** `statusChangeNotification`/`newMessageNotification`/`newApplicationNotification` (Task 2) dùng ở Task 3; `createNotification(userId, {message, link})` (Task 3) dùng ở 3 sự kiện; `markNotificationRead`/`markAllNotificationsRead` (Task 4) dùng ở `NotificationItem`/`MarkAllButton` (Task 6); `Notification` (Task 1) truy vấn ở navbar (Task 5) + trang (Task 6). `session.user.name` dùng đúng như Navbar hiện có.
```
