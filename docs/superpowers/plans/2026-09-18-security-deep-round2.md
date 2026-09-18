# Bảo mật sâu — Vòng 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm thu hồi phiên (đăng xuất mọi thiết bị + tự thu hồi khi reset mật khẩu), lịch sử đăng nhập cho user, và gia cố `getClientIp` + audit login bị rate-limit — trên nền NextAuth v5 JWT của nền tuyển dụng CV-AI.

**Architecture:** `User.tokenVersion` (Int) làm mốc thu hồi: nhúng vào JWT khi đăng nhập, callback `jwt` so DB mỗi request (lệch → hủy phiên). Logic thuần (`checkTokenVersion`, `isValidIp`) tách khỏi wiring để test bằng vitest. Trang `/settings/security` (server component, `requireUser`) hiển thị lịch sử đăng nhập từ `AuditLog` + nút "đăng xuất mọi thiết bị".

**Tech Stack:** Next.js 16.2.12 (App Router), NextAuth v5 (JWT, không adapter), Prisma 6 + Postgres, Base UI dialog, vitest 4, TypeScript.

## Global Constraints

- Prisma pin v6 — KHÔNG nâng v7. Áp schema bằng `npm run db:push` (không migrate).
- Prisma client import: `import prisma from "@/lib/db/prisma"`.
- Logic nghiệp vụ THUẦN + nhận deps/tham số (không import prisma trong file logic) để test bằng fake deps.
- Copy tiếng Việt cho text/lỗi hiển thị.
- Không thêm dependency mới.
- `getClientIp` giữ chữ ký `(req: Request | undefined): string` (không phá call site).
- Trang settings hiện KHÔNG có layout chung; mỗi trang tự `<Navbar />` + `<main>` (khớp `app/settings/profile/page.tsx`). `/settings/security` guard bằng `requireUser` (cho MỌI role).
- Audit save closure map field tường minh + `metadata: en.metadata != null ? (en.metadata as Prisma.InputJsonValue) : undefined` (khớp Vòng 1). Sự kiện không có metadata thì bỏ dòng metadata.
- Kết thúc mỗi task: `npx tsc --noEmit` 0 lỗi + test liên quan xanh. Cuối cùng: tsc + lint + `npm test` + `npm run build` sạch.
- Commit message tiếng Việt, prefix `feat(security):` / `test(security):` / `chore(security):`.

---

### Task 1: Schema — `User.tokenVersion`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `User.tokenVersion Int @default(0)` — các task sau đọc/ghi qua `prisma.user`.

- [ ] **Step 1: Thêm field vào model `User`**

Trong `model User`, thêm ngay dưới dòng `emailVerified DateTime?`:

```prisma
  tokenVersion  Int      @default(0)
```

- [ ] **Step 2: Validate schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Generate client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` (không lỗi)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(security): schema User.tokenVersion (thu hồi phiên)"
```

> `npm run db:push` vào DB thật là việc người dùng chạy (cần `DATABASE_URL`). Không chặn task khác (test dùng fake deps).

---

### Task 2: `checkTokenVersion` (pure logic)

**Files:**
- Create: `lib/auth/token-version.ts`
- Test: `lib/auth/__tests__/token-version.test.ts`

**Interfaces:**
- Produces:
  - `type TokenVersionCheck = "valid" | "revoked" | "deleted"`
  - `checkTokenVersion(input: { tokenVersion: number | undefined; dbVersion: number | null }): TokenVersionCheck`

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/auth/__tests__/token-version.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { checkTokenVersion } from "../token-version";

