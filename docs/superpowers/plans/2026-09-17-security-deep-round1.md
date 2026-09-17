# Bảo mật sâu — Vòng 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm reset mật khẩu qua email, xác minh email (ép mềm), vá lỗ hổng ngầm (origin check, rate-limit fail-closed cho auth, siết CSP) và audit log bảo mật cho nền tuyển dụng CV-AI.

**Architecture:** Giữ đúng pattern sẵn có — logic thuần thuần với dependency-injection (test bằng vitest + fake deps), wiring mỏng ở server action / route handler gọi logic với deps thật (Prisma, `sendEmail`, bcrypt). Token dùng-một-lần lưu **SHA-256 hash** trong DB (bảng `AuthToken`), có hạn. Audit log ghi vào bảng `AuditLog`.

**Tech Stack:** Next.js 16.2.12 (App Router), NextAuth v5 (JWT, không adapter), Prisma 6 + Postgres (Neon), Zod 4, bcryptjs, Resend REST (email), vitest 4, TypeScript.

## Global Constraints

- Prisma pin v6 — KHÔNG nâng v7.
- Dùng `npm run db:push` để áp schema (dự án không dùng migrate).
- Mọi lệnh Node chạy qua script npm sẵn có (đã set `NODE_OPTIONS=--dns-result-order=ipv4first`).
- Prisma client import: `import prisma from "@/lib/db/prisma"`.
- Logic nghiệp vụ phải THUẦN + nhận deps qua tham số (không import prisma trong file logic) để test bằng fake deps.
- Copy tiếng Việt cho mọi text hiển thị & thông báo lỗi (khớp code hiện có).
- Không thêm dependency mới (email dùng Resend REST qua `fetch`, token dùng `node:crypto`).
- Kết thúc: `npx tsc --noEmit` 0 lỗi, `npm test` xanh, `npm run build` PASS.
- Mỗi commit message tiếng Việt, prefix `feat(security):` / `test(security):` / `chore(security):`.

---

### Task 1: Schema — `emailVerified`, `AuthToken`, `AuditLog`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: model `AuthToken` (fields: `id`, `userId`, `purpose`, `tokenHash` @unique, `expiresAt`, `usedAt?`, `createdAt`), enum `AuthTokenPurpose { EMAIL_VERIFY, PASSWORD_RESET }`, model `AuditLog` (fields: `id`, `userId?`, `action`, `targetId?`, `ip?`, `metadata?` Json, `createdAt`), field `User.emailVerified DateTime?`. Các task sau dùng `prisma.authToken` / `prisma.auditLog` và `user.emailVerified`.

- [ ] **Step 1: Thêm field vào model `User`**

Trong `model User`, thêm dòng sau (đặt ngay dưới `createdAt`):

```prisma
  emailVerified DateTime?
  authTokens    AuthToken[]
  auditLogs     AuditLog[]
```

- [ ] **Step 2: Thêm enum + 2 model mới**

Thêm vào cuối `prisma/schema.prisma`:

```prisma
enum AuthTokenPurpose {
  EMAIL_VERIFY
  PASSWORD_RESET
}

model AuthToken {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  purpose   AuthTokenPurpose
  tokenHash String           @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime         @default(now())

  @@index([userId, purpose])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action    String
  targetId  String?
  ip        String?
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

- [ ] **Step 3: Validate schema**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Generate client (cập nhật type cho TS)**

Run: `npx prisma generate`
Expected: `Generated Prisma Client` (không lỗi)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(security): schema emailVerified + AuthToken + AuditLog"
```

> **Lưu ý:** `npm run db:push` để áp vào DB thật là việc người dùng chạy (cần `DATABASE_URL`). Không chặn các task còn lại vì chúng test bằng fake deps.

---

### Task 2: Token helpers (`lib/auth/tokens.ts`)

**Files:**
- Create: `lib/auth/tokens.ts`
- Test: `lib/auth/__tests__/tokens.test.ts`

**Interfaces:**
- Produces:
  - `type AuthTokenPurpose = "EMAIL_VERIFY" | "PASSWORD_RESET"`
  - `generateToken(): { raw: string; hash: string }`
  - `hashToken(raw: string): string`
  - `tokenExpiry(purpose: AuthTokenPurpose, now?: Date): Date`

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/auth/__tests__/tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateToken, hashToken, tokenExpiry } from "../tokens";

