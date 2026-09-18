# Dọn nợ type-safety truy cập session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Củng cố guard session (`roleAccess` kiểm cả `user.id`) và bỏ toàn bộ assertion dư thừa `session.user!.id as string` / `session.user!` trên nền tuyển dụng CV-AI — không đổi hành vi.

**Architecture:** `types/next-auth.d.ts` đã khai báo `Session.user.id: string`, nên `session.user.id` vốn có kiểu `string` — các `!`/`as string` là dư thừa. Task 1 vá khoảng trống type↔runtime trong `roleAccess` + đặt kiểu trả về tường minh `AuthedSession`; Task 2 quét bỏ assertion ở 6 file. Refactor: 524 test hiện có phải giữ xanh.

**Tech Stack:** TypeScript, NextAuth v5, Next.js 16, vitest 4.

## Global Constraints

- Refactor thuần — KHÔNG đổi hành vi runtime (ngoài việc `roleAccess`/`requireRole` coi session thiếu `user.id` là chưa đăng nhập, vốn không xảy ra thực tế).
- Toàn bộ 524 test hiện có phải giữ xanh sau mỗi task.
- Không thêm dependency; không đổi env/DB/UX.
- Kết thúc: `npx tsc --noEmit` 0, `npm run lint` 0 error (2 warning tồn đọng chấp nhận), `npm test` xanh, `npm run build` PASS.
- Commit tiếng Việt, prefix `refactor(auth):` / `test(auth):` / `chore(auth):`.

---

### Task 1: Củng cố `roleAccess` + kiểu trả về `AuthedSession`

**Files:**
- Modify: `lib/auth/session.ts`
- Test: `lib/auth/__tests__/session.test.ts`

**Interfaces:**
- Produces:
  - `roleAccess(session, role)` — nay trả `"login"` khi thiếu `session.user.id` (không chỉ thiếu user).
  - `type AuthedSession = Session & { user: { id: string } }`.
  - `requireUser(): Promise<AuthedSession>`, `requireRole(role): Promise<AuthedSession>` (kiểu trả về tường minh).

- [ ] **Step 1: Cập nhật test (thêm id vào case cũ + case thiếu id)**

Thay toàn bộ `lib/auth/__tests__/session.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { roleAccess } from "../session";

describe("roleAccess", () => {
  it("chua login -> login", () => {
    expect(roleAccess(null, "ADMIN")).toBe("login");
    expect(roleAccess({ user: null }, "RECRUITER")).toBe("login");
  });
  it("co user nhung thieu id -> login", () => {
    expect(roleAccess({ user: { role: "ADMIN" } }, "ADMIN")).toBe("login");
  });
  it("dung role (co id) -> ok", () => {
    expect(roleAccess({ user: { id: "u1", role: "ADMIN" } }, "ADMIN")).toBe("ok");
  });
  it("sai role (co id) -> forbidden", () => {
    expect(roleAccess({ user: { id: "u1", role: "CANDIDATE" } }, "RECRUITER")).toBe("forbidden");
  });
});
```

- [ ] **Step 2: Chạy test — case "thiếu id" phải FAIL**

Run: `npx vitest run lib/auth/__tests__/session.test.ts`
Expected: FAIL ở case "co user nhung thieu id -> login" (roleAccess hiện trả "ok"/"forbidden" vì chưa kiểm id).

- [ ] **Step 3: Sửa `lib/auth/session.ts`**

(a) Thêm import kiểu `Session` (đầu file, cạnh import `redirect`):
```ts
import type { Session } from "next-auth";
```

(b) Thay hàm `roleAccess` để kiểm `user.id`:
```ts
export function roleAccess(
  session: SessionLike,
  role: Role,
): "ok" | "login" | "forbidden" {
  if (!session?.user?.id) return "login";
  return session.user.role === role ? "ok" : "forbidden";
}
```

(c) Thêm alias + kiểu trả về tường minh cho `requireUser`/`requireRole`. Thay 2 hàm đó:
```ts
export type AuthedSession = Session & { user: { id: string } };

export async function requireUser(): Promise<AuthedSession> {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session!;
}

export async function requireRole(role: Role): Promise<AuthedSession> {
  const { auth } = await import("@/auth");
  const session = await auth();
  const access = roleAccess(session, role);
  if (access === "login") redirect("/login");
  if (access === "forbidden") redirect("/dashboard");
  return session!;
}
```

