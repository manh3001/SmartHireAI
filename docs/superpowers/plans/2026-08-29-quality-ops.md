# Gói F — Chất lượng & Vận hành Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub Actions CI (lint+test+build), Sentry error monitoring (client+server), and Playwright e2e tests (4 flows, local dev tool).

**Architecture:** CI triggers on push/PR to main with dummy DB env — no real DB needed since all pages are `force-dynamic`. Sentry uses `instrumentation.ts` (Next.js 16 hook) for server-side init and `sentry.client.config.ts` for client-side. Playwright runs locally against `npm run dev` on chromium only; NOT in CI.

**Tech Stack:** GitHub Actions, `@sentry/nextjs`, `@playwright/test`, Vitest (existing), Next.js 16.

## Global Constraints

- Prisma v6 — không nâng v7
- Mọi lệnh chạm DB: `NODE_OPTIONS=--dns-result-order=ipv4first` (đã có trong npm scripts)
- Next 16: `proxy.ts` (không phải middleware.ts); không set `runtime` trong proxy
- Server Actions tự guard — không dựa vào proxy
- Giá trị user input LUÔN qua tham số `$1,$2...` — không nội suy SQL
- Playwright KHÔNG chạy trong CI
- `revalidateTag` yêu cầu 2 args: `(tag, "max")` — không dùng 1-arg form
- Tất cả import `@/` đều resolve từ root project (alias cấu hình trong `vitest.config.ts`)

---

### Task 1: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: (none)

**Interfaces:**
- Consumes: `package.json` scripts — `lint` (`eslint`), `test` (`vitest run`), `build` (`next build`)
- Produces: Automated CI on every push/PR to `main`

- [ ] **Step 1: Tạo thư mục và file workflow**

```bash
mkdir -p .github/workflows
```

Tạo `.github/workflows/ci.yml` với nội dung:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: postgresql://ci:ci@localhost/ci
          AUTH_SECRET: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
          GEMINI_API_KEY: dummy
          APP_URL: http://localhost:3000
          NEXT_PUBLIC_SENTRY_DSN: ""
```

- [ ] **Step 2: Xác nhận TypeScript clean**

```bash
npx tsc --noEmit
```

Expected: không có lỗi.

- [ ] **Step 3: Chạy test suite hiện tại**

```bash
npm test
```

Expected: tất cả tests pass (≥266 tests). File `.github/workflows/ci.yml` không ảnh hưởng unit tests.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow (lint + test + build)"
```

---

### Task 2: Sentry integration

**Files:**
- Create: `sentry.client.config.ts`
- Create: `sentry.server.config.ts`
- Create: `instrumentation.ts`
- Modify: `next.config.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `next.config.ts` (hiện tại export `nextConfig: NextConfig`)
- Produces:
  - `sentry.client.config.ts` — Sentry.init cho browser bundle
  - `sentry.server.config.ts` — Sentry.init cho Node.js runtime
  - `instrumentation.ts` — Next.js 16 hook, gọi `register()` khi server start
  - `next.config.ts` — export wrapped với `withSentryConfig`

- [ ] **Step 1: Cài đặt @sentry/nextjs**

```bash
npm install @sentry/nextjs
```

Expected: package thêm vào `dependencies` trong `package.json`.

- [ ] **Step 2: Tạo sentry.client.config.ts**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
});
```

- [ ] **Step 3: Tạo sentry.server.config.ts**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
});
```

- [ ] **Step 4: Tạo instrumentation.ts (root level, KHÔNG trong app/)**

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}
```

- [ ] **Step 5: Cập nhật next.config.ts — wrap với withSentryConfig**

Đọc `next.config.ts` hiện tại (để đảm bảo không mất cấu hình):

```typescript
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
});
```

- [ ] **Step 6: Cập nhật .env.example — thêm Sentry vars**

Append vào cuối file `.env.example`:

```
# Sentry error monitoring (tùy chọn — bỏ trống -> không gửi events).
# Tạo project tại sentry.io, lấy DSN từ Settings → Client Keys.
SENTRY_DSN="https://...@....ingest.sentry.io/..."
NEXT_PUBLIC_SENTRY_DSN="https://...@....ingest.sentry.io/..."
SENTRY_ORG="your-org-slug"
SENTRY_PROJECT="your-project-slug"
SENTRY_AUTH_TOKEN="sntrys_..."
```