describe("tokens", () => {
  it("generateToken tra ve raw + hash khop hashToken(raw)", () => {
    const { raw, hash } = generateToken();
    expect(raw.length).toBeGreaterThan(20);
    expect(hash).toBe(hashToken(raw));
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it("generateToken sinh raw khac nhau moi lan", () => {
    expect(generateToken().raw).not.toBe(generateToken().raw);
  });

  it("hashToken deterministic", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("tokenExpiry: EMAIL_VERIFY = 24h, PASSWORD_RESET = 1h", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(tokenExpiry("EMAIL_VERIFY", now).toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(tokenExpiry("PASSWORD_RESET", now).toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/auth/__tests__/tokens.test.ts`
Expected: FAIL ("Cannot find module '../tokens'").

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `lib/auth/tokens.ts`:

```ts
import { randomBytes, createHash } from "node:crypto";

export type AuthTokenPurpose = "EMAIL_VERIFY" | "PASSWORD_RESET";

const TTL_MS: Record<AuthTokenPurpose, number> = {
  EMAIL_VERIFY: 24 * 60 * 60_000,
  PASSWORD_RESET: 60 * 60_000,
};

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function tokenExpiry(purpose: AuthTokenPurpose, now: Date = new Date()): Date {
  return new Date(now.getTime() + TTL_MS[purpose]);
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/auth/__tests__/tokens.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/tokens.ts lib/auth/__tests__/tokens.test.ts
git commit -m "feat(security): token helpers (sinh/bam/han token)"
```

---

### Task 3: Audit log logic (`lib/audit/log.ts`)

**Files:**
- Create: `lib/audit/log.ts`
- Test: `lib/audit/__tests__/log.test.ts`

**Interfaces:**
- Produces:
  - `AUDIT_ACTIONS` (const object) + `type AuditAction`
  - `type AuditEntry = { userId?: string | null; action: AuditAction; targetId?: string | null; ip?: string | null; metadata?: Record<string, unknown> | null }`
  - `type RecordAuditDeps = { save: (e: AuditEntry) => Promise<void> }`
  - `recordAudit(entry: AuditEntry, deps: RecordAuditDeps): Promise<void>` — nuốt lỗi (không bao giờ ném).

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/audit/__tests__/log.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { recordAudit, AUDIT_ACTIONS } from "../log";

describe("recordAudit", () => {
  it("goi save voi entry", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await recordAudit({ action: AUDIT_ACTIONS.loginSuccess, userId: "u1", ip: "1.2.3.4" }, { save });
    expect(save).toHaveBeenCalledWith({
      action: "login.success",
      userId: "u1",
      ip: "1.2.3.4",
    });
  });

  it("nuot loi khi save that bai (khong nem)", async () => {
    const save = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(
      recordAudit({ action: AUDIT_ACTIONS.register, userId: "u2" }, { save }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/audit/__tests__/log.test.ts`
Expected: FAIL ("Cannot find module '../log'").

- [ ] **Step 3: Viết implementation**

Tạo `lib/audit/log.ts`:

```ts
export const AUDIT_ACTIONS = {
  loginSuccess: "login.success",
  loginFailure: "login.failure",
  register: "register",
  emailVerify: "email.verify",
  passwordResetRequest: "password.reset.request",
  passwordReset: "password.reset",
  roleChange: "role.change",
  userDelete: "user.delete",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditEntry = {
  userId?: string | null;
  action: AuditAction;
  targetId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type RecordAuditDeps = { save: (e: AuditEntry) => Promise<void> };

export async function recordAudit(entry: AuditEntry, deps: RecordAuditDeps): Promise<void> {
  try {
    await deps.save(entry);
  } catch (e) {
    console.warn("[audit] ghi log that bai:", e);
  }
}
```

> **Lưu ý kiểu Json khi wiring (Task 9/11/13):** cột `metadata` là `Json?`. Prisma không nhận trực tiếp `Record<string, unknown>`. Trong closure `save`, map an toàn:
> ```ts
> save: (en) =>
>   prisma.auditLog
>     .create({
>       data: {
>         action: en.action,
>         userId: en.userId ?? null,
>         targetId: en.targetId ?? null,
>         ip: en.ip ?? null,
>         metadata: (en.metadata ?? undefined) as import("@prisma/client").Prisma.InputJsonValue | undefined,
>       },
>     })
>     .then(() => undefined),
> ```
> Các task wiring dưới đây viết gọn `data: en` cho dễ đọc — nếu `tsc` báo lỗi kiểu `metadata`, dùng dạng map đầy đủ ở trên.

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/audit/__tests__/log.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add lib/audit/log.ts lib/audit/__tests__/log.test.ts
git commit -m "feat(security): audit log logic (recordAudit + AUDIT_ACTIONS)"
```

---

### Task 4: Email verification logic (`lib/auth/email-verification.ts`)

**Files:**
- Create: `lib/auth/email-verification.ts`
- Test: `lib/auth/__tests__/email-verification.test.ts`

**Interfaces:**
- Consumes: `generateToken`, `hashToken`, `tokenExpiry` từ Task 2.
- Produces:
  - `type CreateVerificationDeps = { createToken: (t: { userId: string; purpose: "EMAIL_VERIFY"; tokenHash: string; expiresAt: Date }) => Promise<void>; now?: () => Date }`
  - `createVerification(userId: string, deps: CreateVerificationDeps): Promise<{ raw: string }>`
  - `type StoredToken = { userId: string; purpose: string; expiresAt: Date; usedAt: Date | null }`
  - `type ConfirmVerificationResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "expired" | "used" }`
  - `type ConfirmVerificationDeps = { findToken: (tokenHash: string) => Promise<StoredToken | null>; markVerified: (tokenHash: string, userId: string, at: Date) => Promise<void>; now?: () => Date }`
  - `confirmVerification(rawToken: string, deps: ConfirmVerificationDeps): Promise<ConfirmVerificationResult>`

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/auth/__tests__/email-verification.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createVerification, confirmVerification } from "../email-verification";
import { hashToken } from "../tokens";

describe("createVerification", () => {
  it("tao token EMAIL_VERIFY va tra raw", async () => {
    const createToken = vi.fn().mockResolvedValue(undefined);
    const now = () => new Date("2026-01-01T00:00:00.000Z");
    const { raw } = await createVerification("u1", { createToken, now });
    expect(raw.length).toBeGreaterThan(20);
    const arg = createToken.mock.calls[0][0];
    expect(arg.userId).toBe("u1");
    expect(arg.purpose).toBe("EMAIL_VERIFY");
    expect(arg.tokenHash).toBe(hashToken(raw));
    expect(arg.expiresAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
  });
});

describe("confirmVerification", () => {
  const now = () => new Date("2026-01-01T12:00:00.000Z");

  it("token khong ton tai -> invalid", async () => {
    const findToken = vi.fn().mockResolvedValue(null);
    const markVerified = vi.fn();
    const r = await confirmVerification("raw", { findToken, markVerified, now });
    expect(r).toEqual({ ok: false, reason: "invalid" });
    expect(markVerified).not.toHaveBeenCalled();
  });

  it("token het han -> expired", async () => {
    const findToken = vi.fn().mockResolvedValue({
      userId: "u1", purpose: "EMAIL_VERIFY",
      expiresAt: new Date("2026-01-01T00:00:00.000Z"), usedAt: null,
    });
    const r = await confirmVerification("raw", { findToken, markVerified: vi.fn(), now });
    expect(r).toEqual({ ok: false, reason: "expired" });
  });

  it("token da dung -> used", async () => {
    const findToken = vi.fn().mockResolvedValue({
      userId: "u1", purpose: "EMAIL_VERIFY",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"), usedAt: new Date("2026-01-01T01:00:00.000Z"),
    });
    const r = await confirmVerification("raw", { findToken, markVerified: vi.fn(), now });
    expect(r).toEqual({ ok: false, reason: "used" });
  });

  it("token hop le -> ok + markVerified", async () => {
    const findToken = vi.fn().mockResolvedValue({
      userId: "u1", purpose: "EMAIL_VERIFY",
      expiresAt: new Date("2026-01-02T00:00:00.000Z"), usedAt: null,
    });
    const markVerified = vi.fn().mockResolvedValue(undefined);
    const r = await confirmVerification("raw", { findToken, markVerified, now });
    expect(r).toEqual({ ok: true, userId: "u1" });
    expect(findToken).toHaveBeenCalledWith(hashToken("raw"));
    expect(markVerified).toHaveBeenCalledWith(hashToken("raw"), "u1", now());
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/auth/__tests__/email-verification.test.ts`
Expected: FAIL ("Cannot find module '../email-verification'").

- [ ] **Step 3: Viết implementation**

Tạo `lib/auth/email-verification.ts`:

```ts
import { generateToken, hashToken, tokenExpiry } from "./tokens";

export type CreateVerificationDeps = {
  createToken: (t: {
    userId: string;
    purpose: "EMAIL_VERIFY";
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<void>;
  now?: () => Date;
};

export async function createVerification(
  userId: string,
  deps: CreateVerificationDeps,
): Promise<{ raw: string }> {
  const now = deps.now?.() ?? new Date();
  const { raw, hash } = generateToken();
  await deps.createToken({
    userId,
    purpose: "EMAIL_VERIFY",
    tokenHash: hash,
    expiresAt: tokenExpiry("EMAIL_VERIFY", now),
  });
  return { raw };
}

export type StoredToken = {
  userId: string;
  purpose: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type ConfirmVerificationResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

export type ConfirmVerificationDeps = {
  findToken: (tokenHash: string) => Promise<StoredToken | null>;
  markVerified: (tokenHash: string, userId: string, at: Date) => Promise<void>;
  now?: () => Date;
};

export async function confirmVerification(
  rawToken: string,
  deps: ConfirmVerificationDeps,
): Promise<ConfirmVerificationResult> {
  const now = deps.now?.() ?? new Date();
  const hash = hashToken(rawToken);
  const token = await deps.findToken(hash);
  if (!token || token.purpose !== "EMAIL_VERIFY") return { ok: false, reason: "invalid" };
  if (token.usedAt) return { ok: false, reason: "used" };
  if (token.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  await deps.markVerified(hash, token.userId, now);
  return { ok: true, userId: token.userId };
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/auth/__tests__/email-verification.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/email-verification.ts lib/auth/__tests__/email-verification.test.ts
git commit -m "feat(security): logic xac minh email (create/confirm)"
```

---

### Task 5: Password reset logic (`lib/auth/password-reset.ts`)

**Files:**
- Create: `lib/auth/password-reset.ts`
- Test: `lib/auth/__tests__/password-reset.test.ts`

**Interfaces:**
- Consumes: `generateToken`, `hashToken`, `tokenExpiry` (Task 2); `passwordStrength` từ `lib/auth/password-strength`; `StoredToken` (định nghĩa lại cục bộ để tránh phụ thuộc chéo).
- Produces:
  - `type RequestResetDeps = { findUser: (email: string) => Promise<{ id: string; hasPassword: boolean } | null>; createToken: (t: { userId: string; purpose: "PASSWORD_RESET"; tokenHash: string; expiresAt: Date }) => Promise<void>; now?: () => Date }`
  - `requestReset(email: string, deps: RequestResetDeps): Promise<{ raw: string; userId: string } | null>` (null = không gửi mail)
  - `type ConfirmResetResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "expired" | "used" | "weak"; message?: string }`
  - `type ConfirmResetDeps = { findToken: (tokenHash: string) => Promise<StoredToken | null>; hash: (pw: string) => Promise<string>; applyReset: (userId: string, passwordHash: string, tokenHash: string, at: Date) => Promise<void>; now?: () => Date }`
  - `confirmReset(rawToken: string, newPassword: string, deps: ConfirmResetDeps): Promise<ConfirmResetResult>`

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/auth/__tests__/password-reset.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { requestReset, confirmReset } from "../password-reset";
import { hashToken } from "../tokens";

describe("requestReset", () => {
  const now = () => new Date("2026-01-01T00:00:00.000Z");

  it("user khong ton tai -> null, khong tao token", async () => {
    const createToken = vi.fn();
    const r = await requestReset("no@x.com", {
      findUser: vi.fn().mockResolvedValue(null),
      createToken,
      now,
    });
    expect(r).toBeNull();
    expect(createToken).not.toHaveBeenCalled();
  });

  it("tai khoan chi-Google (hasPassword=false) -> null", async () => {
    const createToken = vi.fn();
    const r = await requestReset("g@x.com", {
      findUser: vi.fn().mockResolvedValue({ id: "u1", hasPassword: false }),
      createToken,
      now,
    });
    expect(r).toBeNull();
    expect(createToken).not.toHaveBeenCalled();
  });

  it("user co mat khau -> tao token PASSWORD_RESET (han 1h)", async () => {
    const createToken = vi.fn().mockResolvedValue(undefined);
    const r = await requestReset("a@x.com", {
      findUser: vi.fn().mockResolvedValue({ id: "u1", hasPassword: true }),
      createToken,
      now,
    });
    expect(r?.userId).toBe("u1");
    const arg = createToken.mock.calls[0][0];
    expect(arg.purpose).toBe("PASSWORD_RESET");
    expect(arg.tokenHash).toBe(hashToken(r!.raw));
    expect(arg.expiresAt.toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });
});

describe("confirmReset", () => {
  const now = () => new Date("2026-01-01T00:30:00.000Z");
  const valid = { userId: "u1", purpose: "PASSWORD_RESET", expiresAt: new Date("2026-01-01T01:00:00.000Z"), usedAt: null };

  it("token khong ton tai -> invalid", async () => {
    const r = await confirmReset("raw", "Str0ng!Pass9", {
      findToken: vi.fn().mockResolvedValue(null),
      hash: vi.fn(), applyReset: vi.fn(), now,
    });
    expect(r).toEqual({ ok: false, reason: "invalid" });
  });

  it("mat khau yeu -> weak, khong dung token", async () => {
    const applyReset = vi.fn();
    const r = await confirmReset("raw", "123", {
      findToken: vi.fn().mockResolvedValue(valid),
      hash: vi.fn(), applyReset, now,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("weak");
    expect(applyReset).not.toHaveBeenCalled();
  });

  it("token hop le + mat khau manh -> ok + applyReset", async () => {
    const applyReset = vi.fn().mockResolvedValue(undefined);
    const hash = vi.fn().mockResolvedValue("HASHED");
    const r = await confirmReset("raw", "Str0ng!Pass9", {
      findToken: vi.fn().mockResolvedValue(valid), hash, applyReset, now,
    });
    expect(r).toEqual({ ok: true, userId: "u1" });
    expect(applyReset).toHaveBeenCalledWith("u1", "HASHED", hashToken("raw"), now());
  });

  it("token het han -> expired", async () => {
    const r = await confirmReset("raw", "Str0ng!Pass9", {
      findToken: vi.fn().mockResolvedValue({ ...valid, expiresAt: new Date("2026-01-01T00:00:00.000Z") }),
      hash: vi.fn(), applyReset: vi.fn(), now,
    });
    expect(r).toEqual({ ok: false, reason: "expired" });
  });
});
```

> **Lưu ý mật khẩu test:** `"Str0ng!Pass9"` phải PASS `passwordStrength`. Nếu `passwordStrength` có quy tắc khác, chỉnh chuỗi cho hợp — mở `lib/auth/password-strength.ts` để xem yêu cầu và dùng một mật khẩu hợp lệ, một mật khẩu yếu (`"123"`).

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/auth/__tests__/password-reset.test.ts`
Expected: FAIL ("Cannot find module '../password-reset'").

- [ ] **Step 3: Viết implementation**

Tạo `lib/auth/password-reset.ts`:

```ts
import { generateToken, hashToken, tokenExpiry } from "./tokens";
import { passwordStrength } from "./password-strength";

type StoredToken = {
  userId: string;
  purpose: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type RequestResetDeps = {
  findUser: (email: string) => Promise<{ id: string; hasPassword: boolean } | null>;
  createToken: (t: {
    userId: string;
    purpose: "PASSWORD_RESET";
    tokenHash: string;
    expiresAt: Date;
  }) => Promise<void>;
  now?: () => Date;
};

export async function requestReset(
  email: string,
  deps: RequestResetDeps,
): Promise<{ raw: string; userId: string } | null> {
  const user = await deps.findUser(email);
  if (!user || !user.hasPassword) return null;
  const now = deps.now?.() ?? new Date();
  const { raw, hash } = generateToken();
  await deps.createToken({
    userId: user.id,
    purpose: "PASSWORD_RESET",
    tokenHash: hash,
    expiresAt: tokenExpiry("PASSWORD_RESET", now),
  });
  return { raw, userId: user.id };
}

export type ConfirmResetResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "weak"; message?: string };

export type ConfirmResetDeps = {
  findToken: (tokenHash: string) => Promise<StoredToken | null>;
  hash: (pw: string) => Promise<string>;
  applyReset: (userId: string, passwordHash: string, tokenHash: string, at: Date) => Promise<void>;
  now?: () => Date;
};

export async function confirmReset(
  rawToken: string,
  newPassword: string,
  deps: ConfirmResetDeps,
): Promise<ConfirmResetResult> {
  const now = deps.now?.() ?? new Date();
  const hash = hashToken(rawToken);
  const token = await deps.findToken(hash);
  if (!token || token.purpose !== "PASSWORD_RESET") return { ok: false, reason: "invalid" };
  if (token.usedAt) return { ok: false, reason: "used" };
  if (token.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };

  const strength = passwordStrength(newPassword);
  if (!strength.ok) return { ok: false, reason: "weak", message: strength.error };

  const passwordHash = await deps.hash(newPassword);
  await deps.applyReset(token.userId, passwordHash, hash, now);
  return { ok: true, userId: token.userId };
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/auth/__tests__/password-reset.test.ts`
Expected: PASS (7 test). Nếu test "weak"/"strong" sai do quy tắc mật khẩu khác, chỉnh chuỗi theo `password-strength.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/password-reset.ts lib/auth/__tests__/password-reset.test.ts
git commit -m "feat(security): logic reset mat khau (request/confirm)"
```

---

### Task 6: Rate-limit fail-closed cho scope auth

**Files:**
- Modify: `lib/security/rate-config.ts`
- Modify: `lib/security/ratelimit.ts:46-62`
- Test: `lib/security/__tests__/rate-config.test.ts` (mới)

**Interfaces:**
- Consumes: `RATE_LIMITS`, `RateScope`.
- Produces: `RateScope` thêm `"passwordReset"`; mỗi entry `RATE_LIMITS` có thêm `failClosed?: boolean`. `checkRateLimit` khi Upstash lỗi: scope `failClosed` → trả `false`, còn lại → `true`.

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/security/__tests__/rate-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { RATE_LIMITS } from "../rate-config";

describe("RATE_LIMITS fail-closed", () => {
  it("scope auth danh dau failClosed", () => {
    expect(RATE_LIMITS.login.failClosed).toBe(true);
    expect(RATE_LIMITS.register.failClosed).toBe(true);
    expect(RATE_LIMITS.passwordReset.failClosed).toBe(true);
  });

  it("scope ai/mutation KHONG fail-closed", () => {
    expect(RATE_LIMITS.ai.failClosed).toBeFalsy();
    expect(RATE_LIMITS.mutation.failClosed).toBeFalsy();
  });

  it("passwordReset co cau hinh gioi han", () => {
    expect(RATE_LIMITS.passwordReset.max).toBeGreaterThan(0);
    expect(RATE_LIMITS.passwordReset.windowMs).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/security/__tests__/rate-config.test.ts`
Expected: FAIL (`passwordReset` chưa tồn tại / `failClosed` undefined).

- [ ] **Step 3: Cập nhật `rate-config.ts`**

Thay toàn bộ nội dung `lib/security/rate-config.ts`:

```ts
export type RateScope = "login" | "register" | "ai" | "mutation" | "passwordReset";

export const RATE_LIMITS: Record<
  RateScope,
  { max: number; windowMs: number; failClosed?: boolean }
> = {
  login: { max: 5, windowMs: 15 * 60_000, failClosed: true }, // 5 / 15 phút
  register: { max: 5, windowMs: 60 * 60_000, failClosed: true }, // 5 / giờ
  passwordReset: { max: 5, windowMs: 60 * 60_000, failClosed: true }, // 5 / giờ
  ai: { max: 20, windowMs: 60 * 60_000 }, // 20 / giờ
  mutation: { max: 30, windowMs: 60_000 }, // 30 / phút
};
```

- [ ] **Step 4: Cập nhật catch trong `ratelimit.ts`**

Trong `lib/security/ratelimit.ts`, sửa khối `catch` của `checkRateLimit` (dòng ~58-61):

```ts
  } catch (e) {
    console.warn("[ratelimit] Upstash lỗi:", e);
    // Scope nhạy cảm (auth) fail-closed; scope khác fail-open để giữ uptime.
    return !RATE_LIMITS[scope].failClosed;
  }
```

- [ ] **Step 5: Chạy test — phải PASS**

Run: `npx vitest run lib/security/__tests__/rate-config.test.ts lib/security/__tests__/ratelimit.test.ts`
Expected: PASS (test cũ vẫn xanh + 3 test mới).

- [ ] **Step 6: Commit**

```bash
git add lib/security/rate-config.ts lib/security/ratelimit.ts lib/security/__tests__/rate-config.test.ts
git commit -m "feat(security): rate-limit fail-closed cho auth + scope passwordReset"
```

---

### Task 7: Origin check cho route handlers (`lib/security/origin.ts`)

**Files:**
- Create: `lib/security/origin.ts`
- Test: `lib/security/__tests__/origin.test.ts`
- Modify: `app/api/register/route.ts`, `app/api/cv/[id]/evaluate/route.ts`, `app/api/cv/[id]/analyze/route.ts`, `app/api/cv/[id]/chat/route.ts`, `app/api/jobs/[id]/view/route.ts`

**Interfaces:**
- Produces:
  - `isTrustedOrigin(h: { origin: string | null; referer: string | null; host: string | null }, appUrl?: string): boolean`
  - `assertSameOrigin(req: Request): boolean` — đọc header từ `req` + `process.env.APP_URL`.

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/security/__tests__/origin.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isTrustedOrigin } from "../origin";

describe("isTrustedOrigin", () => {
  const APP = "https://app.example.com";

  it("origin khop host -> true", () => {
    expect(isTrustedOrigin({ origin: "https://app.example.com", referer: null, host: "app.example.com" })).toBe(true);
  });

  it("origin khop APP_URL -> true", () => {
    expect(isTrustedOrigin({ origin: "https://app.example.com", referer: null, host: null }, APP)).toBe(true);
  });

  it("origin la site khac -> false", () => {
    expect(isTrustedOrigin({ origin: "https://evil.com", referer: null, host: "app.example.com" }, APP)).toBe(false);
  });

  it("khong co origin nhung referer cung host -> true", () => {
    expect(isTrustedOrigin({ origin: null, referer: "https://app.example.com/jobs", host: "app.example.com" })).toBe(true);
  });

  it("khong co origin lan referer -> true (khong the xac dinh, cho qua)", () => {
    expect(isTrustedOrigin({ origin: null, referer: null, host: "app.example.com" })).toBe(true);
  });

  it("referer site khac -> false", () => {
    expect(isTrustedOrigin({ origin: null, referer: "https://evil.com/x", host: "app.example.com" })).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/security/__tests__/origin.test.ts`
Expected: FAIL ("Cannot find module '../origin'").

- [ ] **Step 3: Viết implementation**

Tạo `lib/security/origin.ts`:

```ts
function originOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isTrustedOrigin(
  h: { origin: string | null; referer: string | null; host: string | null },
  appUrl?: string,
): boolean {
  const allowed = new Set<string>();
  const app = originOf(appUrl ?? null);
  if (app) allowed.add(app);
  if (h.host) {
    allowed.add(`https://${h.host}`);
    allowed.add(`http://${h.host}`);
  }
  // Không có chỉ dấu trình duyệt nào -> không thể kết luận CSRF, cho qua.
  if (!h.origin && !h.referer) return true;
  if (h.origin) return allowed.has(h.origin);
  return allowed.has(originOf(h.referer)!);
}

export function assertSameOrigin(req: Request): boolean {
  return isTrustedOrigin(
    {
      origin: req.headers.get("origin"),
      referer: req.headers.get("referer"),
      host: req.headers.get("host"),
    },
    process.env.APP_URL,
  );
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/security/__tests__/origin.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Wire vào 5 route handler đổi trạng thái**

Ở ĐẦU mỗi hàm `POST`/`PUT` (sau khi vào `try`, trước rate-limit) của 5 file:
`app/api/register/route.ts`, `app/api/cv/[id]/evaluate/route.ts`, `app/api/cv/[id]/analyze/route.ts`,
`app/api/cv/[id]/chat/route.ts`, `app/api/jobs/[id]/view/route.ts` — thêm import + guard:

```ts
import { assertSameOrigin } from "@/lib/security/origin";
```

```ts
    if (!assertSameOrigin(req)) {
      return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
    }
```

> Với file dùng tên tham số khác `req` (vd `request`), đổi cho khớp. Nếu file chưa import `NextResponse`, thêm `import { NextResponse } from "next/server";`. Với `jobs/[id]/view` (beacon) nếu đang trả `new Response(null, ...)` thì trả `new Response("forbidden", { status: 403 })` thay cho `NextResponse.json`.

- [ ] **Step 6: Kiểm tra type + test toàn bộ**

Run: `npx tsc --noEmit && npx vitest run lib/security`
Expected: 0 lỗi type; test security xanh.

- [ ] **Step 7: Commit**

```bash
git add lib/security/origin.ts lib/security/__tests__/origin.test.ts app/api
git commit -m "feat(security): origin check cho route handler doi trang thai"
```

---

### Task 8: Email templates (`lib/email/templates.ts`)

**Files:**
- Create: `lib/email/templates.ts`
- Test: `lib/email/__tests__/templates.test.ts`

**Interfaces:**
- Produces: `verifyEmailHtml(link: string): string`, `resetPasswordHtml(link: string): string`.

> **Kiểm tra trước:** mở thư mục `lib/email/templates/` (đã có `status-change`). Nếu đã có quy ước layout email dùng chung, theo nó. Nếu không, dùng bản dưới.

- [ ] **Step 1: Viết test thất bại**

Tạo `lib/email/__tests__/templates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { verifyEmailHtml, resetPasswordHtml } from "../templates";

describe("email templates", () => {
  it("verifyEmailHtml chua link + loi keu goi", () => {
    const html = verifyEmailHtml("https://app/verify-email?token=abc");
    expect(html).toContain("https://app/verify-email?token=abc");
    expect(html.toLowerCase()).toContain("xác minh");
  });

  it("resetPasswordHtml chua link + het han 1 gio", () => {
    const html = resetPasswordHtml("https://app/reset-password?token=xyz");
    expect(html).toContain("https://app/reset-password?token=xyz");
    expect(html).toContain("1 giờ");
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/email/__tests__/templates.test.ts`
Expected: FAIL ("Cannot find module '../templates'").

- [ ] **Step 3: Viết implementation**

Tạo `lib/email/templates.ts`:

```ts
function wrap(title: string, body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#4f46e5">${title}</h2>
    ${body}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
  </div>`;
}

export function verifyEmailHtml(link: string): string {
  return wrap(
    "Xác minh email",
    `<p>Nhấn nút dưới để xác minh địa chỉ email của bạn:</p>
     <p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Xác minh email</a></p>
     <p style="color:#64748b;font-size:13px">Hoặc mở liên kết: <br>${link}</p>`,
  );
}

export function resetPasswordHtml(link: string): string {
  return wrap(
    "Đặt lại mật khẩu",
    `<p>Nhấn nút dưới để đặt lại mật khẩu (liên kết hết hạn sau 1 giờ):</p>
     <p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Đặt lại mật khẩu</a></p>
     <p style="color:#64748b;font-size:13px">Hoặc mở liên kết: <br>${link}</p>`,
  );
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/email/__tests__/templates.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add lib/email/templates.ts lib/email/__tests__/templates.test.ts
git commit -m "feat(security): email template xac minh + reset mat khau"
```

---

### Task 9: Wire đăng ký gửi email xác minh + OAuth auto-verify

**Files:**
- Modify: `app/api/register/route.ts`
- Modify: `auth.ts:44-77` (callback jwt cho Google)

**Interfaces:**
- Consumes: `createVerification` (Task 4), `verifyEmailHtml` (Task 8), `sendEmail`, `recordAudit`+`AUDIT_ACTIONS` (Task 3), `assertSameOrigin` (Task 7 — đã thêm ở Task 7 Step 5).

- [ ] **Step 1: Sau khi register thành công, tạo token + gửi mail + audit**

Trong `app/api/register/route.ts`, sau khối `if (!result.ok) {...}` và trước `return ... 201`, chèn:

```ts
    // Tạo token xác minh + gửi email (bỏ qua êm nếu chưa cấu hình email).
    try {
      const { raw } = await createVerification(result.userId, {
        createToken: (t) => prisma.authToken.create({ data: t }).then(() => undefined),
      });
      const link = `${process.env.APP_URL ?? ""}/verify-email?token=${raw}`;
      await sendEmail({
        to: body.email,
        subject: "Xác minh email của bạn",
        html: verifyEmailHtml(link),
      });
    } catch (e) {
      console.warn("[register] gửi email xác minh thất bại:", e);
    }
    await recordAudit(
      { action: AUDIT_ACTIONS.register, userId: result.userId, ip },
      { save: (en) => prisma.auditLog.create({ data: en }).then(() => undefined) },
    );
```

Thêm import ở đầu file:

```ts
import { createVerification } from "@/lib/auth/email-verification";
import { verifyEmailHtml } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
```

- [ ] **Step 2: OAuth Google auto-verify email**

Trong `auth.ts`, trong nhánh `createUser` của `resolveOAuthUser` (dòng ~63-67), thêm `emailVerified`:

```ts
            createUser: (email, name) =>
              prisma.user.create({
                data: { email, name, role: "CANDIDATE", emailVerified: new Date() },
                select: { id: true, role: true },
              }),
```

- [ ] **Step 3: Kiểm tra type + build**

Run: `npx tsc --noEmit`
Expected: 0 lỗi.

- [ ] **Step 4: Chạy toàn bộ test (đảm bảo không vỡ)**

Run: `npm test`
Expected: toàn bộ xanh.

- [ ] **Step 5: Commit**

```bash
git add app/api/register/route.ts auth.ts
git commit -m "feat(security): dang ky gui email xac minh + OAuth auto-verify + audit"
```

---

### Task 10: Trang xác minh email + gửi lại

**Files:**
- Create: `app/verify-email/page.tsx`
- Create: `lib/auth/verify-actions.ts` (server action gửi lại)
- Modify: `app/api/register/route.ts` không đổi.

**Interfaces:**
- Consumes: `confirmVerification` (Task 4), `createVerification` (Task 4), `recordAudit` (Task 3), `checkRateLimit` (scope `register`), `getSessionUser` (`lib/auth/session`).

- [ ] **Step 1: Trang `/verify-email` xử lý token**

Tạo `app/verify-email/page.tsx`:

```tsx
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { confirmVerification } from "@/lib/auth/email-verification";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
import { Button } from "@/components/ui/button";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let state: "ok" | "invalid" | "expired" | "used" | "missing" = "missing";

  if (token) {
    const result = await confirmVerification(token, {
      findToken: (tokenHash) =>
        prisma.authToken.findUnique({
          where: { tokenHash },
          select: { userId: true, purpose: true, expiresAt: true, usedAt: true },
        }),
      markVerified: async (tokenHash, userId, at) => {
        await prisma.$transaction([
          prisma.authToken.update({ where: { tokenHash }, data: { usedAt: at } }),
          prisma.user.update({ where: { id: userId }, data: { emailVerified: at } }),
        ]);
      },
    });
    state = result.ok ? "ok" : result.reason;
    if (result.ok) {
      await recordAudit(
        { action: AUDIT_ACTIONS.emailVerify, userId: result.userId },
        { save: (en) => prisma.auditLog.create({ data: en }).then(() => undefined) },
      );
    }
  }

  const MESSAGES: Record<typeof state, string> = {
    ok: "Email của bạn đã được xác minh. Cảm ơn bạn!",
    invalid: "Liên kết không hợp lệ.",
    expired: "Liên kết đã hết hạn. Hãy yêu cầu gửi lại email xác minh.",
    used: "Liên kết đã được sử dụng.",
    missing: "Thiếu mã xác minh.",
  };

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="mb-3 text-xl font-bold text-foreground">Xác minh email</h1>
        <p className="mb-6 text-sm text-muted-foreground">{MESSAGES[state]}</p>
        <Button asChild>
          <Link href="/dashboard">Về trang tổng quan</Link>
        </Button>
      </div>
    </div>
  );
}
```

> Nếu `Button` (Base UI/shadcn của dự án) không hỗ trợ `asChild`, thay bằng `<Link className={buttonVariants()} href="/dashboard">…</Link>` (import `buttonVariants` từ `@/components/ui/button`). Kiểm `components/ui/button.tsx` để biết.

- [ ] **Step 2: Server action gửi lại email xác minh**

Tạo `lib/auth/verify-actions.ts`:

```ts
"use server";

import prisma from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { createVerification } from "@/lib/auth/email-verification";
import { verifyEmailHtml } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/security/ratelimit";

export async function resendVerification(): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user?.id) return { ok: false, error: "Chưa đăng nhập" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, emailVerified: true },
  });
  if (!dbUser) return { ok: false, error: "Không tìm thấy tài khoản" };
  if (dbUser.emailVerified) return { ok: true }; // đã xác minh, không gửi lại

  if (!(await checkRateLimit("register", user.id)))
    return { ok: false, error: "Bạn thao tác quá nhiều lần, thử lại sau" };

  const { raw } = await createVerification(user.id, {
    createToken: (t) => prisma.authToken.create({ data: t }).then(() => undefined),
  });
  const link = `${process.env.APP_URL ?? ""}/verify-email?token=${raw}`;
  await sendEmail({ to: dbUser.email, subject: "Xác minh email của bạn", html: verifyEmailHtml(link) });
  return { ok: true };
}
```

- [ ] **Step 3: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 lỗi, build PASS (trang `/verify-email` xuất hiện trong output).

- [ ] **Step 4: Commit**

```bash
git add app/verify-email/page.tsx lib/auth/verify-actions.ts
git commit -m "feat(security): trang xac minh email + gui lai"
```

---

### Task 11: Luồng quên & reset mật khẩu (trang + actions)

**Files:**
- Create: `lib/auth/reset-actions.ts`
- Create: `app/forgot-password/page.tsx`
- Create: `app/reset-password/page.tsx`
- Modify: `app/login/page.tsx:45-46` (thêm link "Quên mật khẩu?")

**Interfaces:**
- Consumes: `requestReset`, `confirmReset` (Task 5), `resetPasswordHtml` (Task 8), `sendEmail`, `recordAudit` (Task 3), `checkRateLimit("passwordReset")` (Task 6), `hashPassword` (`lib/auth/password`), `getClientIp` (`lib/security/ip`).
- Produces: server actions `requestPasswordReset(formData)`, `confirmPasswordReset(formData)`.

- [ ] **Step 1: Server actions**

Tạo `lib/auth/reset-actions.ts`:

```ts
"use server";

import { headers } from "next/headers";
import prisma from "@/lib/db/prisma";
import { requestReset, confirmReset } from "@/lib/auth/password-reset";
import { resetPasswordHtml } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

const GENERIC = "Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu.";

export async function requestPasswordReset(
  _prev: unknown,
  formData: FormData,
): Promise<{ message: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const ip = getClientIp(new Request("http://x", { headers: await headers() }));

  if (!email || !(await checkRateLimit("passwordReset", ip))) return { message: GENERIC };

  const res = await requestReset(email, {
    findUser: async (e) => {
      const u = await prisma.user.findUnique({
        where: { email: e },
        select: { id: true, passwordHash: true },
      });
      return u ? { id: u.id, hasPassword: !!u.passwordHash } : null;
    },
    createToken: (t) => prisma.authToken.create({ data: t }).then(() => undefined),
  });

  if (res) {
    const link = `${process.env.APP_URL ?? ""}/reset-password?token=${res.raw}`;
    await sendEmail({ to: email, subject: "Đặt lại mật khẩu", html: resetPasswordHtml(link) });
    await recordAudit(
      { action: AUDIT_ACTIONS.passwordResetRequest, userId: res.userId, ip },
      { save: (en) => prisma.auditLog.create({ data: en }).then(() => undefined) },
    );
  }
  return { message: GENERIC };
}

export async function confirmPasswordReset(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  const res = await confirmReset(token, password, {
    findToken: (tokenHash) =>
      prisma.authToken.findUnique({
        where: { tokenHash },
        select: { userId: true, purpose: true, expiresAt: true, usedAt: true },
      }),
    hash: hashPassword,
    applyReset: async (userId, passwordHash, tokenHash, at) => {
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
        prisma.authToken.update({ where: { tokenHash }, data: { usedAt: at } }),
        // Vô hiệu mọi token reset khác còn hiệu lực của user.
        prisma.authToken.updateMany({
          where: { userId, purpose: "PASSWORD_RESET", usedAt: null },
          data: { usedAt: at },
        }),
      ]);
    },
  });

  if (res.ok) {
    await recordAudit(
      { action: AUDIT_ACTIONS.passwordReset, userId: res.userId },
      { save: (en) => prisma.auditLog.create({ data: en }).then(() => undefined) },
    );
    return { ok: true, message: "Đặt lại mật khẩu thành công. Hãy đăng nhập lại." };
  }
  const MSG: Record<string, string> = {
    invalid: "Liên kết không hợp lệ.",
    expired: "Liên kết đã hết hạn.",
    used: "Liên kết đã được sử dụng.",
    weak: res.message ?? "Mật khẩu chưa đủ mạnh.",
  };
  return { ok: false, message: MSG[res.reason] };
}
```

> **Lưu ý IP trong server action:** dùng `headers()` của Next 16 (async) bọc thành `Request` để tái dùng `getClientIp`. Nếu `getClientIp` xử lý được `Headers` trực tiếp thì gọi thẳng — kiểm `lib/security/ip.ts`.

- [ ] **Step 2: Trang `/forgot-password`**

Tạo `app/forgot-password/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth/reset-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-foreground">Quên mật khẩu</h1>
        {state?.message ? (
          <p className="text-center text-sm text-muted-foreground">{state.message}</p>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <Input name="email" type="email" placeholder="Email" required />
            <Button type="submit" disabled={pending}>
              {pending ? "Đang gửi..." : "Gửi liên kết đặt lại"}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">Về đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Trang `/reset-password`**

Tạo `app/reset-password/page.tsx`:

```tsx
"use client";

import { use } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { confirmPasswordReset } from "@/lib/auth/reset-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = use(searchParams);
  const [state, action, pending] = useActionState(confirmPasswordReset, null);

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-foreground">Đặt lại mật khẩu</h1>
        {state?.ok ? (
          <p className="text-center text-sm text-muted-foreground">{state.message}</p>
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="token" value={token ?? ""} />
            <Input name="password" type="password" placeholder="Mật khẩu mới" required />
            {state?.message && <p className="text-sm text-red-600">{state.message}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu..." : "Đặt lại mật khẩu"}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">Về đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Thêm link "Quên mật khẩu?" ở trang login**

Trong `app/login/page.tsx`, ngay sau dòng `<Input name="password" ... />` (dòng 45), thêm:

```tsx
            <Link href="/forgot-password" className="self-end text-xs text-muted-foreground hover:text-primary">
              Quên mật khẩu?
            </Link>
```

(`Link` đã được import sẵn ở file này.)

- [ ] **Step 5: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 lỗi; build có `/forgot-password` và `/reset-password`.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/reset-actions.ts app/forgot-password app/reset-password app/login/page.tsx
git commit -m "feat(security): luong quen & reset mat khau"
```

---

### Task 12: Ép mềm — chặn ứng tuyển/đăng tin khi chưa xác minh + banner

**Files:**
- Create: `lib/auth/require-verified.ts`
- Test: `lib/auth/__tests__/require-verified.test.ts`
- Modify: `lib/applications/actions.ts:106-113` (submitApplication)
- Modify: `lib/jobs/actions.ts:12` (createJobDescription)
- Create: `components/VerifyEmailBanner.tsx`
- Modify: `app/dashboard/page.tsx` (render banner khi chưa xác minh)

**Interfaces:**
- Produces:
  - `isEmailVerified(user: { emailVerified: Date | null } | null): boolean`
  - `VERIFY_REQUIRED_MESSAGE` (const string).

- [ ] **Step 1: Viết test thất bại cho helper**

Tạo `lib/auth/__tests__/require-verified.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isEmailVerified } from "../require-verified";

describe("isEmailVerified", () => {
  it("null user -> false", () => {
    expect(isEmailVerified(null)).toBe(false);
  });
  it("emailVerified null -> false", () => {
    expect(isEmailVerified({ emailVerified: null })).toBe(false);
  });
  it("co emailVerified -> true", () => {
    expect(isEmailVerified({ emailVerified: new Date() })).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/auth/__tests__/require-verified.test.ts`
Expected: FAIL ("Cannot find module '../require-verified'").

- [ ] **Step 3: Viết helper**

Tạo `lib/auth/require-verified.ts`:

```ts
export const VERIFY_REQUIRED_MESSAGE =
  "Vui lòng xác minh email trước khi thực hiện thao tác này.";

export function isEmailVerified(
  user: { emailVerified: Date | null } | null,
): boolean {
  return !!user?.emailVerified;
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/auth/__tests__/require-verified.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Gate `submitApplication`**

Trong `lib/applications/actions.ts`, ngay sau khối kiểm role CANDIDATE trong `submitApplication` (sau dòng 110), trước rate-limit, thêm:

```ts
  const verified = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  if (!isEmailVerified(verified))
    return { ok: false, error: VERIFY_REQUIRED_MESSAGE };
```

Thêm import đầu file:

```ts
import { isEmailVerified, VERIFY_REQUIRED_MESSAGE } from "@/lib/auth/require-verified";
```

- [ ] **Step 6: Gate `createJobDescription`**

Trong `lib/jobs/actions.ts`, ngay sau `const session = await requireRole("RECRUITER");`, thêm:

```ts
  const rec = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  if (!isEmailVerified(rec)) redirect("/dashboard?verify=1");
```

Thêm import: `import { isEmailVerified } from "@/lib/auth/require-verified";` (`redirect` và `prisma` đã có sẵn trong file).

- [ ] **Step 7: Banner nhắc xác minh**

Tạo `components/VerifyEmailBanner.tsx`:

```tsx
"use client";

import { useState } from "react";
import { resendVerification } from "@/lib/auth/verify-actions";

export default function VerifyEmailBanner() {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function onResend() {
    setSending(true);
    const r = await resendVerification();
    setSending(false);
    setMsg(r.ok ? "Đã gửi lại email xác minh (nếu email được cấu hình)." : r.error ?? "Có lỗi xảy ra");
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
      <span>Email của bạn chưa được xác minh. Một số thao tác (ứng tuyển, đăng tin) sẽ bị hạn chế.</span>
      <button
        onClick={onResend}
        disabled={sending}
        className="font-medium underline underline-offset-2 disabled:opacity-60"
      >
        {sending ? "Đang gửi..." : "Gửi lại email xác minh"}
      </button>
      {msg && <span className="text-amber-700 dark:text-amber-300">{msg}</span>}
    </div>
  );
}
```

- [ ] **Step 8: Render banner ở dashboard khi chưa xác minh**

Trong `app/dashboard/page.tsx`: đọc `emailVerified` của user hiện tại và render `<VerifyEmailBanner />` ở đầu nội dung nếu chưa xác minh. Mẫu (chỉnh cho khớp cấu trúc file thật):

```tsx
import prisma from "@/lib/db/prisma";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import { isEmailVerified } from "@/lib/auth/require-verified";
// ... trong component, sau khi có session.user.id:
const me = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: { emailVerified: true },
});
// ... trong JSX, ngay đầu khối nội dung:
{!isEmailVerified(me) && <VerifyEmailBanner />}
```

> Mở `app/dashboard/page.tsx` để lấy đúng tên biến session và vị trí JSX. Nếu dashboard rẽ nhánh theo role, đặt banner ở nơi cả hai role đều thấy (đầu `main`/container).

- [ ] **Step 9: Kiểm tra type + test + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: 0 lỗi type; test xanh; build PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/auth/require-verified.ts lib/auth/__tests__/require-verified.test.ts lib/applications/actions.ts lib/jobs/actions.ts components/VerifyEmailBanner.tsx app/dashboard/page.tsx
git commit -m "feat(security): ep mem xac minh email (chan ung tuyen/dang tin) + banner"
```

---

### Task 13: Audit wiring — login + admin actions

**Files:**
- Modify: `auth.ts` (authorize callback — login success/failure)
- Modify: `lib/admin/actions.ts` (deleteUserAsAdmin)

> **Về `role.change`:** repo KHÔNG có action đổi role trên web — việc thăng ADMIN chỉ qua CLI `scripts/make-admin.ts` (`promoteToAdmin`). Vòng 1 KHÔNG ghi audit cho role change (không có luồng web để chặn/ghi). Hằng `AUDIT_ACTIONS.roleChange` vẫn giữ để dùng sau. Task này chỉ wiring `login.*` + `user.delete`.

**Interfaces:**
- Consumes: `recordAudit`, `AUDIT_ACTIONS` (Task 3), `getClientIp` (`lib/security/ip`).

- [ ] **Step 1: Ghi audit login success/failure**

Trong `auth.ts`, trong `authorize` của Credentials, sau khi có kết quả `resolveCredentials`, ghi audit. Thay `return resolveCredentials(...)` bằng:

```ts
        const authed = await resolveCredentials(email, password, {
          findByEmail: (e) =>
            prisma.user.findUnique({
              where: { email: e },
              select: { id: true, email: true, name: true, role: true, passwordHash: true },
            }),
          verify: verifyPassword,
        });

        await recordAudit(
          {
            action: authed ? AUDIT_ACTIONS.loginSuccess : AUDIT_ACTIONS.loginFailure,
            userId: authed?.id ?? null,
            ip,
            metadata: authed ? null : { email },
          },
          { save: (en) => prisma.auditLog.create({ data: en }).then(() => undefined) },
        );
        return authed;
```

Thêm import đầu `auth.ts`:

```ts
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";
```

- [ ] **Step 2: Ghi audit xóa user + đổi role (admin)**

Trong `lib/admin/actions.ts`, trong `deleteUserAsAdmin`, sau `await prisma.user.delete(...)`:

```ts
  await recordAudit(
    { action: AUDIT_ACTIONS.userDelete, userId: session.user!.id, targetId: id },
    { save: (en) => prisma.auditLog.create({ data: en }).then(() => undefined) },
  );
```

Thêm import: `import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";`

(Không wiring role change — xem ghi chú đầu Task.)

- [ ] **Step 3: Kiểm tra type + test**

Run: `npx tsc --noEmit && npm test`
Expected: 0 lỗi; test xanh.

- [ ] **Step 4: Commit**

```bash
git add auth.ts lib/admin/actions.ts
git commit -m "feat(security): audit log cho login + admin xoa user"
```

---

### Task 14: Trang admin xem audit log (`/admin/audit`)

**Files:**
- Create: `app/admin/audit/page.tsx`
- Modify: `app/admin/layout.tsx:14` (thêm link nav "Nhật ký")

**Interfaces:**
- Consumes: `prisma.auditLog`, route protection ADMIN sẵn có (`requireAdmin` trong layout + `route-rules`).

- [ ] **Step 1: Trang audit phân trang + lọc action**

Tạo `app/admin/audit/page.tsx`:

```tsx
import Link from "next/link";
import prisma from "@/lib/db/prisma";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const action = sp.action?.trim() || undefined;
  const where = action ? { action } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, action: true, userId: true, targetId: true, ip: true, createdAt: true,
        user: { select: { email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-foreground">Nhật ký bảo mật ({total})</h1>
      <form className="mb-4 flex gap-2 text-sm">
        <input
          name="action"
          defaultValue={action ?? ""}
          placeholder="Lọc theo action (vd: login.failure)"
          className="rounded-md border border-border bg-background px-3 py-1.5"
        />
        <button className="rounded-md border border-border px-3 py-1.5 font-medium">Lọc</button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Thời gian</th>
              <th className="p-3">Action</th>
              <th className="p-3">Người dùng</th>
              <th className="p-3">Đối tượng</th>
              <th className="p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="p-3 text-muted-foreground">{new Date(l.createdAt).toLocaleString("vi-VN")}</td>
                <td className="p-3 font-medium text-foreground">{l.action}</td>
                <td className="p-3 text-muted-foreground">{l.user?.email ?? l.userId ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{l.targetId ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{l.ip ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Chưa có nhật ký.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Trang {page}/{totalPages}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={`/admin/audit?page=${page - 1}${action ? `&action=${action}` : ""}`} className="rounded-md border border-border px-3 py-1.5">Trước</Link>
          )}
          {page < totalPages && (
            <Link href={`/admin/audit?page=${page + 1}${action ? `&action=${action}` : ""}`} className="rounded-md border border-border px-3 py-1.5">Sau</Link>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Thêm link nav trong admin layout**

Trong `app/admin/layout.tsx`, sau link "Tin tuyển dụng" (dòng 14), thêm:

```tsx
          <Link href="/admin/audit" className="text-muted-foreground hover:text-foreground">Nhật ký</Link>
```

- [ ] **Step 3: Kiểm tra type + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 lỗi; build có `/admin/audit`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/audit/page.tsx app/admin/layout.tsx
git commit -m "feat(security): trang admin nhat ky bao mat (/admin/audit)"
```

---

### Task 15: Siết CSP `connect-src`

**Files:**
- Modify: `lib/security/csp.ts`
- Modify: `lib/security/__tests__/csp.test.ts`

**Interfaces:**
- Consumes: `buildCsp({ isProd })`.
- Produces: `connect-src` thu hẹp — `'self'` + host Sentry (lấy từ `NEXT_PUBLIC_SENTRY_DSN`); nếu DSN rỗng → `'self'` (an toàn hơn hành vi cũ `https:`).

- [ ] **Step 1: Đọc test CSP hiện có + cập nhật kỳ vọng**

Mở `lib/security/__tests__/csp.test.ts`. Thêm/cập nhật test cho `connect-src`:

```ts
import { describe, it, expect } from "vitest";
import { buildCsp } from "../csp";

describe("buildCsp connect-src", () => {
  it("khong con dung 'https:' rong cho connect-src", () => {
    const csp = buildCsp({ isProd: true });
    expect(csp).not.toMatch(/connect-src[^;]*\bhttps:(\s|;|$)/);
    expect(csp).toMatch(/connect-src[^;]*'self'/);
  });

  it("them host Sentry khi co DSN", () => {
    const csp = buildCsp({ isProd: true, sentryDsn: "https://abc@o123.ingest.sentry.io/456" });
    expect(csp).toContain("https://o123.ingest.sentry.io");
  });
});
```

> Nếu file test cũ có assertion cho `connect-src 'self' https:`, sửa nó cho khớp hành vi mới.

- [ ] **Step 2: Chạy test — phải FAIL**

Run: `npx vitest run lib/security/__tests__/csp.test.ts`
Expected: FAIL (còn `https:` / chưa nhận `sentryDsn`).

- [ ] **Step 3: Cập nhật `csp.ts`**

Thay `lib/security/csp.ts`:

```ts
function sentryConnectSrc(dsn?: string): string {
  if (!dsn) return "";
  try {
    return " " + new URL(dsn).origin;
  } catch {
    return "";
  }
}

export function buildCsp({
  isProd,
  sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN,
}: {
  isProd: boolean;
  sentryDsn?: string;
}): string {
  const scriptSrc = isProd ? "'self'" : "'self' 'unsafe-eval' 'unsafe-inline'";
  const connectSrc = `'self'${sentryConnectSrc(sentryDsn)}`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // Tailwind v4 + inline style (react-pdf preview)
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
```

- [ ] **Step 4: Chạy test — phải PASS**

Run: `npx vitest run lib/security/__tests__/csp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/security/csp.ts lib/security/__tests__/csp.test.ts
git commit -m "feat(security): siet connect-src CSP (self + Sentry host)"
```

> **KIỂM TAY (người dùng):** sau deploy, mở DevTools → Console kiểm không có lỗi CSP `connect-src`; xác nhận Sentry vẫn nhận event (tạo lỗi thử). Nếu vỡ, thêm host bị chặn vào `connectSrc`.

---

### Task 16: Cập nhật `.env.example` + kiểm tra tổng thể

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Bổ sung ghi chú env**

Trong `.env.example`, đảm bảo có (thêm nếu thiếu, kèm comment):

```
# Email (Resend) — thiếu thì email xác minh/reset bị bỏ qua êm (chế độ mềm)
RESEND_API_KEY=
EMAIL_FROM=
# Dùng để dựng link trong email + origin check
APP_URL=http://localhost:3000
```

- [ ] **Step 2: Kiểm tra tổng thể lần cuối**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: 0 lỗi type; lint sạch; toàn bộ test xanh; build PASS.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(security): cap nhat .env.example cho email + APP_URL"
```

---

## Việc người dùng phải tự làm sau khi merge

1. `npm run db:push` ở production để áp `emailVerified` + `AuthToken` + `AuditLog`.
2. (Tùy chọn) cấu hình `RESEND_API_KEY` + `EMAIL_FROM` để email chạy thật.
3. Kiểm tay: đăng ký → nhận mail xác minh → verify; quên mật khẩu → reset; banner nhắc; chặn ứng tuyển/đăng tin khi chưa verify; trang `/admin/audit`; xác nhận Sentry vẫn hoạt động sau siết CSP.

## Để dành Vòng 2

2FA/TOTP · quản lý & thu hồi phiên (token-version, đăng xuất mọi nơi khi reset) · lịch sử đăng nhập cho user.
