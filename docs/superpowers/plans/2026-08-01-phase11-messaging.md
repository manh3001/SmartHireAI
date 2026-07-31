# Messaging (Phase 11 — Gói E1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ứng viên và NTD nhắn tin với nhau theo từng đơn ứng tuyển: trang hội thoại `/messages/[applicationId]` + gửi tin, phân quyền chỉ hai người trong cuộc.

**Architecture:** Model `Message` gắn với `Application` (thread/đơn). Logic thuần: `messageSchema` (Zod validate body) + `isThreadParticipant` (phân quyền). Server action `sendMessage` xác thực người trong cuộc rồi tạo tin. Trang hội thoại SSR (`force-dynamic`) render bong bóng theo người gửi; client `MessageComposer` gửi + `router.refresh`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 6 + PostgreSQL (Neon), Auth.js, Zod 4, Vitest, Tailwind 4, sonner.

## Global Constraints

- **Next.js là bản có breaking changes.** Trước khi viết route/page/server-action, đọc guide liên quan trong `node_modules/next/dist/docs/`. Pages `await params`.
- **Prisma giữ v6.** Đẩy schema bằng `npm run db:push` (đã bọc ipv4first), KHÔNG dùng `prisma db push` trần.
- **Test:** `npm test` (vitest run). Toàn bộ UI copy **tiếng Việt**.
- **Server actions** dùng `auth()` từ `@/auth`, `prisma` từ `@/lib/db/prisma`.
- **Palette:** blue-700 tiêu đề, slate-50 nền, dùng `Button` từ `@/components/ui`.
- Áp dụng **TDD** cho logic thuần (`messageSchema`, `isThreadParticipant`); glue/UI/trang không unit-test (an toàn bằng `npx tsc --noEmit` + `npm test` xanh).
- **YAGNI:** chưa thông báo/đếm chưa đọc/realtime; cho nhắn ở mọi trạng thái đơn.

---

## File Structure

**Tạo mới:**
- `lib/messages/schema.ts` — Zod `messageSchema` + type `MessageInput`.
- `lib/messages/access.ts` — `isThreadParticipant`.
- `lib/messages/actions.ts` — `"use server"`: `sendMessage`.
- `lib/messages/__tests__/schema.test.ts`, `lib/messages/__tests__/access.test.ts`.
- `app/messages/[applicationId]/page.tsx` — trang hội thoại (SSR).
- `app/messages/[applicationId]/MessageComposer.tsx` — ô soạn tin (client).

**Sửa:**
- `prisma/schema.prisma` — model `Message` + quan hệ ngược (`Application.messages`, `User.messages`).
- `app/applications/page.tsx` — link "Nhắn tin" mỗi đơn.
- `app/jobs/[id]/applicants/[appId]/page.tsx` — link "Nhắn tin".

---

### Task 1: Prisma model Message

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: model `Message` (applicationId, senderId, body, createdAt); `Application.messages Message[]`, `User.messages Message[]`.

- [ ] **Step 1: Thêm model + quan hệ ngược**

Ở cuối `prisma/schema.prisma` thêm:
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
Trong `model Application { ... }` thêm dòng:
```prisma
  messages    Message[]
```
Trong `model User { ... }` thêm dòng:
```prisma
  messages       Message[]
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
git commit -m "feat(db): add Message model"
```

---

### Task 2: Zod messageSchema

**Files:**
- Create: `lib/messages/schema.ts`
- Test: `lib/messages/__tests__/schema.test.ts`

**Interfaces:**
- Produces: `messageSchema` (Zod); `type MessageInput = { body: string }`.

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/messages/__tests__/schema.test.ts
import { describe, it, expect } from "vitest";
import { messageSchema } from "../schema";

