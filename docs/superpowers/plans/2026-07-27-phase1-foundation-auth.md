# Phase 1: Nền tảng & Xác thực — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng bộ khung Next.js chạy được với đăng ký/đăng nhập hoạt động và một trang dashboard được bảo vệ.

**Architecture:** Một Next.js App Router (TypeScript) chứa cả UI và API route. Xác thực dùng Auth.js v5 với Credentials provider (email + mật khẩu băm bằng bcrypt). Dữ liệu người dùng lưu trong PostgreSQL qua Prisma. Logic thuần (validate, băm mật khẩu) được viết theo TDD với Vitest.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL (Neon), Auth.js v5 (`next-auth@beta`), bcryptjs, Zod, Vitest.

## Global Constraints

- Ngôn ngữ: TypeScript, chế độ `strict`.
- Mọi secret (DATABASE_URL, AUTH_SECRET) nằm trong `.env`, KHÔNG commit `.env`.
- Mật khẩu KHÔNG bao giờ lưu dạng thô — luôn băm bằng bcryptjs (cost 10).
- Validate mọi input bằng Zod, schema dùng chung client + server.
- Auth.js v5 API: import `next-auth@beta`, dùng `auth()` để lấy session.
- Node.js >= 18.18.
- Mỗi task kết thúc bằng một commit.

---

### Task 1: Khởi tạo dự án Next.js + công cụ test