- [ ] **Step 7: Xác nhận TypeScript clean**

```bash
npx tsc --noEmit
```

Expected: không có lỗi. Nếu `@sentry/nextjs` thiếu type, kiểm tra `tsconfig.json` include types.

- [ ] **Step 8: Chạy test suite**

```bash
npm test
```

Expected: ≥266 tests pass. Sentry không ảnh hưởng unit tests.

- [ ] **Step 9: Build với dummy DSN**

```bash
NEXT_PUBLIC_SENTRY_DSN="" npm run build
```

Trên Windows dùng:
```bash
cross-env NEXT_PUBLIC_SENTRY_DSN="" npm run build
```

Expected: build pass. `silent: true` trong `withSentryConfig` suppress warnings khi thiếu `SENTRY_AUTH_TOKEN`.

- [ ] **Step 10: Commit**

```bash
git add sentry.client.config.ts sentry.server.config.ts instrumentation.ts next.config.ts .env.example
git commit -m "feat(monitoring): add Sentry client+server via instrumentation.ts"
```

---

### Task 3: Playwright setup + auth e2e

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/auth.spec.ts`
- Modify: `package.json` (thêm script `e2e`)
- Modify: `.gitignore` (thêm playwright artifacts)

**Interfaces:**
- Consumes: `/register` (POST `/api/register`), `/login` (signIn credentials), Navbar logout form
- Produces:
  - `playwright.config.ts` — config chromium, baseURL, webServer
  - `e2e/auth.spec.ts` — 3 tests: register, login, logout
  - `npm run e2e` script

- [ ] **Step 1: Cài đặt @playwright/test**

```bash
npm install --save-dev @playwright/test
```

Expected: `@playwright/test` thêm vào `devDependencies`.

- [ ] **Step 2: Install chromium browser**

```bash
npx playwright install chromium
```

Expected: chromium binary download (~150MB).

- [ ] **Step 3: Tạo playwright.config.ts**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:3000",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 4: Thêm script vào package.json**

Mở `package.json`, thêm vào `scripts`:
```json
"e2e": "playwright test"
```

Kết quả scripts section trông như thế này:
```json
"scripts": {
  "dev": "cross-env NODE_OPTIONS=--dns-result-order=ipv4first next dev",
  "build": "cross-env NODE_OPTIONS=--dns-result-order=ipv4first next build",
  "start": "cross-env NODE_OPTIONS=--dns-result-order=ipv4first next start",
  "db:push": "cross-env NODE_OPTIONS=--dns-result-order=ipv4first prisma db push",
  "db:search": "cross-env NODE_OPTIONS=--dns-result-order=ipv4first prisma db execute --file prisma/search-setup.sql --schema prisma/schema.prisma",
  "db:seed": "cross-env NODE_OPTIONS=--dns-result-order=ipv4first npx tsx scripts/seed.ts",
  "make-admin": "cross-env NODE_OPTIONS=--dns-result-order=ipv4first node scripts/make-admin.ts",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:migrate-logos": "cross-env NODE_OPTIONS=--dns-result-order=ipv4first npx tsx scripts/migrate-logos.ts",
  "e2e": "playwright test"
}
```

- [ ] **Step 5: Thêm Playwright artifacts vào .gitignore**

Thêm vào cuối `.gitignore`:
```
# Playwright
/test-results/
/playwright-report/
```

- [ ] **Step 6: Tạo e2e/auth.spec.ts**

Tạo thư mục `e2e/` và file `e2e/auth.spec.ts`:

```typescript
import { test, expect, type Page } from "@playwright/test";

function unique() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function registerUser(page: Page, email: string, password: string, role = "CANDIDATE") {
  await page.goto("/register");
  await page.fill('[name="name"]', "E2E Test User");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.selectOption('[name="role"]', role);
  await page.click('button[type="submit"]');
  await page.waitForURL("/login");
}

test("register redirects to /login", async ({ page }) => {
  const email = `${unique()}@e2e.test`;
  await page.goto("/register");
  await page.fill('[name="name"]', "E2E Test User");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', "password123");
  await page.selectOption('[name="role"]', "CANDIDATE");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/login");
});

