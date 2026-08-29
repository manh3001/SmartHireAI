# Gói F — Chất lượng & Vận hành: CI, Sentry, e2e

- **Ngày**: 2026-08-29
- **Trạng thái**: Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh**: Vòng 6 (cuối) của lộ trình "nâng cấp bám sát web tuyển dụng thật". Gói A–E đã merge. Gói F thêm CI (GitHub Actions), error monitoring (Sentry), và e2e testing (Playwright).

## 1. Mục tiêu & vấn đề hiện tại

**Mục tiêu**: đảm bảo chất lượng qua CI tự động; bắt lỗi production bằng Sentry; kiểm chứng 4 luồng chính qua e2e Playwright.

**Hiện trạng**:
- Không có CI: push code không trigger lint/test/build tự động.
- Không có error monitoring: lỗi production chỉ phát hiện khi user báo cáo.
- Không có e2e: unit test + type check không đủ bắt regression UI/flow.

**Phạm vi loại trừ**:
- Playwright KHÔNG chạy trong CI (local dev tool only — tránh complexity headless + DB in CI).
- Không có session replay (Sentry).
- Không có performance profiling (Sentry).
- Không có visual regression testing.

## 2. Quyết định kiến trúc

**Approach A (đã chọn)**: CI = lint + test + build; Playwright = local dev tool; Sentry = full client+server.

**Tại sao không chạy Playwright trong CI**: Database seeding, auth state, và SSE connections làm CI e2e không ổn định (flaky) mà không đáng công setup. Local Playwright chạy với `npm run dev` thực + real DB là đủ cho portfolio scope.

**Tại sao dummy DATABASE_URL trong CI**: tất cả page đều `force-dynamic` → Next.js build không thực sự kết nối DB. Một dummy URL `postgresql://ci:ci@localhost/ci` đủ để build pass mà không cần real DB secret.

**CSP**: `connect-src 'self' https:` trong `lib/security/csp.ts` đã đủ rộng để cover `*.sentry.io` — không cần thay đổi.

## 3. Kiến trúc chi tiết

### 3.1 CI — GitHub Actions

**File**: `.github/workflows/ci.yml`

**Trigger**: push + PR to `main`

**Job `ci`** trên `ubuntu-latest`, Node 20:
```yaml
steps:
  - checkout
  - setup-node@v4 (node-version: 20, cache: npm)
  - npm ci
  - npm run lint
  - npm test
  - npm run build
```

**Env vars cho build step** (dummy — không kết nối thật):
```yaml
env:
  DATABASE_URL: postgresql://ci:ci@localhost/ci
  AUTH_SECRET: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  GEMINI_API_KEY: dummy
  APP_URL: http://localhost:3000
  NEXT_PUBLIC_SENTRY_DSN: ""
```

Các var tùy chọn (`BLOB_READ_WRITE_TOKEN`, `UPSTASH_*`, `RESEND_*`, `VAPID_*`, `SENTRY_AUTH_TOKEN`) bỏ qua — code đã có guard graceful degradation.

**Không cần** `SENTRY_AUTH_TOKEN` trong CI (source map upload là optional, có thể thêm sau khi user có tài khoản Sentry thật).

### 3.2 Sentry — @sentry/nextjs

**Package**: `@sentry/nextjs` (latest stable)

**Files mới:**

| File | Mô tả |
|------|-------|
| `sentry.client.config.ts` | Client-side Sentry.init — đọc `NEXT_PUBLIC_SENTRY_DSN` |
| `sentry.server.config.ts` | Server-side Sentry.init — đọc `SENTRY_DSN` |
| `instrumentation.ts` | Next.js 16 hook: dynamic import server config khi `NEXT_RUNTIME === "nodejs"` |

**Files sửa:**