**Files:**
- Create: toàn bộ scaffold Next.js (`app/`, `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, ...)
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `.gitignore` (do create-next-app sinh ra, kiểm tra có `.env`)
- Test: `lib/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: (không có — task đầu tiên)
- Produces: dự án Next.js chạy được; lệnh `npm test` chạy Vitest.

- [ ] **Step 1: Khởi tạo Next.js app**

Chạy trong thư mục dự án `C:\Users\MANH\project\cv-ai-platform` (đã có `.git` và `docs/`). Dùng `.` để tạo tại chỗ:

```bash
npx create-next-app@latest . --ts --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack --use-npm
```
Khi được hỏi ghi đè thư mục không rỗng, chọn Yes (chỉ có `.git` và `docs/`, sẽ được giữ nguyên).

- [ ] **Step 2: Cài đặt công cụ test**

```bash
npm install -D vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 3: Tạo cấu hình Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 4: Thêm script test vào package.json**

Trong `package.json`, thêm vào mục `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Tạo `.env.example`**

Create `.env.example`:
```
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
AUTH_SECRET="chay: npx auth secret de sinh gia tri"
```

- [ ] **Step 6: Viết smoke test**

Create `lib/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("chay duoc vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Chạy test để xác nhận PASS**

Run: `npm test`
Expected: 1 test PASS.

- [ ] **Step 8: Xác nhận `.env` bị git bỏ qua**

Run: `git check-ignore .env`
Expected: in ra `.env` (nghĩa là đã bị ignore). Nếu không, thêm dòng `.env` vào `.gitignore`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest"
```

---

### Task 2: Schema Prisma cho User + Prisma client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db/prisma.ts`
- Test: `lib/db/__tests__/prisma.test.ts`

**Interfaces:**
- Consumes: (không có)
- Produces:
  - `lib/db/prisma.ts` export default `prisma` (instance `PrismaClient`, singleton).
  - Model `User { id, email, passwordHash, name, role, createdAt }`, enum `Role { CANDIDATE, RECRUITER }`.

- [ ] **Step 1: Cài Prisma**

```bash
npm install -D prisma
npm install @prisma/client
```

- [ ] **Step 2: Tạo schema Prisma**

Create `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  CANDIDATE
  RECRUITER
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(CANDIDATE)
  createdAt    DateTime @default(now())
}
```

- [ ] **Step 3: Tạo Prisma client singleton**

Create `lib/db/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
```

- [ ] **Step 4: Viết test kiểm tra client là singleton**

Create `lib/db/__tests__/prisma.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("prisma client", () => {
  it("tra ve cung mot instance khi import lai", async () => {
    const a = (await import("../prisma")).default;
    const b = (await import("../prisma")).default;
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 5: Generate Prisma client + chạy test**

```bash
npx prisma generate
npm test
```
Expected: tất cả test PASS.

- [ ] **Step 6: Đẩy schema lên database**

Cần `DATABASE_URL` thật trong `.env` (tạo Postgres miễn phí ở neon.tech, dán connection string).
```bash
npx prisma db push
```
Expected: bảng `User` được tạo trên Neon. (Nếu chưa có DB, bỏ qua bước này và làm sau — các bước không phụ thuộc DB vẫn chạy.)

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma lib/db/prisma.ts lib/db/__tests__/prisma.test.ts
git commit -m "feat: add Prisma schema for User and client singleton"
```

---

### Task 3: Validate đăng ký + băm mật khẩu (TDD)

**Files:**
- Create: `lib/auth/validation.ts`
- Create: `lib/auth/password.ts`
- Test: `lib/auth/__tests__/validation.test.ts`
- Test: `lib/auth/__tests__/password.test.ts`

**Interfaces:**
- Consumes: (không có)
- Produces:
  - `registerSchema` (Zod) và type `RegisterInput = { email: string; name: string; password: string }` từ `lib/auth/validation.ts`.
  - `hashPassword(plain: string): Promise<string>` và `verifyPassword(plain: string, hash: string): Promise<boolean>` từ `lib/auth/password.ts`.

- [ ] **Step 1: Cài bcryptjs + Zod**

```bash
npm install bcryptjs zod
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Viết test cho validation (failing)**

Create `lib/auth/__tests__/validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { registerSchema } from "../validation";

describe("registerSchema", () => {
  it("chap nhan input hop le", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com", name: "Manh", password: "matkhau123",
    });
    expect(r.success).toBe(true);
  });

  it("tu choi email sai dinh dang", () => {
    const r = registerSchema.safeParse({
      email: "khong-phai-email", name: "Manh", password: "matkhau123",
    });
    expect(r.success).toBe(false);
  });

  it("tu choi mat khau ngan hon 8 ky tu", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com", name: "Manh", password: "1234",
    });
    expect(r.success).toBe(false);
  });

  it("tu choi ten rong", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com", name: "", password: "matkhau123",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/auth/__tests__/validation.test.ts`
Expected: FAIL với lỗi "Cannot find module '../validation'".

- [ ] **Step 4: Viết validation.ts**

Create `lib/auth/validation.ts`:
```ts
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Tên không được để trống"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

- [ ] **Step 5: Chạy test để xác nhận PASS**

Run: `npx vitest run lib/auth/__tests__/validation.test.ts`
Expected: 4 test PASS.

- [ ] **Step 6: Viết test cho password (failing)**

Create `lib/auth/__tests__/password.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../password";

describe("password", () => {
  it("bam roi xac minh dung mat khau", async () => {
    const hash = await hashPassword("matkhau123");
    expect(hash).not.toBe("matkhau123");
    expect(await verifyPassword("matkhau123", hash)).toBe(true);
  });

  it("tu choi mat khau sai", async () => {
    const hash = await hashPassword("matkhau123");
    expect(await verifyPassword("saibet", hash)).toBe(false);
  });
});
```

- [ ] **Step 7: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/auth/__tests__/password.test.ts`
Expected: FAIL "Cannot find module '../password'".

- [ ] **Step 8: Viết password.ts**

Create `lib/auth/password.ts`:
```ts
import bcrypt from "bcryptjs";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 9: Chạy toàn bộ test**

Run: `npm test`
Expected: tất cả test PASS.

- [ ] **Step 10: Commit**

```bash
git add lib/auth package.json package-lock.json
git commit -m "feat: add register validation and password hashing with tests"
```

---

### Task 4: Cấu hình Auth.js + API route đăng ký

**Files:**
- Create: `auth.ts` (root)
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/api/register/route.ts`
- Create: `lib/auth/register.ts`
- Test: `lib/auth/__tests__/register.test.ts`

**Interfaces:**
- Consumes:
  - `registerSchema`, `RegisterInput` từ `lib/auth/validation.ts`.
  - `hashPassword`, `verifyPassword` từ `lib/auth/password.ts`.
  - `prisma` từ `lib/db/prisma.ts`.
- Produces:
  - `registerUser(input: RegisterInput, deps: RegisterDeps): Promise<{ ok: true; userId: string } | { ok: false; error: string }>` từ `lib/auth/register.ts`, với
    `RegisterDeps = { findByEmail: (email: string) => Promise<{ id: string } | null>; create: (data: { email: string; name: string; passwordHash: string }) => Promise<{ id: string }>; hash: (p: string) => Promise<string> }`.
  - `auth`, `signIn`, `signOut`, `handlers` export từ `auth.ts`.

- [ ] **Step 1: Cài Auth.js v5**

```bash
npm install next-auth@beta
```

- [ ] **Step 2: Sinh AUTH_SECRET**

```bash
npx auth secret
```
Lệnh này thêm `AUTH_SECRET` vào `.env`. (Nếu không tự thêm, tạo thủ công: `AUTH_SECRET="<chuỗi ngẫu nhiên>"`.)

- [ ] **Step 3: Viết test cho registerUser (failing)**

`registerUser` nhận dependencies để test được mà không cần DB thật.

Create `lib/auth/__tests__/register.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { registerUser } from "../register";

const deps = () => ({
  findByEmail: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: "u1" }),
  hash: vi.fn().mockResolvedValue("hashed"),
});

describe("registerUser", () => {
  it("tao user moi khi email chua ton tai", async () => {
    const d = deps();
    const r = await registerUser(
      { email: "a@b.com", name: "Manh", password: "matkhau123" }, d,
    );
    expect(r).toEqual({ ok: true, userId: "u1" });
    expect(d.create).toHaveBeenCalledWith({
      email: "a@b.com", name: "Manh", passwordHash: "hashed",
    });
  });

  it("tu choi khi email da ton tai", async () => {
    const d = deps();
    d.findByEmail.mockResolvedValue({ id: "u0" });
    const r = await registerUser(
      { email: "a@b.com", name: "Manh", password: "matkhau123" }, d,
    );
    expect(r).toEqual({ ok: false, error: "Email đã được đăng ký" });
    expect(d.create).not.toHaveBeenCalled();
  });

  it("tu choi input khong hop le", async () => {
    const d = deps();
    const r = await registerUser(
      { email: "sai", name: "", password: "1" }, d,
    );
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/auth/__tests__/register.test.ts`
Expected: FAIL "Cannot find module '../register'".

- [ ] **Step 5: Viết register.ts**

Create `lib/auth/register.ts`:
```ts
import { registerSchema, type RegisterInput } from "./validation";

export type RegisterDeps = {
  findByEmail: (email: string) => Promise<{ id: string } | null>;
  create: (data: {
    email: string;
    name: string;
    passwordHash: string;
  }) => Promise<{ id: string }>;
  hash: (p: string) => Promise<string>;
};

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function registerUser(
  input: RegisterInput,
  deps: RegisterDeps,
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { email, name, password } = parsed.data;

  const existing = await deps.findByEmail(email);
  if (existing) return { ok: false, error: "Email đã được đăng ký" };

  const passwordHash = await deps.hash(password);
  const user = await deps.create({ email, name, passwordHash });
  return { ok: true, userId: user.id };
}
```

- [ ] **Step 6: Chạy test để xác nhận PASS**

Run: `npx vitest run lib/auth/__tests__/register.test.ts`
Expected: 3 test PASS.

- [ ] **Step 7: Viết cấu hình Auth.js**

Create `auth.ts` (thư mục gốc dự án):
```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = creds?.email as string | undefined;
        const password = creds?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
```

- [ ] **Step 8: Viết route handler cho NextAuth**

Create `app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 9: Viết API route đăng ký**

Create `app/api/register/route.ts`:
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/register";
import { hashPassword } from "@/lib/auth/password";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await registerUser(body, {
      findByEmail: (email) =>
        prisma.user.findUnique({ where: { email }, select: { id: true } }),
      create: (data) =>
        prisma.user.create({ data, select: { id: true } }),
      hash: hashPassword,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ userId: result.userId }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Có lỗi xảy ra, vui lòng thử lại" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 10: Chạy toàn bộ test + build kiểm tra**

```bash
npm test
npx tsc --noEmit
```
Expected: test PASS, không lỗi type.

- [ ] **Step 11: Commit**

```bash
git add auth.ts app/api lib/auth/register.ts lib/auth/__tests__/register.test.ts package.json package-lock.json
git commit -m "feat: add Auth.js config and register API with tests"
```

---

### Task 5: Giao diện đăng ký / đăng nhập + dashboard được bảo vệ

**Files:**
- Create: `app/register/page.tsx`
- Create: `app/login/page.tsx`
- Create: `app/dashboard/page.tsx`
- Create: `middleware.ts`
- Modify: `app/page.tsx` (thêm link tới /login, /register)

**Interfaces:**
- Consumes: `signIn` từ `auth.ts`; API `/api/register`; `auth` từ `auth.ts`.
- Produces: luồng UI đăng ký → đăng nhập → dashboard.

- [ ] **Step 1: Trang đăng ký**

Create `app/register/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        name: form.get("name"),
        password: form.get("password"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/login");
    } else {
      const data = await res.json();
      setError(data.error ?? "Đăng ký thất bại");
    }
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-2xl font-bold">Đăng ký</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input name="name" placeholder="Họ tên" required className="border p-2 rounded" />
        <input name="email" type="email" placeholder="Email" required className="border p-2 rounded" />
        <input name="password" type="password" placeholder="Mật khẩu (>= 8 ký tự)" required className="border p-2 rounded" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={loading} className="bg-black text-white p-2 rounded disabled:opacity-50">
          {loading ? "Đang xử lý..." : "Đăng ký"}
        </button>
      </form>
      <p className="mt-4 text-sm">Đã có tài khoản? <a href="/login" className="underline">Đăng nhập</a></p>
    </main>
  );
}
```

- [ ] **Step 2: Trang đăng nhập**

Create `app/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Email hoặc mật khẩu không đúng");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-4 text-2xl font-bold">Đăng nhập</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="Email" required className="border p-2 rounded" />
        <input name="password" type="password" placeholder="Mật khẩu" required className="border p-2 rounded" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={loading} className="bg-black text-white p-2 rounded disabled:opacity-50">
          {loading ? "Đang xử lý..." : "Đăng nhập"}
        </button>
      </form>
      <p className="mt-4 text-sm">Chưa có tài khoản? <a href="/register" className="underline">Đăng ký</a></p>
    </main>
  );
}
```

- [ ] **Step 3: Trang dashboard (được bảo vệ)**

Create `app/dashboard/page.tsx`:
```tsx
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Xin chào, {session.user.name}</h1>
      <p className="mt-2 text-gray-600">Đây là bảng điều khiển của bạn.</p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button className="mt-4 border p-2 rounded">Đăng xuất</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Middleware bảo vệ route**