describe("checkTokenVersion", () => {
  it("dbVersion null (user bị xóa) -> deleted", () => {
    expect(checkTokenVersion({ tokenVersion: 0, dbVersion: null })).toBe("deleted");
    expect(checkTokenVersion({ tokenVersion: undefined, dbVersion: null })).toBe("deleted");
  });
  it("tokenVersion lệch dbVersion -> revoked", () => {
    expect(checkTokenVersion({ tokenVersion: 0, dbVersion: 1 })).toBe("revoked");
    expect(checkTokenVersion({ tokenVersion: 3, dbVersion: 5 })).toBe("revoked");
  });
  it("tokenVersion chưa set (đăng nhập lần đầu) -> valid", () => {
    expect(checkTokenVersion({ tokenVersion: undefined, dbVersion: 0 })).toBe("valid");
    expect(checkTokenVersion({ tokenVersion: undefined, dbVersion: 7 })).toBe("valid");
  });
  it("tokenVersion khớp dbVersion -> valid", () => {
    expect(checkTokenVersion({ tokenVersion: 2, dbVersion: 2 })).toBe("valid");
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/auth/__tests__/token-version.test.ts`
Expected: FAIL ("Cannot find module '../token-version'").

- [ ] **Step 3: Viết implementation**

Tạo `lib/auth/token-version.ts`:

```ts
export type TokenVersionCheck = "valid" | "revoked" | "deleted";

export function checkTokenVersion(input: {
  tokenVersion: number | undefined;
  dbVersion: number | null;
}): TokenVersionCheck {
  if (input.dbVersion === null) return "deleted";
  if (typeof input.tokenVersion === "number" && input.tokenVersion !== input.dbVersion) {
    return "revoked";
  }
  return "valid";
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/auth/__tests__/token-version.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/token-version.ts lib/auth/__tests__/token-version.test.ts
git commit -m "feat(security): checkTokenVersion (logic thu hồi phiên)"
```

---

### Task 3: `auth.ts` — enforcement trong `jwt` + audit login bị rate-limit

**Files:**
- Modify: `auth.ts`

**Interfaces:**
- Consumes: `checkTokenVersion` (Task 2); `User.tokenVersion` (Task 1); `recordAudit`/`AUDIT_ACTIONS`, `getClientIp` (đã có).
- Produces: JWT mang `token.tokenVersion`; phiên bị hủy khi version lệch / user bị xóa.

- [ ] **Step 1: Thêm import `checkTokenVersion`**

Trong `auth.ts`, thêm cạnh các import hiện có:

```ts
import { checkTokenVersion } from "@/lib/auth/token-version";
```

- [ ] **Step 2: Audit login bị rate-limit (D2)**

Trong `authorize`, thay khối rate-limit hiện tại:

```ts
        const ok = await checkRateLimit("login", `${ip}:${email}`);
        if (!ok) {
          console.warn("[auth] login bị rate-limit:", email);
          return null; // trả lỗi đồng nhất, không tiết lộ bị khoá
        }
```

bằng:

```ts
        const ok = await checkRateLimit("login", `${ip}:${email}`);
        if (!ok) {
          console.warn("[auth] login bị rate-limit:", email);
          await recordAudit(
            {
              action: AUDIT_ACTIONS.loginFailure,
              userId: null,
              ip,
              metadata: { email, reason: "rate_limited" },
            },
            {
              save: (en) =>
                prisma.auditLog
                  .create({
                    data: {
                      action: en.action,
                      userId: en.userId ?? undefined,
                      targetId: en.targetId ?? undefined,
                      ip: en.ip ?? undefined,
                      metadata:
                        en.metadata != null ? (en.metadata as Prisma.InputJsonValue) : undefined,
                    },
                  })
                  .then(() => undefined),
            },
          );
          return null; // trả lỗi đồng nhất, không tiết lộ bị khoá
        }
```

- [ ] **Step 3: Enforcement trong callback `jwt`**

Trong callback `jwt`, thay `return token;` (dòng cuối cùng của callback, sau khối `else if (user) {...}`) bằng:

```ts
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tokenVersion: true },
        });
        const check = checkTokenVersion({
          tokenVersion: token.tokenVersion as number | undefined,
          dbVersion: dbUser?.tokenVersion ?? null,
        });
        if (check !== "valid") return null; // phiên bị thu hồi / user bị xóa
        token.tokenVersion = dbUser!.tokenVersion;
      }
      return token;
```

> Auth.js v5: trả `null` từ callback `jwt` ⇒ hủy phiên (user bị đăng xuất). Nếu `tsc` báo kiểu trả về của `jwt` không nhận `null`, thêm `// @ts-expect-error jwt callback trả null để hủy phiên` NGAY TRÊN dòng `return null;` — nhưng thử build trước, phiên bản này thường chấp nhận `null`.

- [ ] **Step 4: Kiểm tra type + build + test**

Run: `npx tsc --noEmit && npm test`
Expected: 0 lỗi type; toàn bộ test xanh (không vỡ auth hiện có).

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add auth.ts
git commit -m "feat(security): hủy phiên khi tokenVersion lệch + audit login bị rate-limit"
```

---

### Task 4: Tăng version — hằng audit + `revokeAllSessions` + reset increment

**Files:**
- Modify: `lib/audit/log.ts` (thêm hằng `sessionRevokeAll`)
- Create: `lib/auth/session-actions.ts`
- Modify: `lib/auth/reset-actions.ts` (applyReset increment tokenVersion)

**Interfaces:**
- Consumes: `requireUser` (`lib/auth/session`), `signOut` (`@/auth`), `recordAudit`/`AUDIT_ACTIONS`.
- Produces: `revokeAllSessions(): Promise<void>` (server action); `AUDIT_ACTIONS.sessionRevokeAll = "session.revoke_all"`.

- [ ] **Step 1: Thêm hằng audit**

Trong `lib/audit/log.ts`, thêm vào object `AUDIT_ACTIONS` (sau `userDelete`):

```ts
  sessionRevokeAll: "session.revoke_all",
```

- [ ] **Step 2: Server action `revokeAllSessions`**

Tạo `lib/auth/session-actions.ts`:

```ts
"use server";

import prisma from "@/lib/db/prisma";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/auth/session";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

export async function revokeAllSessions(): Promise<void> {
  const session = await requireUser();
  const userId = session.user!.id as string;

  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });

  await recordAudit(
    { action: AUDIT_ACTIONS.sessionRevokeAll, userId },
    {
      save: (en) =>
        prisma.auditLog
          .create({
            data: {
              action: en.action,
              userId: en.userId ?? undefined,
              targetId: en.targetId ?? undefined,
              ip: en.ip ?? undefined,
            },
          })
          .then(() => undefined),
    },
  );

  await signOut({ redirectTo: "/login" });
}
```

- [ ] **Step 3: Reset mật khẩu tăng tokenVersion**

Trong `lib/auth/reset-actions.ts`, trong `applyReset`, thêm `tokenVersion` vào lệnh cập nhật user (trong transaction, sau khi `consumed.count` đã > 0):

Thay:

```ts
        await tx.user.update({ where: { id: userId }, data: { passwordHash } });