> `SessionLike` giữ nguyên (`{ user?: { id?: string; role?: string } | null } | null`). `getSessionUser` giữ nguyên. `return session!` là `Session` — gán được vào `AuthedSession` vì `Session.user.id` đã là `string` theo augmentation.

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/auth/__tests__/session.test.ts && npx tsc --noEmit`
Expected: 4 test PASS; 0 lỗi type.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/session.ts lib/auth/__tests__/session.test.ts
git commit -m "refactor(auth): roleAccess kiểm user.id + kiểu trả về AuthedSession"
```

---

### Task 2: Quét bỏ assertion dư thừa (6 file) + kiểm tra tổng thể

**Files:**
- Modify: `lib/admin/actions.ts`
- Modify: `lib/auth/session-actions.ts`
- Modify: `lib/auth/twofactor-actions.ts`
- Modify: `lib/jobs/ai-actions.ts`
- Modify: `lib/jobs/salary-suggest-actions.ts`
- Modify: `app/settings/security/page.tsx`

**Interfaces:**
- Consumes: `requireUser`/`requireRole` trả `AuthedSession` (Task 1) — nên `session.user.id` có kiểu `string` mà không cần assertion.

- [ ] **Step 1: Xác định các chỗ cần sửa**

Run: `grep -rn "session.user!" lib app --include=*.ts --include=*.tsx`
Expected: liệt kê ~10 chỗ ở 6 file trên.

- [ ] **Step 2: Sửa từng file — bỏ assertion dư thừa**

Ở MỖI chỗ khớp, áp dụng đúng 2 phép thay (chỉ với biến `session` đến từ `requireUser`/`requireRole`):
- `session.user!.id as string` → `session.user.id`
- `session.user!.id` → `session.user.id`
- `session.user!` (các dùng khác, vd `session.user!.role`) → `session.user`

READ từng file trước khi sửa để chắc biến `session` đúng là kết quả của `requireUser`/`requireRole`. Ví dụ minh hoạ (áp dụng cho mọi chỗ tương tự):

`lib/jobs/ai-actions.ts` / `lib/jobs/salary-suggest-actions.ts`:
```ts
// trước:
if (!(await checkRateLimit("ai", session.user!.id as string)))
// sau:
if (!(await checkRateLimit("ai", session.user.id)))
```

`lib/auth/session-actions.ts` / `lib/auth/twofactor-actions.ts`:
```ts
// trước:
const userId = session.user!.id as string;
// sau:
const userId = session.user.id;
```

`app/settings/security/page.tsx`:
```ts
// trước:
const userId = session.user!.id as string;
// sau:
const userId = session.user.id;
```

`lib/admin/actions.ts`:
```ts
// trước (deleteUserAsAdmin):
if (!canDeleteUser(session.user!.id, target).ok) return;
// ... recordAudit userId: session.user!.id ...
// sau:
if (!canDeleteUser(session.user.id, target).ok) return;
// ... recordAudit userId: session.user.id ...
```

> Nếu một chỗ `session` KHÔNG đến từ `requireUser`/`requireRole` (vd từ `auth()` trực tiếp, kiểu `Session | null`), GIỮ NGUYÊN assertion ở đó và ghi chú trong report — không ép bỏ.

- [ ] **Step 3: Kiểm tra không còn assertion dư (ở nơi đã sửa) + type**

Run: `grep -rn "session.user!" lib app --include=*.ts --include=*.tsx`
Expected: chỉ còn lại (nếu có) các chỗ `session` KHÔNG từ requireUser/requireRole (ghi chú); các chỗ đã sửa biến mất.

Run: `npx tsc --noEmit`
Expected: 0 lỗi — CHỨNG MINH các assertion là dư thừa (kiểu vẫn đúng khi bỏ).

- [ ] **Step 4: Kiểm tra tổng thể (bằng chứng không đổi hành vi)**

Run: `npm run lint && npm test && npm run build`
Expected: lint 0 error (2 warning tồn đọng ở `schema.test.ts` + `cv/actions.ts` chấp nhận); toàn bộ 524 test XANH (không đổi hành vi); build PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/actions.ts lib/auth/session-actions.ts lib/auth/twofactor-actions.ts lib/jobs/ai-actions.ts lib/jobs/salary-suggest-actions.ts app/settings/security/page.tsx
git commit -m "refactor(auth): bỏ assertion session.user! dư thừa (kiểu đã bảo đảm id:string)"
```

---

## Việc người dùng phải tự làm sau khi merge
Không có (refactor thuần).

## Để dành vòng sau
Rà `!`/`as` dư thừa ngoài truy cập session; thu hẹp kiểu trả về `getSessionUser`; e2e cho luồng mới.