| File | Thay đổi |
|------|----------|
| `next.config.ts` | Wrap export với `withSentryConfig(nextConfig, sentryWebpackOptions)` |
| `.env.example` | Thêm `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |

**Sentry config chi tiết:**
- `tracesSampleRate: 0.1` (10% requests)
- `debug: false`
- Không có `replaysSessionSampleRate` (no session replay)
- Guard: nếu DSN trống → `Sentry.init` vẫn gọi nhưng không gửi event (Sentry skip nếu DSN undefined)

**withSentryConfig options** trong `next.config.ts`:
- `silent: true` (không in warnings khi thiếu SENTRY_AUTH_TOKEN)
- `hideSourceMaps: true`
- `org` và `project` đọc từ env (optional)

**CSP**: không thay đổi — `connect-src 'self' https:` đã đủ.

### 3.3 Playwright e2e — local dev tool

**Package**: `@playwright/test`

**Config** (`playwright.config.ts`, root level):
```ts
baseURL: 'http://localhost:3000'
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000',
  reuseExistingServer: true,  // dùng server đang chạy nếu có
  timeout: 120_000,
}
testDir: 'e2e'
use: {
  video: 'retain-on-failure',
  screenshot: 'only-on-failure',
}
projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
```

**npm script** (thêm vào `package.json`): `"e2e": "playwright test"`

**Data isolation**: mỗi test dùng unique email `test-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.test` để tránh conflict.

**4 test files:**

#### `e2e/auth.spec.ts`
- Register candidate → redirect về `/login`
- Login → redirect về `/dashboard`
- Logout → redirect về `/login`

#### `e2e/candidate.spec.ts`
- Register + login as candidate
- Vào `/jobs` → job list visible (heading "Tìm việc làm" hoặc job cards)
- Click job card → detail page (URL có `/jobs/`)
- (Optional smoke) Click apply nếu job có nút apply

#### `e2e/recruiter.spec.ts`
- Register recruiter (role selector = "Tôi là Nhà tuyển dụng")
- Login → `/dashboard`
- Vào `/company/edit` → form company visible
- (Smoke) Fill company name → save → no error

#### `e2e/notifications.spec.ts`
- Register + login as candidate
- Vào `/notifications` → page render (heading "Thông báo" visible)
- Bell icon visible trong Navbar

## 4. Tasks

| # | Tên |
|---|-----|
| 1 | GitHub Actions CI workflow |
| 2 | Sentry integration |
| 3 | Playwright setup + auth e2e |
| 4 | Playwright candidate + recruiter + notifications e2e |

## 5. Kiểm thử

- Mỗi task: `npx tsc --noEmit` + `npm test` xanh (266 tests baseline).
- Task 1 smoke: push một commit → GitHub Actions tab → job `ci` pass.
- Task 2 smoke: `npm run build` pass với `NEXT_PUBLIC_SENTRY_DSN=""`.
- Task 3 smoke: `npx playwright install chromium && npm run e2e -- e2e/auth.spec.ts` → 3 tests pass.
- Task 4 smoke: `npm run e2e` → tất cả 4 spec files pass.

## 6. Môi trường

**Env mới (tùy chọn — thiếu → feature gracefully disabled):**
- `SENTRY_DSN` — server-side Sentry
- `NEXT_PUBLIC_SENTRY_DSN` — client-side Sentry
- `SENTRY_ORG`, `SENTRY_PROJECT` — source map upload
- `SENTRY_AUTH_TOKEN` — source map upload auth

**Env CI** (dummy, không kết nối thật):
- `DATABASE_URL=postgresql://ci:ci@localhost/ci`
- `AUTH_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`

## 7. Global Constraints (kế thừa từ cả dự án)

- Prisma v6 — không nâng v7
- Mọi lệnh chạm DB: `NODE_OPTIONS=--dns-result-order=ipv4first`
- Next 16: `proxy.ts` (không phải middleware.ts); không set `runtime` trong proxy
- Server Actions tự guard (không dựa vào proxy)
- Giá trị user input LUÔN qua tham số `$1,$2...` — không nội suy SQL
- Playwright KHÔNG chạy trong CI

## 8. Definition of Done

- `.github/workflows/ci.yml` tồn tại; push to `main` trigger lint + test + build.
- `sentry.client.config.ts`, `sentry.server.config.ts`, `instrumentation.ts` tồn tại.
- `next.config.ts` export wrapped với `withSentryConfig`.
- `playwright.config.ts` tồn tại; `npm run e2e` chạy 4 spec files trên chromium.
- `npm test` xanh (≥266 tests), `npm run build` pass (dummy DATABASE_URL).

## 9. Ngoài phạm vi

- Playwright trong CI
- Sentry session replay
- Performance profiling
- Visual regression testing
- Code coverage reports
- Load testing