```

bằng:

```ts
        await tx.user.update({
          where: { id: userId },
          data: { passwordHash, tokenVersion: { increment: 1 } },
        });
```

- [ ] **Step 4: Kiểm tra type + build + test**

Run: `npx tsc --noEmit && npm test`
Expected: 0 lỗi type; test xanh (test reset-actions/password-reset dùng fake deps nên không vỡ).

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/audit/log.ts lib/auth/session-actions.ts lib/auth/reset-actions.ts
git commit -m "feat(security): revokeAllSessions + reset mật khẩu thu hồi phiên"
```

---

### Task 5: Gia cố `getClientIp` (D1)

**Files:**
- Modify: `lib/security/ip.ts`
- Modify: `lib/security/__tests__/ip.test.ts`

**Interfaces:**
- Produces: `isValidIp(s: string): boolean`; `getClientIp(req: Request | undefined): string` (chữ ký giữ nguyên).

- [ ] **Step 1: Cập nhật test (thêm case mới, giữ case cũ)**

Thay toàn bộ `lib/security/__tests__/ip.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { getClientIp, isValidIp } from "../ip";

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://x", { headers });
}

afterEach(() => {
  delete process.env.CLIENT_IP_HEADER;
});

describe("isValidIp", () => {
  it("nhận IPv4 hợp lệ", () => {
    expect(isValidIp("9.9.9.9")).toBe(true);
    expect(isValidIp("192.168.0.1")).toBe(true);
  });
  it("từ chối IPv4 octet > 255", () => {
    expect(isValidIp("999.1.1.1")).toBe(false);
  });
  it("nhận IPv6 dạng cơ bản", () => {
    expect(isValidIp("::1")).toBe(true);
    expect(isValidIp("2001:db8::1")).toBe(true);
  });
  it("từ chối rác", () => {
    expect(isValidIp("not-an-ip")).toBe(false);
    expect(isValidIp("")).toBe(false);
  });
});

describe("getClientIp", () => {
  it("lấy IP đầu tiên từ x-forwarded-for", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });
  it("fallback x-real-ip", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  });
  it("XFF rác -> bỏ, fallback/unknown", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "garbage" }))).toBe("unknown");
    expect(getClientIp(reqWith({ "x-forwarded-for": "garbage", "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  });
  it("không có header -> 'unknown'", () => {
    expect(getClientIp(reqWith({}))).toBe("unknown");
    expect(getClientIp(undefined)).toBe("unknown");
  });
  it("tôn trọng CLIENT_IP_HEADER", () => {
    process.env.CLIENT_IP_HEADER = "cf-connecting-ip";
    expect(getClientIp(reqWith({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/security/__tests__/ip.test.ts`