Create `middleware.ts`:
```ts
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isProtected = req.nextUrl.pathname.startsWith("/dashboard");
  if (isProtected && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

- [ ] **Step 5: Cập nhật trang chủ**

Replace nội dung `app/page.tsx`:
```tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Nền tảng CV thông minh</h1>
      <p className="mt-2 text-gray-600">Tạo CV, đánh giá bằng AI, tìm việc phù hợp.</p>
      <div className="mt-6 flex gap-3">
        <a href="/register" className="bg-black text-white p-2 rounded">Đăng ký</a>
        <a href="/login" className="border p-2 rounded">Đăng nhập</a>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Chạy dev server và kiểm tra thủ công**

```bash
npm run dev
```
Kiểm tra bằng tay (cần DATABASE_URL thật):
1. Mở http://localhost:3000 → thấy trang chủ có nút Đăng ký/Đăng nhập.
2. Đăng ký một tài khoản → chuyển sang /login.
3. Đăng nhập → chuyển sang /dashboard, thấy tên mình.
4. Mở /dashboard khi chưa đăng nhập (ẩn danh) → bị đẩy về /login.
5. Bấm Đăng xuất → về /login.

- [ ] **Step 7: Kiểm tra type + test**

```bash
npx tsc --noEmit
npm test
```
Expected: không lỗi type, test PASS.