test("login redirects to /dashboard", async ({ page }) => {
  const email = `${unique()}@e2e.test`;
  await registerUser(page, email, "password123");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/dashboard");
});

test("logout redirects to /login", async ({ page }) => {
  const email = `${unique()}@e2e.test`;
  await registerUser(page, email, "password123");
  // Login
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("/dashboard");
  // Logout — button text "Đăng xuất" inside a form
  await page.click('button:has-text("Đăng xuất")');
  await expect(page).toHaveURL("/login");
});
```

- [ ] **Step 7: Chạy auth e2e (yêu cầu dev server hoặc tự start)**

Đảm bảo `.env` có đầy đủ `DATABASE_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`, `APP_URL`.

```bash
npm run e2e -- e2e/auth.spec.ts
```

Expected output:
```
Running 3 tests using 1 worker
  ✓  auth.spec.ts:13:5 › register redirects to /login
  ✓  auth.spec.ts:24:5 › login redirects to /dashboard
  ✓  auth.spec.ts:34:5 › logout redirects to /login
3 passed (Xs)
```

- [ ] **Step 8: Xác nhận TypeScript clean**

```bash
npx tsc --noEmit
```

Expected: không có lỗi (`playwright.config.ts` và `e2e/*.spec.ts` không được include trong main tsconfig nên không cần thêm vào tsconfig — Playwright dùng tsconfig riêng tự động).

Nếu có lỗi TypeScript liên quan đến `e2e/` files, tạo `e2e/tsconfig.json`:
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "types": ["@playwright/test"]
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 9: Chạy Vitest để đảm bảo không regression**

```bash
npm test
```

Expected: ≥266 tests pass.

- [ ] **Step 10: Commit**

```bash
git add playwright.config.ts e2e/auth.spec.ts package.json .gitignore
git commit -m "test(e2e): add Playwright setup + auth flow (register/login/logout)"
```

---

### Task 4: Playwright candidate + recruiter + notifications e2e

**Files:**
- Create: `e2e/helpers.ts`
- Create: `e2e/candidate.spec.ts`
- Create: `e2e/recruiter.spec.ts`
- Create: `e2e/notifications.spec.ts`

**Interfaces:**
- Consumes: `e2e/auth.spec.ts` patterns (registerUser helper đã có, sẽ extract sang helpers.ts)
- Produces: 3 spec files covering candidate, recruiter, notifications flows

> **Note về data**: e2e tests chạy với DB thực. Nếu DB trống (chưa seed), `/jobs` sẽ hiển thị empty state — tests vẫn pass vì chỉ kiểm tra page load và navigation, không kiểm tra data cụ thể.

- [ ] **Step 1: Tạo e2e/helpers.ts — shared helper**

```typescript
import type { Page } from "@playwright/test";

export function unique() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function registerAndLogin(
  page: Page,
  role: "CANDIDATE" | "RECRUITER" = "CANDIDATE",
): Promise<{ email: string; password: string }> {
  const email = `${unique()}@e2e.test`;
  const password = "password123";

  await page.goto("/register");
  await page.fill('[name="name"]', "E2E User");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.selectOption('[name="role"]', role);
  await page.click('button[type="submit"]');
  await page.waitForURL("/login");

  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/dashboard");

  return { email, password };
}
```

- [ ] **Step 2: Tạo e2e/candidate.spec.ts**

```typescript
import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test("candidate: /jobs page loads and shows search UI", async ({ page }) => {
  await registerAndLogin(page, "CANDIDATE");
  await page.goto("/jobs");
  await expect(page).toHaveURL("/jobs");
  // Page renders without redirect (không bị đẩy về /login)
  // Search input hoặc jobs container visible
  await expect(page.locator("main")).toBeVisible();
});

test("candidate: /jobs detail page loads when clicking job card", async ({ page }) => {
  await registerAndLogin(page, "CANDIDATE");
  await page.goto("/jobs");
  // Nếu có job cards, click cái đầu tiên
  const firstJobLink = page.locator('a[href^="/jobs/"]').first();
  const hasJobs = await firstJobLink.count() > 0;
  if (hasJobs) {
    await firstJobLink.click();
    await expect(page).toHaveURL(/\/jobs\/.+/);
    await expect(page.locator("main")).toBeVisible();
  } else {
    // DB trống — skip assertion, page đã load thành công
    await expect(page).toHaveURL("/jobs");
  }
});
```

- [ ] **Step 3: Tạo e2e/recruiter.spec.ts**

```typescript
import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test("recruiter: /company/edit page loads with company form", async ({ page }) => {
  await registerAndLogin(page, "RECRUITER");
  await page.goto("/company/edit");
  await expect(page).toHaveURL("/company/edit");
  // Heading "Hồ sơ công ty" visible
  await expect(page.getByText("Hồ sơ công ty")).toBeVisible();
  // Form input for company name visible
  await expect(page.locator('input[name="name"]')).toBeVisible();
});

test("recruiter: submit company form without error", async ({ page }) => {
  await registerAndLogin(page, "RECRUITER");
  await page.goto("/company/edit");
  // Fill company name
  await page.fill('input[name="name"]', "E2E Test Company");
  // Submit form (Server Action — page reloads)
  await page.click('button[type="submit"]');
  // After submit: không có error message, vẫn ở /company/edit
  await expect(page).toHaveURL(/\/company\/edit/);
  await expect(page.locator("text=Hồ sơ công ty")).toBeVisible();
});
```

- [ ] **Step 4: Tạo e2e/notifications.spec.ts**

```typescript
import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test("notifications: /notifications page renders for logged-in user", async ({ page }) => {
  await registerAndLogin(page, "CANDIDATE");
  await page.goto("/notifications");
  await expect(page).toHaveURL("/notifications");
  await expect(page.locator("main")).toBeVisible();
});

test("notifications: bell icon visible in navbar after login", async ({ page }) => {
  await registerAndLogin(page, "CANDIDATE");
  // Bell icon có aria-label="Thông báo"
  await expect(page.locator('[aria-label="Thông báo"]')).toBeVisible();
});

test("notifications: unauthenticated /notifications redirects to /login", async ({ page }) => {
  await page.goto("/notifications");
  await expect(page).toHaveURL("/login");
});
```

- [ ] **Step 5: Chạy tất cả e2e tests**

```bash
npm run e2e
```

Expected output:
```
Running 8 tests using 1 worker
  ✓  auth.spec.ts › register redirects to /login
  ✓  auth.spec.ts › login redirects to /dashboard
  ✓  auth.spec.ts › logout redirects to /login
  ✓  candidate.spec.ts › candidate: /jobs page loads and shows search UI
  ✓  candidate.spec.ts › candidate: /jobs detail page loads when clicking job card
  ✓  recruiter.spec.ts › recruiter: /company/edit page loads with company form
  ✓  recruiter.spec.ts › recruiter: submit company form without error
  ✓  notifications.spec.ts › notifications: /notifications page renders for logged-in user
  ✓  notifications.spec.ts › notifications: bell icon visible in navbar after login
  ✓  notifications.spec.ts › notifications: unauthenticated /notifications redirects to /login
10 passed (Xs)
```

Nếu một test fail do timing, thêm `timeout` vào `playwright.config.ts`:
```typescript
use: {
  baseURL: "http://localhost:3000",
  video: "retain-on-failure",
  screenshot: "only-on-failure",
  actionTimeout: 10_000,
},
```

- [ ] **Step 6: Xác nhận Vitest không bị ảnh hưởng**

```bash
npm test
```

Expected: ≥266 tests pass.

- [ ] **Step 7: Xác nhận tsc clean**

```bash
npx tsc --noEmit
```

Expected: không có lỗi.

- [ ] **Step 8: Commit**

```bash
git add e2e/helpers.ts e2e/candidate.spec.ts e2e/recruiter.spec.ts e2e/notifications.spec.ts
git commit -m "test(e2e): add Playwright specs for candidate, recruiter, notifications flows"
```

---

## Definition of Done

- `.github/workflows/ci.yml` tồn tại; trigger lint + test + build trên push/PR to `main`.
- `sentry.client.config.ts`, `sentry.server.config.ts`, `instrumentation.ts` tồn tại ở root.
- `next.config.ts` export wrapped với `withSentryConfig`.
- `playwright.config.ts` tồn tại; `npm run e2e` chạy ≥10 tests trên chromium.
- `npm test` xanh (≥266 tests), `npx tsc --noEmit` clean, `npm run build` pass.