Expected: FAIL (`isValidIp` chưa export / hành vi validate chưa có).

- [ ] **Step 3: Viết implementation**

Thay toàn bộ `lib/security/ip.ts`:

```ts
export function isValidIp(s: string): boolean {
  if (!s) return false;
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
    return s.split(".").every((o) => Number(o) <= 255);
  }
  // IPv6 (kiểm tra cơ bản: chỉ hex + dấu ':' và có ít nhất một ':')
  return /^[0-9a-fA-F:]+$/.test(s) && s.includes(":");
}

// Lấy IP client. Mô hình tin cậy: header chuyển tiếp (x-forwarded-for) chỉ đáng
// tin khi có proxy làm sạch nó (Vercel ghi đè giá trị client gửi -> đáng tin).
// Deploy tự host KHÔNG có proxy làm sạch: đặt CLIENT_IP_HEADER sang header mà chỉ
// proxy của bạn đặt.
export function getClientIp(req: Request | undefined): string {
  if (!req) return "unknown";
  const headerName = process.env.CLIENT_IP_HEADER || "x-forwarded-for";
  const raw = req.headers.get(headerName);
  if (raw) {
    const first = raw.split(",")[0].trim();
    if (isValidIp(first)) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real && isValidIp(real.trim())) return real.trim();
  return "unknown";
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/security/__tests__/ip.test.ts`
Expected: PASS (toàn bộ).

- [ ] **Step 5: Cập nhật `.env.example`**

Trong `.env.example`, thêm (sau khối APP_URL hoặc gần các biến bảo mật):

```
# (Tùy chọn) Header chứa IP client thật, do proxy của bạn đặt. Mặc định x-forwarded-for
# (đúng trên Vercel — nền tảng làm sạch header). Tự host không proxy: trỏ sang header tin cậy.
CLIENT_IP_HEADER="x-forwarded-for"
```

- [ ] **Step 6: Commit**

```bash
git add lib/security/ip.ts lib/security/__tests__/ip.test.ts .env.example
git commit -m "feat(security): getClientIp validate IP + header cấu hình được (chống spoof)"
```

---

### Task 6: Trang `/settings/security` — lịch sử đăng nhập + đăng xuất mọi thiết bị + link Navbar

**Files:**
- Create: `app/settings/security/page.tsx`
- Create: `app/settings/security/RevokeSessionsButton.tsx`
- Modify: `components/Navbar.tsx` (thêm link "Bảo mật")

**Interfaces:**
- Consumes: `requireUser` (`lib/auth/session`), `revokeAllSessions` (Task 4), `prisma.auditLog`.

- [ ] **Step 1: Nút "Đăng xuất mọi thiết bị" (client)**