describe("messageSchema", () => {
  it("chấp nhận body hợp lệ", () => {
    expect(messageSchema.safeParse({ body: "xin chào" }).success).toBe(true);
  });

  it("từ chối body rỗng", () => {
    const r = messageSchema.safeParse({ body: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Vui lòng nhập nội dung");
  });

  it("từ chối body quá dài", () => {
    const r = messageSchema.safeParse({ body: "x".repeat(2001) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Tin nhắn tối đa 2000 ký tự");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- messages/__tests__/schema`
Expected: FAIL — không import được `../schema`.

- [ ] **Step 3: Viết `lib/messages/schema.ts`**

```ts
import { z } from "zod";

export const messageSchema = z.object({
  body: z
    .string()
    .min(1, "Vui lòng nhập nội dung")
    .max(2000, "Tin nhắn tối đa 2000 ký tự"),
});

export type MessageInput = z.infer<typeof messageSchema>;
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- messages/__tests__/schema`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/messages/schema.ts lib/messages/__tests__/schema.test.ts
git commit -m "feat(messages): zod schema for message body"
```

---

### Task 3: isThreadParticipant (thuần)

**Files:**
- Create: `lib/messages/access.ts`
- Test: `lib/messages/__tests__/access.test.ts`

**Interfaces:**
- Produces: `isThreadParticipant(userId: string, thread: { candidateId: string; recruiterId: string }): boolean`.

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/messages/__tests__/access.test.ts
import { describe, it, expect } from "vitest";
import { isThreadParticipant } from "../access";

const thread = { candidateId: "cand", recruiterId: "rec" };

describe("isThreadParticipant", () => {
  it("true cho ứng viên", () => {
    expect(isThreadParticipant("cand", thread)).toBe(true);
  });
  it("true cho NTD", () => {
    expect(isThreadParticipant("rec", thread)).toBe(true);
  });
  it("false cho người ngoài", () => {
    expect(isThreadParticipant("other", thread)).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

Run: `npm test -- messages/__tests__/access`
Expected: FAIL — không import được `../access`.

- [ ] **Step 3: Viết `lib/messages/access.ts`**

```ts
export function isThreadParticipant(
  userId: string,
  thread: { candidateId: string; recruiterId: string },
): boolean {
  return userId === thread.candidateId || userId === thread.recruiterId;
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `npm test -- messages/__tests__/access`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/messages/access.ts lib/messages/__tests__/access.test.ts
git commit -m "feat(messages): thread participant access check"
```

---

### Task 4: Server action sendMessage

**Files:**
- Create: `lib/messages/actions.ts`

**Interfaces:**
- Consumes: `messageSchema` (`./schema`), `isThreadParticipant` (`./access`).
- Produces: `sendMessage(applicationId: string, body: string): Promise<{ ok: true } | { ok: false; error: string }>`.

Glue: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: Viết `lib/messages/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { messageSchema } from "./schema";
import { isThreadParticipant } from "./access";

export async function sendMessage(
  applicationId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { candidateId: true, job: { select: { userId: true } } },
  });
  if (!app) return { ok: false, error: "Không tìm thấy đơn ứng tuyển" };

  if (!isThreadParticipant(userId, { candidateId: app.candidateId, recruiterId: app.job.userId }))
    return { ok: false, error: "Bạn không có quyền nhắn tin trong đơn này" };

  const parsed = messageSchema.safeParse({ body });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.message.create({
    data: { applicationId, senderId: userId, body: parsed.data.body },
  });

  revalidatePath(`/messages/${applicationId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 3: Commit**

```bash
git add lib/messages/actions.ts
git commit -m "feat(messages): sendMessage server action"
```

---

### Task 5: Trang hội thoại + MessageComposer

**Files:**
- Create: `app/messages/[applicationId]/MessageComposer.tsx`
- Create: `app/messages/[applicationId]/page.tsx`

**Interfaces:**
- Consumes: `sendMessage` (`@/lib/messages/actions`), `isThreadParticipant` (`@/lib/messages/access`), `STATUS_LABELS`/`ApplicationStatus` (`@/lib/applications/status`).

Glue/UI: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: Tạo `app/messages/[applicationId]/MessageComposer.tsx` (client)**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendMessage } from "@/lib/messages/actions";

export default function MessageComposer({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function onSend() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const r = await sendMessage(applicationId, text);
    if (r.ok) {
      setBody("");
      router.refresh();
    } else {
      toast.error(r.error);
    }
    setSending(false);
  }

  return (
    <div className="mt-4 flex gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Nhập tin nhắn..."
        className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
      />
      <Button onClick={onSend} disabled={sending || !body.trim()} className="self-end">
        {sending ? "Đang gửi..." : "Gửi"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Tạo `app/messages/[applicationId]/page.tsx` (server)**

```tsx
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/status";
import { isThreadParticipant } from "@/lib/messages/access";
import MessageComposer from "./MessageComposer";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      candidateId: true,
      status: true,
      candidate: { select: { name: true } },
      job: { select: { id: true, userId: true, title: true, user: { select: { name: true } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, senderId: true, createdAt: true, sender: { select: { name: true } } },
      },
    },
  });
  if (!app) notFound();
  if (!isThreadParticipant(userId, { candidateId: app.candidateId, recruiterId: app.job.userId })) {
    notFound();
  }

  const iAmCandidate = userId === app.candidateId;
  const otherName = iAmCandidate ? app.job.user.name : app.candidate.name;
  const backHref = iAmCandidate ? "/applications" : `/jobs/${app.job.id}/applicants/${applicationId}`;

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href={backHref} className="text-sm text-blue-600 hover:underline">← Quay lại</Link>
        <div className="mt-2 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-blue-700">{otherName}</h1>
            <p className="text-sm text-slate-500">{app.job.title || "(chưa có tiêu đề)"}</p>
          </div>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {STATUS_LABELS[app.status as ApplicationStatus]}
          </span>
        </div>

        <div className="mt-4 grid gap-2">
          {app.messages.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện.</p>
          )}
          {app.messages.map((m) => {
            const mine = m.senderId === userId;
            return (
              <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>
                    {m.sender.name} · {new Date(m.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <MessageComposer applicationId={applicationId} />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 4: Commit**

```bash
git add "app/messages/[applicationId]/MessageComposer.tsx" "app/messages/[applicationId]/page.tsx"
git commit -m "feat(messages): conversation page with composer"
```

---

### Task 6: Liên kết "Nhắn tin"

**Files:**
- Modify: `app/applications/page.tsx`
- Modify: `app/jobs/[id]/applicants/[appId]/page.tsx`

Glue/UI: an toàn bằng `npx tsc --noEmit` + `npm test`.

- [ ] **Step 1: `app/applications/page.tsx` — link "Nhắn tin" mỗi đơn**

Trong `CardContent` của mỗi đơn, ngay dưới khối timeline (`<div className="flex flex-wrap gap-1 ...">...</div>`), thêm:
```tsx
                  <div>
                    <Link href={`/messages/${a.id}`} className="text-sm text-blue-600 hover:underline">
                      Nhắn tin
                    </Link>
                  </div>
```
(`Link` đã được import ở đầu file.)

- [ ] **Step 2: `app/jobs/[id]/applicants/[appId]/page.tsx` — link "Nhắn tin"**

Ngay dưới khối header (`<div className="mt-2 flex items-center justify-between gap-2">...</div>` chứa tên ứng viên + trạng thái), thêm:
```tsx
        <div className="mt-2">
          <Link href={`/messages/${app.id}`} className="text-sm text-blue-600 hover:underline">
            Nhắn tin với ứng viên
          </Link>
        </div>
```
(`Link` đã được import ở đầu file; `app.id` đã có trong select.)

- [ ] **Step 3: Typecheck + test**

Run: `npx tsc --noEmit`
Expected: không lỗi.

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 4: Kiểm tra thủ công (cho người dùng)**

Ứng viên: `/applications` → "Nhắn tin" → gõ + gửi → tin hiện bên phải. NTD: mở chi tiết ứng viên → "Nhắn tin với ứng viên" → cùng luồng, tin của NTD bên phải, tin ứng viên bên trái. Người thứ ba mở `/messages/[id]` của đơn không thuộc mình → 404.

- [ ] **Step 5: Commit**

```bash
git add app/applications/page.tsx "app/jobs/[id]/applicants/[appId]/page.tsx"
git commit -m "feat(messages): link to conversation from applications and applicant detail"
```

---

## Self-Review (đã thực hiện)

- **Bao phủ spec:** §2 model → Task 1. §3.1 schema → Task 2; §3.2 access → Task 3. §4 action → Task 4. §5 trang + composer → Task 5. §6 liên kết → Task 6. §7 lỗi/quyền → action (Task 4) + notFound trang (Task 5). §9 test → Task 2/3 (TDD thuần).
- **Placeholder:** không còn TBD/TODO; mọi bước có code hoặc lệnh cụ thể.
- **Nhất quán kiểu:** `messageSchema` (Task 2) + `isThreadParticipant` (Task 3) dùng ở action (Task 4) + trang (Task 5); `sendMessage(applicationId, body)` (Task 4) dùng ở `MessageComposer` (Task 5); route `/messages/[applicationId]` (Task 5) khớp link ở Task 6; `STATUS_LABELS` tái dùng đúng.
```
