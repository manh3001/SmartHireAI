# Security Foundation (Gói A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hoá và lấp các lỗ hổng bảo mật nền tảng (route protection tập trung, security headers, guard tập trung cho Server Actions, rate-limit dùng chung qua Upstash, độ mạnh mật khẩu) mà không phá vỡ cơ chế đang đúng.

**Architecture:** Bốn lớp phòng thủ — (0) security headers tĩnh trong `next.config.ts headers()`, (1) `proxy.ts` (Next 16, Node runtime) bảo vệ route theo bảng khai báo thuần, (2) `lib/auth/session.ts` guard tập trung cho Server Actions/pages, (3) `lib/security/ratelimit.ts` rate-limit qua Upstash Redis với fallback in-memory. Mọi logic quyết định tách thành hàm thuần để unit-test theo phong cách TDD sẵn có của repo.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), Auth.js v5 (JWT), Prisma 6 + Neon, `@upstash/ratelimit` + `@upstash/redis`, Zod v4, Vitest.

## Global Constraints

- Prisma giữ nguyên **v6** — không nâng v7 (breaking change).
- Mọi lệnh chạm DB đặt `NODE_OPTIONS=--dns-result-order=ipv4first` (đã có trong scripts).
- Next 16: file convention là **`proxy.ts`** (KHÔNG phải `middleware.ts`); proxy chạy **Node.js runtime** mặc định, KHÔNG được set `runtime` trong proxy.
- Server Actions phải TỰ guard (không dựa vào proxy) — doc Next 16: proxy matcher loại trừ path sẽ bỏ qua Server Function POST.
- Test chỉ cho **logic thuần** (không chạm DB/route/React component) — đúng phong cách repo.
- Không xoá `lib/ai/rate-limit.ts` (`createRateLimiter`) và test của nó — dùng lại làm backend in-memory.
- Thông báo lỗi bằng tiếng Việt.
- Rate-limit ngưỡng khởi điểm: login 5/15 phút, register 5/giờ, AI 20/giờ, mutation 30/phút.
- Alias import `@` = gốc dự án (đã cấu hình vitest + tsconfig).

---

### Task 1: Security headers + CSP builder

**Files:**
- Create: `lib/security/csp.ts`
- Create: `lib/security/__tests__/csp.test.ts`
- Modify: `next.config.ts` (đang trống)

**Interfaces:**
- Produces: `buildCsp({ isProd }: { isProd: boolean }): string`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/security/__tests__/csp.test.ts
import { describe, it, expect } from "vitest";
import { buildCsp } from "../csp";