Tạo `app/settings/security/RevokeSessionsButton.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { revokeAllSessions } from "@/lib/auth/session-actions";

export default function RevokeSessionsButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await revokeAllSessions(); // redirect -> /login khi thành công
      } catch {
        toast.error("Không thể đăng xuất các phiên. Thử lại sau.");
      }
    });
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)} disabled={isPending}>
        Đăng xuất khỏi mọi thiết bị
      </Button>
      <Dialog open={open} onOpenChange={(v) => !isPending && setOpen(v)}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Đăng xuất khỏi mọi thiết bị?</DialogTitle>
            <DialogDescription>
              Mọi phiên đăng nhập (kể cả phiên hiện tại) sẽ bị chấm dứt. Bạn cần đăng nhập lại.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Không
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Đang xử lý..." : "Đăng xuất tất cả"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

> `revokeAllSessions` gọi `signOut({ redirectTo })` nên khi thành công sẽ điều hướng (ném redirect nội bộ) — không tới `catch`. `catch` chỉ bắt lỗi thật.

- [ ] **Step 2: Trang `/settings/security`**

Tạo `app/settings/security/page.tsx`:

```tsx
import { requireUser } from "@/lib/auth/session";
import Navbar from "@/components/Navbar";
import prisma from "@/lib/db/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import RevokeSessionsButton from "./RevokeSessionsButton";

export default async function SecuritySettingsPage() {
  const session = await requireUser();
  const userId = session.user!.id as string;

  const logins = await prisma.auditLog.findMany({
    where: { userId, action: "login.success" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, ip: true, createdAt: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-xl flex-1 p-6">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Bảo mật</h1>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Đăng nhập gần đây</h2>
          {logins.length === 0 ? (
            <EmptyState title="Chưa có dữ liệu" description="Chưa ghi nhận lần đăng nhập nào." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">Thời gian</th>
                    <th className="p-3">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logins.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="p-3 text-foreground">
                        {new Date(l.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="p-3 text-muted-foreground">{l.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Phiên đăng nhập</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Nếu nghi ngờ tài khoản bị truy cập trái phép, hãy đăng xuất khỏi tất cả thiết bị.
          </p>
          <RevokeSessionsButton />
        </section>
      </main>
    </div>
  );
}
```

> Kiểm `components/ui/empty-state` có export `EmptyState` (Vòng trước dùng nhiều). Nếu tên khác, chỉnh import cho khớp; nếu không có, thay khối empty bằng `<p className="text-sm text-muted-foreground">Chưa ghi nhận lần đăng nhập nào.</p>`.

- [ ] **Step 3: Thêm link "Bảo mật" vào Navbar**

Trong `components/Navbar.tsx`, ngay TRƯỚC khối `<form action={...signOut...}>` (đoạn nút Đăng xuất, khối tài khoản đã đăng nhập), thêm:

```tsx
              <Link
                href="/settings/security"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Bảo mật
              </Link>
```

> `Link` và `buttonVariants` đã được import sẵn trong `Navbar.tsx` (kiểm phần đầu file; nếu thiếu thì thêm `import Link from "next/link";` / `import { buttonVariants } from "@/components/ui/button";`).

- [ ] **Step 4: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 lỗi type; build PASS; `/settings/security` xuất hiện trong route list.

- [ ] **Step 5: Commit**

```bash
git add app/settings/security components/Navbar.tsx
git commit -m "feat(security): trang /settings/security (lịch sử đăng nhập + đăng xuất mọi thiết bị)"
```

---

### Task 7: Kiểm tra tổng thể cuối

**Files:** (không sửa code — chỉ xác minh)

- [ ] **Step 1: Kiểm tra tổng thể**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: tsc 0 lỗi; lint 0 error (warning tồn đọng ở `schema.test.ts` + `cv/actions.ts` chấp nhận); toàn bộ test xanh; build PASS.

- [ ] **Step 2: (không commit nếu không có thay đổi)**

Nếu có chỉnh sửa nhỏ phát sinh, commit với message `chore(security): dọn cuối Vòng 2`.

---

## Việc người dùng phải tự làm sau khi merge

1. `npm run db:push` ở production (thêm cột `tokenVersion`).
2. (Tùy chọn) đặt `CLIENT_IP_HEADER` nếu tự host không phải Vercel.
3. Kiểm tay: mở 2 trình duyệt/đăng nhập 2 nơi → "Đăng xuất khỏi mọi thiết bị" đá cả hai; reset mật khẩu → phiên cũ bị đăng xuất; `/settings/security` hiển thị lịch sử đăng nhập.

## Để dành vòng sau

2FA/TOTP · liệt kê & thu hồi TỪNG phiên/thiết bị riêng lẻ (cần session store) · gắn login thất bại vào user để hiện trong lịch sử.