- [ ] **Step 8: Commit**

```bash
git add app middleware.ts
git commit -m "feat: add register/login pages and protected dashboard"
```

---

## Self-Review

**Spec coverage (Giai đoạn 1 của spec — "Khởi tạo dự án + DB + Auth"):**
- Khởi tạo Next.js + TypeScript + Tailwind → Task 1. ✓
- Công cụ test (Vitest) + TDD → Task 1, 3, 4. ✓
- PostgreSQL + Prisma + model User → Task 2. ✓
- Auth.js đăng nhập → Task 4, 5. ✓
- Đăng ký (email/password băm) → Task 3, 4, 5. ✓
- Route được bảo vệ → Task 5 (dashboard + middleware). ✓
- Bảo mật: mật khẩu băm, secret trong .env → Task 1, 3, Global Constraints. ✓

*(Giai đoạn 2–6 của spec — CV builder, đánh giá AI, skill gap, chatbot, JD của NTD — sẽ có plan riêng, ngoài phạm vi plan này.)*

**Placeholder scan:** Không có TBD/TODO; mọi step có code hoặc lệnh cụ thể. ✓

**Type consistency:** `RegisterInput`, `RegisterDeps`, `registerUser`, `hashPassword`/`verifyPassword`, `registerSchema` dùng nhất quán qua Task 3 → 4 → 5. `auth`/`signIn`/`signOut`/`handlers` export từ `auth.ts` và dùng đúng ở Task 4, 5. ✓