describe("buildCsp", () => {
  it("luon co default-src 'self' va khoa frame/object", () => {
    const csp = buildCsp({ isProd: true });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("production KHONG co 'unsafe-eval' trong script-src", () => {
    expect(buildCsp({ isProd: true })).not.toContain("'unsafe-eval'");
  });

  it("dev cho phep 'unsafe-eval' (Turbopack)", () => {
    expect(buildCsp({ isProd: false })).toContain("'unsafe-eval'");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/security/__tests__/csp.test.ts`
Expected: FAIL — không import được `../csp`.

- [ ] **Step 3: Viết implementation tối thiểu**

```ts
// lib/security/csp.ts
export function buildCsp({ isProd }: { isProd: boolean }): string {
  const scriptSrc = isProd ? "'self'" : "'self' 'unsafe-eval'";
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // Tailwind v4 + inline style (react-pdf preview)
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:", // Neon/Upstash/Gemini
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run lib/security/__tests__/csp.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Thêm security headers vào `next.config.ts`**

```ts
// next.config.ts
import type { NextConfig } from "next";
import { buildCsp } from "./lib/security/csp";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp({ isProd }) },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
```

- [ ] **Step 6: Kiểm tra headers thực tế (thủ công)**

Run: `npm run dev` rồi mở terminal khác: `curl -I http://localhost:3000/login`
Expected: response chứa `content-security-policy`, `x-frame-options: DENY`, `x-content-type-options: nosniff`. Trang `/login` vẫn tải bình thường (không lỗi CSP trong devtools console).

- [ ] **Step 7: Commit**

```bash
git add lib/security/csp.ts lib/security/__tests__/csp.test.ts next.config.ts
git commit -m "feat(security): CSP builder + security headers in next.config"
```

---

### Task 2: Route protection tập trung qua `proxy.ts`

**Files:**
- Create: `lib/auth/route-rules.ts`
- Create: `lib/auth/__tests__/route-rules.test.ts`
- Modify: `proxy.ts` (hiện chỉ bảo vệ `/dashboard`)

**Interfaces:**
- Produces:
  - `type SessionLike = { user?: { role?: string } | null } | null`
  - `matchRule(pathname: string): RouteRule | null`
  - `routeDecision(pathname: string, session: SessionLike): "allow" | "login" | "forbidden"`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/auth/__tests__/route-rules.test.ts
import { describe, it, expect } from "vitest";
import { routeDecision } from "../route-rules";

const candidate = { user: { role: "CANDIDATE" } };
const recruiter = { user: { role: "RECRUITER" } };
const admin = { user: { role: "ADMIN" } };

describe("routeDecision", () => {
  it("route cong khai -> allow ke ca chua login", () => {
    expect(routeDecision("/jobs", null)).toBe("allow");
    expect(routeDecision("/companies", null)).toBe("allow");
    expect(routeDecision("/", null)).toBe("allow");
  });

  it("route rieng tu, chua login -> login", () => {
    expect(routeDecision("/dashboard", null)).toBe("login");
    expect(routeDecision("/cv/abc", null)).toBe("login");
    expect(routeDecision("/applications", null)).toBe("login");
  });

  it("/admin chi ADMIN", () => {
    expect(routeDecision("/admin/users", null)).toBe("login");
    expect(routeDecision("/admin/users", candidate)).toBe("forbidden");
    expect(routeDecision("/admin/users", admin)).toBe("allow");
  });

  it("/jobs/new va /company/edit chi RECRUITER", () => {
    expect(routeDecision("/jobs/new", candidate)).toBe("forbidden");
    expect(routeDecision("/jobs/new", recruiter)).toBe("allow");
    expect(routeDecision("/company/edit", candidate)).toBe("forbidden");
    expect(routeDecision("/company/edit", recruiter)).toBe("allow");
  });

  it("/jobs (list) van cong khai du co prefix giong /jobs/new", () => {
    expect(routeDecision("/jobs", null)).toBe("allow");
    expect(routeDecision("/jobs/123", null)).toBe("allow");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/auth/__tests__/route-rules.test.ts`
Expected: FAIL — không import được `../route-rules`.

- [ ] **Step 3: Viết implementation tối thiểu**

```ts
// lib/auth/route-rules.ts
export type SessionLike = { user?: { role?: string } | null } | null;

export type RouteRule = { prefix: string; role?: "ADMIN" | "RECRUITER" };

// Thứ tự quan trọng: rule cụ thể hơn (vd /company/edit) phải đứng TRƯỚC rule chung (/company).
export const ROUTE_RULES: RouteRule[] = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/jobs/new", role: "RECRUITER" },
  { prefix: "/company/edit", role: "RECRUITER" },
  { prefix: "/dashboard" },
  { prefix: "/cv" },
  { prefix: "/applications" },
  { prefix: "/messages" },
  { prefix: "/notifications" },
  { prefix: "/company" },
];

export function matchRule(pathname: string): RouteRule | null {
  return (
    ROUTE_RULES.find(
      (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
    ) ?? null
  );
}

export function routeDecision(
  pathname: string,
  session: SessionLike,
): "allow" | "login" | "forbidden" {
  const rule = matchRule(pathname);
  if (!rule) return "allow";
  if (!session?.user) return "login";
  if (rule.role && session.user.role !== rule.role) return "forbidden";
  return "allow";
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run lib/auth/__tests__/route-rules.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Nối vào `proxy.ts`**

```ts
// proxy.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { routeDecision } from "@/lib/auth/route-rules";

export default auth((req) => {
  const decision = routeDecision(req.nextUrl.pathname, req.auth);

  if (decision === "login") {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (decision === "forbidden") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  // allow -> không trả gì, request đi tiếp
});

export const config = {
  // Bỏ qua api (tự guard), static, image, favicon
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 6: Kiểm tra thủ công**

Run: `npm run dev`, rồi (chưa đăng nhập) mở `http://localhost:3000/dashboard`.
Expected: bị chuyển về `/login?callbackUrl=/dashboard`. Mở `/jobs` khi chưa login: vẫn xem được. Đăng nhập bằng tài khoản CANDIDATE rồi mở `/admin/users`: bị chuyển về `/dashboard`.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/route-rules.ts lib/auth/__tests__/route-rules.test.ts proxy.ts
git commit -m "feat(security): central route protection via proxy.ts route-rules"
```

---

### Task 3: Guard tập trung cho Server Actions/pages

**Files:**
- Create: `lib/auth/session.ts`
- Create: `lib/auth/__tests__/session.test.ts`
- Modify: `lib/admin/guard.ts` (cho `adminAccess` gọi lại `roleAccess`)

**Interfaces:**
- Produces:
  - `type Role = "CANDIDATE" | "RECRUITER" | "ADMIN"`
  - `roleAccess(session, role: Role): "ok" | "login" | "forbidden"` (thuần)
  - `requireUser(): Promise<Session>` (redirect `/login` nếu chưa login)
  - `requireRole(role: Role): Promise<Session>` (redirect `/login` hoặc `/dashboard`)
  - `getSessionUser(): Promise<SessionUser | null>` (không redirect)
- Consumes: `roleAccess` được dùng lại trong `lib/admin/guard.ts`.

- [ ] **Step 1: Viết test thất bại (chỉ cho hàm thuần `roleAccess`)**

```ts
// lib/auth/__tests__/session.test.ts
import { describe, it, expect } from "vitest";
import { roleAccess } from "../session";

describe("roleAccess", () => {
  it("chua login -> login", () => {
    expect(roleAccess(null, "ADMIN")).toBe("login");
    expect(roleAccess({ user: null }, "RECRUITER")).toBe("login");
  });
  it("dung role -> ok", () => {
    expect(roleAccess({ user: { role: "ADMIN" } }, "ADMIN")).toBe("ok");
  });
  it("sai role -> forbidden", () => {
    expect(roleAccess({ user: { role: "CANDIDATE" } }, "RECRUITER")).toBe("forbidden");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/auth/__tests__/session.test.ts`
Expected: FAIL — không import được `roleAccess`.

- [ ] **Step 3: Viết implementation**

```ts
// lib/auth/session.ts
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type Role = "CANDIDATE" | "RECRUITER" | "ADMIN";

type SessionLike = { user?: { id?: string; role?: string } | null } | null;

export function roleAccess(
  session: SessionLike,
  role: Role,
): "ok" | "login" | "forbidden" {
  if (!session?.user) return "login";
  return session.user.role === role ? "ok" : "forbidden";
}

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function requireRole(role: Role) {
  const session = await auth();
  const access = roleAccess(session, role);
  if (access === "login") redirect("/login");
  if (access === "forbidden") redirect("/dashboard");
  return session!;
}
```

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `npx vitest run lib/auth/__tests__/session.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Cho `adminAccess` dùng lại `roleAccess` (DRY, không phá test cũ)**

Sửa `lib/admin/guard.ts` — giữ nguyên tên export `adminAccess` và `requireAdmin`, chỉ đổi ruột:

```ts
// lib/admin/guard.ts
import { redirect } from "next/navigation";
import { roleAccess } from "@/lib/auth/session";

type SessionLike = { user?: { role?: string } | null } | null;

export function adminAccess(session: SessionLike): "ok" | "login" | "forbidden" {
  return roleAccess(session, "ADMIN");
}

// Dùng trong app/admin/layout.tsx và mọi server action quản trị.
export async function requireAdmin() {
  const { auth } = await import("@/auth");
  const session = await auth();
  const access = adminAccess(session);
  if (access === "login") redirect("/login");
  if (access === "forbidden") redirect("/dashboard");
  return session!;
}
```

- [ ] **Step 6: Chạy test cũ của guard để đảm bảo không vỡ**

Run: `npx vitest run lib/admin/__tests__/guard.test.ts`
Expected: PASS (không đổi hành vi).

- [ ] **Step 7: Commit**

```bash
git add lib/auth/session.ts lib/auth/__tests__/session.test.ts lib/admin/guard.ts
git commit -m "feat(security): central session guard (roleAccess/requireUser/requireRole)"
```

---

### Task 4: Refactor các Server Action rải rác dùng guard tập trung

**Files:**
- Modify: `lib/jobs/actions.ts` (mẫu chuẩn, đã có nội dung bên dưới)
- Modify: các file `lib/**/actions.ts` còn lặp pattern (tìm bằng grep ở Step 3)

**Interfaces:**
- Consumes: `requireUser`, `requireRole` từ `lib/auth/session.ts` (Task 3).

Quy tắc biến đổi (áp cho MỌI chỗ khớp):
- 3 dòng: `const session = await auth();` + `if (!session?.user?.id) redirect("/login");` + `if (session.user.role !== "X") redirect("/dashboard");`
  → 1 dòng: `const session = await requireRole("X");`
- 2 dòng: `const session = await auth();` + `if (!session?.user?.id) redirect("/login");`
  → 1 dòng: `const session = await requireUser();`
- GIỮ NGUYÊN mọi ownership check (`where: { id, userId: session.user.id }`) và logic còn lại.

- [ ] **Step 1: Sửa `lib/jobs/actions.ts` (mẫu chuẩn)**

Đổi import đầu file: bỏ `import { auth } from "@/auth";`, thêm:

```ts
import { requireUser, requireRole } from "@/lib/auth/session";
```

Trong `createJobDescription`, thay:

```ts
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");
```

bằng:

```ts
  const session = await requireRole("RECRUITER");
```

Trong `deleteJobDescription`, thay:

```ts
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
```

bằng:

```ts
  const session = await requireUser();
```

(Giữ nguyên `redirect` import vì `if (!parsed.success) redirect("/jobs/new");` vẫn dùng.)

- [ ] **Step 2: Chạy test + typecheck cho jobs**

Run: `npx vitest run lib/jobs && npx tsc --noEmit`
Expected: test jobs PASS, không lỗi type ở `lib/jobs/actions.ts`.

- [ ] **Step 3: Tìm các chỗ còn lặp trong action khác**

Run: `git grep -n "if (!session?.user?.id) redirect" -- "lib/**/actions.ts" "lib/**/*-actions.ts"`
Expected: liệt kê các file còn pattern cũ (vd `lib/applications/actions.ts`, `lib/company/actions.ts`, `lib/messages/actions.ts`, `lib/cv/actions.ts`, `lib/jobs/saved-actions.ts`, `lib/jobs/alert-actions.ts`, `lib/jobs/recommend-actions.ts`, `lib/applications/screening-actions.ts`, `lib/notifications/actions.ts`...). Danh sách thực tế theo output.

- [ ] **Step 4: Áp quy tắc biến đổi cho từng file trong output Step 3**

Với mỗi file: thêm import `requireUser`/`requireRole` (bỏ `auth` nếu không còn dùng chỗ khác trong file — kiểm tra bằng grep trong file), thay pattern theo Quy tắc biến đổi ở đầu Task. Nếu một action cần role RECRUITER → `requireRole("RECRUITER")`; nếu chỉ cần đăng nhập → `requireUser()`; nếu là action admin đang dùng `requireAdmin()` thì GIỮ NGUYÊN.

- [ ] **Step 5: Xác minh không còn pattern cũ + toàn bộ test xanh**

Run: `git grep -n "if (!session?.user?.id) redirect" -- "lib/**/actions.ts" "lib/**/*-actions.ts"`
Expected: không còn kết quả (hoặc chỉ còn chỗ cố ý giữ, ghi chú rõ).

Run: `npx vitest run && npx tsc --noEmit`
Expected: toàn bộ test PASS, typecheck sạch.

- [ ] **Step 6: Commit**

```bash
git add lib
git commit -m "refactor(security): server actions dùng guard tập trung requireUser/requireRole"
```

---

### Task 5: Rate-limit adapter (Upstash + fallback in-memory)

**Files:**
- Create: `lib/security/rate-config.ts`
- Create: `lib/security/rate-key.ts`
- Create: `lib/security/ratelimit.ts`
- Create: `lib/security/ip.ts`
- Create: `lib/security/__tests__/rate-key.test.ts`
- Create: `lib/security/__tests__/ratelimit.test.ts`
- Create: `lib/security/__tests__/ip.test.ts`
- Modify: `package.json` (thêm deps)

**Interfaces:**
- Produces:
  - `RATE_LIMITS: Record<RateScope, { max: number; windowMs: number }>`, `type RateScope = "login" | "register" | "ai" | "mutation"`
  - `rateKey(scope: string, id: string): string`
  - `checkRateLimit(scope: RateScope, id: string, now?: number): Promise<boolean>` (true = cho qua)
  - `getClientIp(req: Request | undefined): string`

- [ ] **Step 1: Cài dependencies**

Run: `npm install @upstash/ratelimit @upstash/redis`
Expected: 2 package được thêm vào `package.json` (dependencies).

- [ ] **Step 2: Viết test thất bại cho `rateKey` và `getClientIp`**

```ts
// lib/security/__tests__/rate-key.test.ts
import { describe, it, expect } from "vitest";
import { rateKey } from "../rate-key";

describe("rateKey", () => {
  it("ghep scope va id theo dinh dang on dinh", () => {
    expect(rateKey("login", "1.2.3.4:a@b.com")).toBe("rl:login:1.2.3.4:a@b.com");
  });
  it("tach biet theo scope", () => {
    expect(rateKey("ai", "u1")).not.toBe(rateKey("mutation", "u1"));
  });
});
```

```ts
// lib/security/__tests__/ip.test.ts
import { describe, it, expect } from "vitest";
import { getClientIp } from "../ip";

function reqWith(headers: Record<string, string>): Request {
  return new Request("http://x", { headers });
}

describe("getClientIp", () => {
  it("lay IP dau tien tu x-forwarded-for", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
  });
  it("fallback x-real-ip", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  });
  it("khong co header -> 'unknown'", () => {
    expect(getClientIp(reqWith({}))).toBe("unknown");
    expect(getClientIp(undefined)).toBe("unknown");
  });
});
```

- [ ] **Step 3: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/security/__tests__/rate-key.test.ts lib/security/__tests__/ip.test.ts`
Expected: FAIL — chưa có module.

- [ ] **Step 4: Viết `rate-config.ts`, `rate-key.ts`, `ip.ts`**

```ts
// lib/security/rate-config.ts
export type RateScope = "login" | "register" | "ai" | "mutation";

export const RATE_LIMITS: Record<RateScope, { max: number; windowMs: number }> = {
  login: { max: 5, windowMs: 15 * 60_000 }, // 5 / 15 phút
  register: { max: 5, windowMs: 60 * 60_000 }, // 5 / giờ
  ai: { max: 20, windowMs: 60 * 60_000 }, // 20 / giờ
  mutation: { max: 30, windowMs: 60_000 }, // 30 / phút
};
```

```ts
// lib/security/rate-key.ts
export function rateKey(scope: string, id: string): string {
  return `rl:${scope}:${id}`;
}
```

```ts
// lib/security/ip.ts
export function getClientIp(req: Request | undefined): string {
  if (!req) return "unknown";
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
```

- [ ] **Step 5: Chạy lại test rate-key + ip → PASS**

Run: `npx vitest run lib/security/__tests__/rate-key.test.ts lib/security/__tests__/ip.test.ts`
Expected: PASS.

- [ ] **Step 6: Viết test thất bại cho `checkRateLimit` (đường fallback in-memory — không cấu hình Upstash)**

```ts
// lib/security/__tests__/ratelimit.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "../ratelimit";

// Không set UPSTASH_* -> dùng backend in-memory, deterministic theo `now`.
describe("checkRateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("cho qua toi da 'max' lan roi chan (scope register: 5/gio)", async () => {
    const id = "ip-A"; // id riêng để không đụng test khác
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit("register", id, 1000 + i)).toBe(true);
    }
    expect(await checkRateLimit("register", id, 1010)).toBe(false);
  });

  it("tach biet theo id", async () => {
    expect(await checkRateLimit("login", "ip-B:e", 0)).toBe(true);
    expect(await checkRateLimit("login", "ip-C:e", 0)).toBe(true);
  });
});
```

- [ ] **Step 7: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/security/__tests__/ratelimit.test.ts`
Expected: FAIL — chưa có `checkRateLimit`.

- [ ] **Step 8: Viết `ratelimit.ts`**

```ts
// lib/security/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createRateLimiter } from "@/lib/ai/rate-limit";
import { RATE_LIMITS, type RateScope } from "./rate-config";
import { rateKey } from "./rate-key";

// --- Backend in-memory (dev/test hoặc khi thiếu Upstash) ---
const memoryLimiters = new Map<RateScope, ReturnType<typeof createRateLimiter>>();
function memoryCheck(scope: RateScope, key: string, now: number): boolean {
  let limiter = memoryLimiters.get(scope);
  if (!limiter) {
    limiter = createRateLimiter(RATE_LIMITS[scope]);
    memoryLimiters.set(scope, limiter);
  }
  return limiter.check(key, now);
}

// --- Backend Upstash ---
let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

const upstashLimiters = new Map<RateScope, Ratelimit>();
function getUpstashLimiter(scope: RateScope): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  let rl = upstashLimiters.get(scope);
  if (!rl) {
    const { max, windowMs } = RATE_LIMITS[scope];
    rl = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
      prefix: "rl",
    });
    upstashLimiters.set(scope, rl);
  }
  return rl;
}

/** true = cho qua, false = vượt ngưỡng. Fail-open nếu Upstash lỗi. */
export async function checkRateLimit(
  scope: RateScope,
  id: string,
  now: number = Date.now(),
): Promise<boolean> {
  const key = rateKey(scope, id);
  const limiter = getUpstashLimiter(scope);
  if (!limiter) return memoryCheck(scope, key, now);
  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch (e) {
    console.warn("[ratelimit] Upstash lỗi, fail-open:", e);
    return true;
  }
}
```

Lưu ý: `getRedis` memo hoá `redis` ở lần gọi đầu. Trong test, `beforeEach` xoá env TRƯỚC lần gọi đầu tiên nên `redis` = null (đường in-memory). Không set biến Upstash trong môi trường test.

- [ ] **Step 9: Chạy test → PASS**

Run: `npx vitest run lib/security/__tests__/ratelimit.test.ts`
Expected: PASS (2 test).

- [ ] **Step 10: Commit**

```bash
git add lib/security package.json package-lock.json
git commit -m "feat(security): rate-limit adapter (Upstash + in-memory fallback) + ip helper"
```

---

### Task 6: Áp rate-limit vào register, login, và AI routes

**Files:**
- Modify: `app/api/register/route.ts`
- Modify: `auth.ts`
- Modify: `app/api/cv/[id]/evaluate/route.ts`
- Modify: `app/api/cv/[id]/chat/route.ts`
- Modify: `lib/applications/actions.ts` (scope `mutation`/`ai`)
- Modify: `lib/messages/actions.ts` (scope `mutation`)

**Interfaces:**
- Consumes: `checkRateLimit`, `getClientIp` (Task 5).

Lưu ý: các action trong `lib/applications/actions.ts` và `lib/messages/actions.ts` trả `{ ok: false, error }` (không `redirect`) vì được gọi từ client component — KHÔNG áp `requireUser`/`requireRole` (đó là Task 4, dành cho action kiểu redirect). Ở đây chỉ thay/nạp rate-limit.

- [ ] **Step 1: Rate-limit `register` route theo IP**

Sửa `app/api/register/route.ts` — thêm import và chèn kiểm tra ngay đầu `POST`:

```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/register";
import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!(await checkRateLimit("register", ip))) {
      return NextResponse.json(
        { error: "Bạn thao tác quá nhiều lần, vui lòng thử lại sau" },
        { status: 429 },
      );
    }

    const body = await req.json();
    const result = await registerUser(body, {
      findByEmail: (email) =>
        prisma.user.findUnique({ where: { email }, select: { id: true } }),
      create: (data) => prisma.user.create({ data, select: { id: true } }),
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

- [ ] **Step 2: Rate-limit đăng nhập trong `auth.ts` (khoá theo IP + email)**

Sửa `authorize` để nhận `request` và kiểm tra rate-limit trước khi truy vấn DB:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds, request) => {
        const email = creds?.email as string | undefined;
        const password = creds?.password as string | undefined;
        if (!email || !password) return null;

        const ip = getClientIp(request as Request | undefined);
        const ok = await checkRateLimit("login", `${ip}:${email}`);
        if (!ok) {
          console.warn("[auth] login bị rate-limit:", email);
          return null; // trả lỗi đồng nhất, không tiết lộ bị khoá
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "CANDIDATE" | "RECRUITER" | "ADMIN" }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "CANDIDATE" | "RECRUITER" | "ADMIN") ?? "CANDIDATE";
      }
      return session;
    },
  },
});
```

- [ ] **Step 3: Chuyển `evaluate` route sang `checkRateLimit("ai", userId)`**

Trong `app/api/cv/[id]/evaluate/route.ts`: bỏ dòng `import { createRateLimiter } from "@/lib/ai/rate-limit";` và `const limiter = createRateLimiter({ max: 5, windowMs: 60000 });`. Thêm import:

```ts
import { checkRateLimit } from "@/lib/security/ratelimit";
```

Thay khối:

```ts
  if (!limiter.check(userId, Date.now())) {
    return NextResponse.json(
      { error: "Bạn đánh giá quá nhanh, vui lòng thử lại sau một phút" },
      { status: 429 },
    );
  }
```

bằng:

```ts
  if (!(await checkRateLimit("ai", userId))) {
    return NextResponse.json(
      { error: "Bạn đánh giá quá nhanh, vui lòng thử lại sau" },
      { status: 429 },
    );
  }
```

- [ ] **Step 4: Chuyển `chat` route sang `checkRateLimit("ai", userId)`**

Trong `app/api/cv/[id]/chat/route.ts`: bỏ `import { createRateLimiter } from "@/lib/ai/rate-limit";` và `const limiter = createRateLimiter({ max: 20, windowMs: 60000 });`. Thêm `import { checkRateLimit } from "@/lib/security/ratelimit";`. Thay:

```ts
  if (!limiter.check(userId, Date.now())) {
    return new Response("Bạn nhắn quá nhanh, vui lòng chờ một chút", { status: 429 });
  }
```

bằng:

```ts
  if (!(await checkRateLimit("ai", userId))) {
    return new Response("Bạn nhắn quá nhanh, vui lòng chờ một chút", { status: 429 });
  }
```

- [ ] **Step 5: Áp rate-limit cho apply actions (`lib/applications/actions.ts`)**

Bỏ 2 dòng in-memory:

```ts
const previewLimiter = createRateLimiter({ max: 5, windowMs: 60000 });
const submitLimiter = createRateLimiter({ max: 5, windowMs: 60000 });
```

và (nếu `createRateLimiter` không còn dùng chỗ khác trong file) bỏ import `import { createRateLimiter } from "@/lib/ai/rate-limit";`. Thêm:

```ts
import { checkRateLimit } from "@/lib/security/ratelimit";
```

Trong `previewMatch`, thay:

```ts
  if (!previewLimiter.check(userId, Date.now()))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };
```

bằng (preview gọi AI → scope `ai`):

```ts
  if (!(await checkRateLimit("ai", userId)))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };
```

Trong `submitApplication`, thay:

```ts
  if (!submitLimiter.check(userId, Date.now()))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };
```

bằng (nộp đơn → scope `mutation`):

```ts
  if (!(await checkRateLimit("mutation", userId)))
    return { ok: false, error: "Bạn thao tác quá nhanh, thử lại sau một phút" };
```

- [ ] **Step 6: Áp rate-limit cho gửi tin nhắn (`lib/messages/actions.ts`)**

Thêm import `import { checkRateLimit } from "@/lib/security/ratelimit";`. Ngay sau khối kiểm tra đăng nhập (`if (!userId) return { ok: false, error: "Chưa đăng nhập" };`), chèn:

```ts
  if (!(await checkRateLimit("mutation", userId)))
    return { ok: false, error: "Bạn gửi quá nhanh, vui lòng chờ một chút" };
```

- [ ] **Step 7: Typecheck + test toàn bộ**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sạch type, toàn bộ test PASS. (`lib/ai/rate-limit.ts` + test của nó vẫn còn vì được backend in-memory dùng lại.)

- [ ] **Step 8: Kiểm tra thủ công rate-limit đăng nhập**

Run: `npm run dev`. Trên `/login`, nhập sai mật khẩu 6 lần liên tiếp cùng email.
Expected: sau lần thứ 5, kể cả nhập ĐÚNG mật khẩu cũng bị từ chối trong cửa sổ 15 phút (log server hiện `[auth] login bị rate-limit`). (Chạy in-memory nếu chưa cấu hình Upstash — vẫn chặn trong 1 instance dev.)

- [ ] **Step 9: Commit**

```bash
git add app/api/register/route.ts auth.ts app/api/cv/[id]/evaluate/route.ts app/api/cv/[id]/chat/route.ts lib/applications/actions.ts lib/messages/actions.ts
git commit -m "feat(security): rate-limit register/login/AI/mutation qua Upstash adapter"
```

---

### Task 7: Độ mạnh mật khẩu

**Files:**
- Create: `lib/auth/password-strength.ts`
- Create: `lib/auth/__tests__/password-strength.test.ts`
- Modify: `lib/auth/validation.ts`

**Interfaces:**
- Produces: `passwordStrength(pw: string): { ok: boolean; error?: string }`
- Consumes: dùng trong `registerSchema.password` (single source of truth).

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/auth/__tests__/password-strength.test.ts
import { describe, it, expect } from "vitest";
import { passwordStrength } from "../password-strength";

describe("passwordStrength", () => {
  it("ok khi >=8 ky tu, co chu va so", () => {
    expect(passwordStrength("abcd1234")).toEqual({ ok: true });
  });
  it("tu choi khi < 8 ky tu", () => {
    expect(passwordStrength("ab12").ok).toBe(false);
  });
  it("tu choi khi thieu chu so", () => {
    expect(passwordStrength("abcdefgh").ok).toBe(false);
  });
  it("tu choi khi thieu chu cai", () => {
    expect(passwordStrength("12345678").ok).toBe(false);
  });
  it("tu choi khi > 72 ky tu (gioi han bcrypt)", () => {
    expect(passwordStrength("a1" + "x".repeat(71)).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `npx vitest run lib/auth/__tests__/password-strength.test.ts`
Expected: FAIL — chưa có module.

- [ ] **Step 3: Viết implementation**

```ts
// lib/auth/password-strength.ts
export function passwordStrength(pw: string): { ok: boolean; error?: string } {
  if (pw.length < 8) return { ok: false, error: "Mật khẩu tối thiểu 8 ký tự" };
  if (pw.length > 72) return { ok: false, error: "Mật khẩu tối đa 72 ký tự" };
  if (!/[a-zA-Z]/.test(pw)) return { ok: false, error: "Mật khẩu cần ít nhất một chữ cái" };
  if (!/[0-9]/.test(pw)) return { ok: false, error: "Mật khẩu cần ít nhất một chữ số" };
  return { ok: true };
}
```

- [ ] **Step 4: Chạy test → PASS**

Run: `npx vitest run lib/auth/__tests__/password-strength.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Nối vào `registerSchema` (single source)**

Sửa `lib/auth/validation.ts`:

```ts
import { z } from "zod";
import { passwordStrength } from "./password-strength";

export const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  name: z.string().min(1, "Tên không được để trống"),
  password: z.string().superRefine((val, ctx) => {
    const r = passwordStrength(val);
    if (!r.ok) ctx.addIssue({ code: "custom", message: r.error! });
  }),
  role: z.enum(["CANDIDATE", "RECRUITER"]).default("CANDIDATE"),
});

// z.input: role là tùy chọn ở đầu vào (schema tự điền mặc định CANDIDATE khi parse).
export type RegisterInput = z.input<typeof registerSchema>;
```

- [ ] **Step 6: Chạy test liên quan để đảm bảo không vỡ**

Run: `npx vitest run lib/auth`
Expected: PASS. Nếu `validation.test.ts` hoặc `register.test.ts` khẳng định message mật khẩu ngắn là "Mật khẩu tối thiểu 8 ký tự" → vẫn khớp (passwordStrength trả đúng chuỗi đó). Nếu có test dùng mật khẩu hợp lệ nhưng THIẾU chữ số (vd `"password"`), cập nhật test đó dùng mật khẩu hợp lệ mới (vd `"password1"`) — đây là siết yêu cầu có chủ đích.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/password-strength.ts lib/auth/__tests__/password-strength.test.ts lib/auth/validation.ts
git commit -m "feat(security): yêu cầu độ mạnh mật khẩu (chữ + số, <=72)"
```

---

### Task 8: Biến môi trường, tài liệu & kiểm thử toàn bộ

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:** không có mới.

- [ ] **Step 1: Bổ sung biến Upstash vào `.env.example`**

Thêm dưới các biến hiện có:

```bash
# Rate-limit dùng chung (khuyến nghị cho production). Bỏ trống -> fallback in-memory (chỉ đúng trong 1 instance, hợp dev/test).
UPSTASH_REDIS_REST_URL="https://... (tạo free tại upstash.com)"
UPSTASH_REDIS_REST_TOKEN="..."
```

- [ ] **Step 2: Cập nhật README**

Trong bảng biến môi trường của `README.md`, thêm 2 dòng cho `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN` (Bắt buộc: không; Mô tả: rate-limit dùng chung, thiếu thì fallback in-memory). Thêm một dòng vào mục tính năng/bảo mật: "Bảo vệ route tập trung (`proxy.ts`), security headers (CSP/HSTS...), rate-limit đăng nhập/đăng ký/AI, yêu cầu độ mạnh mật khẩu."

- [ ] **Step 3: Chạy toàn bộ kiểm thử + build**

Run: `npx vitest run`
Expected: toàn bộ PASS.

Run: `npm run lint`
Expected: không lỗi.

Run: `npm run build`
Expected: build thành công (proxy.ts + next.config headers hợp lệ).

- [ ] **Step 4: Checklist kiểm thử thủ công (Definition of Done)**

Run: `npm run dev` và xác nhận:
- `curl -I http://localhost:3000/` có `content-security-policy`, `strict-transport-security`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy`, `permissions-policy`.
- Chưa login mở `/dashboard` → chuyển `/login?callbackUrl=/dashboard`.
- CANDIDATE mở `/admin/users` → chuyển `/dashboard`; mở `/jobs/new` → chuyển `/dashboard`.
- Sai mật khẩu 6 lần cùng email → bị chặn (log `[auth] login bị rate-limit`).
- Đăng ký mật khẩu `abcdefgh` (thiếu số) → báo lỗi "Mật khẩu cần ít nhất một chữ số".
- Các trang công khai `/jobs`, `/companies`, `/login`, `/register` tải bình thường, không lỗi CSP trong console.

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md
git commit -m "docs(security): tài liệu Upstash env + tổng kết Gói A bảo mật"
```

---

## Ghi chú trade-off (có chủ đích)

- **Chống user-enumeration ở register**: không siết triệt để (giữ thông báo "email đã dùng" thân thiện). Giá trị bảo mật chính đến từ **rate-limit register** (Task 6) chặn dò hàng loạt. Login đã trả lỗi đồng nhất (Task 6).
- **CSP `connect-src 'self' https:`** nới lỏng để không vỡ kết nối Neon/Upstash/Gemini; đủ cho quy mô portfolio. Siết theo host cụ thể là việc của gói hạ tầng (D).
- **Fail-open** khi Upstash lỗi để không chặn người dùng thật; đánh đổi: sự cố Upstash làm mất rate-limit tạm thời (có log cảnh báo).
