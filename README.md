# SmartHire — AI-Powered Job Board

A full-stack, two-sided recruitment platform with AI assistance. Candidates build structured CVs, export to PDF, and get AI-scored compatibility with job descriptions. Recruiters post structured listings, screen applicants with AI, and communicate directly with candidates.

> Personal portfolio project — production-grade engineering from auth to CI/CD.

[![CI](https://github.com/manh3001/SmartHireAI/actions/workflows/ci.yml/badge.svg)](https://github.com/manh3001/SmartHireAI/actions/workflows/ci.yml)

---

## Features

**Authentication & Authorization**
- Register / login (Auth.js v5, bcrypt password hashing)
- 3 roles: **Candidate**, **Recruiter**, **Admin** — each with a dedicated dashboard
- Centralized route protection (`proxy.ts`), security headers (CSP / HSTS / X-Frame-Options), login rate limiting, and password strength enforcement
- Admin panel: user management, job moderation, platform-wide statistics

**Candidate**
- CV Builder: multiple CVs with 5 sections (personal info, experience, education, skills, projects)
- Export CV to PDF (Vietnamese font support) and import CV from existing PDF
- AI CV evaluation against a JD: score, strengths/weaknesses, missing skills
- Career chatbot with CV context
- Advanced job search: `pg_trgm` + `unaccent` (typo-tolerant, accent-insensitive), "Load More" keyset pagination, facet counts per filter
- AI job recommendations based on CV
- Save jobs, apply, and track application status

**Recruiter**
- Post structured job listings (salary range, employment type, experience level, categories)
- Company profile with logo (stored in Vercel Blob)
- AI candidate screening against JD
- Kanban-style applicant board by status

**Real-time & Notifications**
- Server-Sent Events (SSE) for live notification badge and list updates
- Web Push notifications via VAPID (works when app is in background or closed)
- Status-change emails (Resend) when application moves to Interview / Offer / Hired / Rejected
- Job alert emails for saved search criteria

**Quality & Operations**
- GitHub Actions CI: lint → test → build on every push/PR
- Error monitoring: Sentry (client + server, via `instrumentation.ts`)
- Playwright e2e tests: auth, candidate, recruiter, and notifications flows (local dev tool)
- 279 Vitest unit tests (TDD, pure logic)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Actions, Turbopack), TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Sonner (toasts), Lucide React |
| Database | PostgreSQL (Neon) + Prisma 6 |
| Auth | Auth.js v5 (NextAuth), bcryptjs |
| AI | Gemini 2.5 Flash via OpenAI-compatible endpoint (`openai` SDK) |
| Search | `pg_trgm` + `unaccent`, GIN index, keyset + offset pagination |
| PDF | `@react-pdf/renderer` (export) · `unpdf` (import) |
| Email | Resend (`resend` SDK) |
| Push | Web Push VAPID (`web-push`), Service Worker |
| Storage | Vercel Blob (company logos) |
| Rate Limit | Upstash Redis (with in-memory fallback for dev) |
| Validation | Zod (shared client + server) |
| Monitoring | Sentry (`@sentry/nextjs`, client + server) |
| Unit Tests | Vitest |
| E2E Tests | Playwright (Chromium) |
| CI | GitHub Actions |

---

## Prerequisites

- **Node.js 20+** and npm
- A **PostgreSQL database** — [Neon](https://neon.tech) free tier works
- A **Gemini API key** (free) from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — required for AI features

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in required values
cp .env.example .env

# 3. Push Prisma schema to database
npm run db:push

# 4. (Optional) Enable full-text search and seed sample data
npm run db:search   # pg_trgm extension + GIN trigram index (idempotent)
npm run db:seed     # ~1 000 jobs + 60 companies (idempotent; users *@seed.example)

# 5. Start dev server
npm run dev
```

Open **http://localhost:3000**.

### Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | Auth.js secret — generate with `npx auth secret` |
| `GEMINI_API_KEY` | ✅* | Gemini API key. *AI features disabled if missing; rest of app works |
| `APP_URL` | ✅ | Public base URL (e.g. `http://localhost:3000`) |
| `RESEND_API_KEY` | ❌ | Resend key for email delivery; omit → log only, no emails sent |
| `EMAIL_FROM` | ❌ | Sender address (default `SmartHire <onboarding@resend.dev>`) |
| `BLOB_READ_WRITE_TOKEN` | ❌ | Vercel Blob token for company logo uploads |
| `UPSTASH_REDIS_REST_URL` | ❌ | Upstash Redis URL for distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | Upstash Redis token; omit → in-memory fallback (single-instance only) |
| `VAPID_PUBLIC_KEY` | ❌ | Web Push VAPID public key — generate with `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | ❌ | Web Push VAPID private key |
| `VAPID_SUBJECT` | ❌ | VAPID subject (`mailto:you@example.com`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ❌ | Same as `VAPID_PUBLIC_KEY` (exposed to client) |
| `SENTRY_DSN` | ❌ | Sentry DSN for server-side error capture |
| `NEXT_PUBLIC_SENTRY_DSN` | ❌ | Sentry DSN for client-side error capture |
| `SENTRY_ORG` | ❌ | Sentry org slug (for source map upload) |
| `SENTRY_PROJECT` | ❌ | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | ❌ | Sentry auth token for source map upload |

### Grant Admin Access

Register an account through the UI, then promote it:

```bash
npm run make-admin -- your@email.com
```

---

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm run db:push` | Sync Prisma schema to database |
| `npm run db:search` | Create `pg_trgm` extension + GIN index (idempotent) |
| `npm run db:seed` | Seed ~1 000 sample jobs + 60 companies (idempotent) |
| `npm run make-admin -- <email>` | Grant ADMIN role to an account |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | ESLint |
| `npm run e2e` | Run Playwright e2e tests (requires dev server) |

> All database commands prepend `NODE_OPTIONS=--dns-result-order=ipv4first` to avoid IPv6 issues with Neon.

---

## Testing

```bash
npm test          # 279 Vitest unit tests
npm run e2e       # Playwright e2e (auth / candidate / recruiter / notifications)
```

Unit tests cover pure logic (schema validation, scoring, normalization, realtime poll decisions). Database, route, and React component code is tested end-to-end via Playwright.

---

## Project Structure

```
app/                       Pages & API routes (App Router)
  cv/[id]/                 CV editor
  jobs/                    List, detail, new, recommendations, saved, alerts
  applications/            Candidate application tracker
  messages/[applicationId] In-application messaging
  notifications/           Notification center
  dashboard/               Role-specific dashboard
  admin/                   Admin panel (users, jobs, stats)
  companies/ · company/    Company directory & profile editor
  api/
    realtime/              SSE endpoint for live notification updates
    push/                  Web Push subscribe / unsubscribe
    cv/[id]/pdf            PDF export
    cv/import              PDF import
    register/ · auth/      Registration & Auth.js
lib/
  auth/                    Password validation, session helpers, route guards
  cv/                      Schema, normalization, Server Actions
  ai/                      Gemini client, evaluation, chatbot, screening, recommendations
  applications/            Application lifecycle & status actions
  messages/ · notifications/ Messaging & notifications (+ SSE + Web Push)
  push/                    Web Push send helper
  email/                   Resend client + email templates
  jobs/ · companies/       Job search (pg_trgm), alerts, company actions
  cache/                   Cache tag constants, revalidation helpers
  security/                CSP builder, rate limiter
  db/                      Prisma client singleton
prisma/                    schema.prisma
public/sw.js               Service Worker (Web Push)
e2e/                       Playwright specs
scripts/                   Utility scripts (make-admin, seed, migrate-logos)
.github/workflows/         GitHub Actions CI
```

---

## Troubleshooting

- **`P1001` / cannot connect to Neon:** usually IPv6 failure. Scripts already force IPv4; for manual Prisma commands prepend `NODE_OPTIONS=--dns-result-order=ipv4first`.
- **AI features show "GEMINI_API_KEY not configured":** add `GEMINI_API_KEY` to `.env` and restart.
- **Login fails after changing `.env`:** restart the dev server to reload environment variables.
- **Web Push not working:** generate VAPID keys with `npx web-push generate-vapid-keys` and set all four `VAPID_*` env vars. Requires HTTPS in production.
- **E2E tests fail on second run within an hour:** the in-memory rate limiter caps registrations at 5/hour. Restart the dev server to reset.

---

---

# SmartHire — Sàn tuyển dụng AI

Sàn tuyển dụng 2 chiều tích hợp AI: ứng viên tạo CV có cấu trúc, xuất PDF và được AI đánh giá độ phù hợp với JD; nhà tuyển dụng đăng tin có cấu trúc, được AI sàng lọc hồ sơ và trao đổi trực tiếp với ứng viên.

> Dự án portfolio cá nhân — kỹ thuật production từ auth đến CI/CD.

---

## Tính năng

**Tài khoản & phân quyền**
- Đăng ký / đăng nhập (Auth.js v5, mật khẩu băm bcrypt)
- 3 vai trò: **Ứng viên**, **Nhà tuyển dụng**, **Quản trị viên** — mỗi vai trò có dashboard riêng
- Bảo vệ route tập trung (`proxy.ts`), security headers (CSP/HSTS/X-Frame-Options), rate-limit đăng nhập và yêu cầu độ mạnh mật khẩu
- Trang quản trị: quản lý người dùng, tin tuyển dụng, thống kê toàn sàn

**Ứng viên**
- CV Builder: tạo nhiều CV với 5 mục (thông tin, kinh nghiệm, học vấn, kỹ năng, dự án)
- Xuất CV ra PDF (hỗ trợ font tiếng Việt) và nhập CV từ PDF có sẵn
- AI đánh giá CV theo JD: điểm số, điểm mạnh/yếu, kỹ năng còn thiếu
- Chatbot tư vấn nghề nghiệp có ngữ cảnh CV
- Tìm kiếm việc làm nâng cao: `pg_trgm` + `unaccent` (chịu lỗi chính tả + không dấu), phân trang "Xem thêm", facet counts
- AI gợi ý việc phù hợp theo CV; lưu tin; ứng tuyển và theo dõi trạng thái đơn

**Nhà tuyển dụng**
- Đăng tin tuyển dụng có cấu trúc (lương, loại hình, cấp bậc, danh mục…)
- Hồ sơ công ty với logo (lưu trên Vercel Blob)
- AI sàng lọc ứng viên theo JD
- Bảng kanban quản lý đơn ứng tuyển theo trạng thái

**Realtime & Thông báo**
- SSE (Server-Sent Events) cập nhật badge và danh sách thông báo theo thời gian thực
- Web Push VAPID — nhận thông báo kể cả khi đóng tab hoặc đóng ứng dụng
- Email khi trạng thái ứng tuyển thay đổi (Phỏng vấn / Offer / Nhận / Từ chối) qua Resend
- Email job alert cho tiêu chí tìm kiếm đã lưu

**Chất lượng & Vận hành**
- GitHub Actions CI: lint → test → build trên mỗi push/PR
- Error monitoring: Sentry (client + server, qua `instrumentation.ts`)
- Playwright e2e: auth, candidate, recruiter, notifications (công cụ dev local)
- 279 Vitest unit test (TDD, logic thuần)

---

## Công nghệ

| Lớp | Công nghệ |
|-----|-----------|
| Framework | Next.js 16 (App Router, Server Actions, Turbopack), TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Sonner (toast), Lucide React |
| Database | PostgreSQL (Neon) + Prisma 6 |
| Auth | Auth.js v5 (NextAuth), bcryptjs |
| AI | Gemini 2.5 Flash qua endpoint tương thích OpenAI (SDK `openai`) |
| Tìm kiếm | `pg_trgm` + `unaccent`, GIN index, keyset + offset pagination |
| PDF | `@react-pdf/renderer` (xuất) · `unpdf` (nhập) |
| Email | Resend |
| Push | Web Push VAPID (`web-push`), Service Worker |
| Storage | Vercel Blob (logo công ty) |
| Rate Limit | Upstash Redis (fallback in-memory cho dev) |
| Validation | Zod (dùng chung client + server) |
| Monitoring | Sentry (`@sentry/nextjs`, client + server) |
| Unit Test | Vitest |
| E2E Test | Playwright (Chromium) |
| CI | GitHub Actions |

---

## Chạy dự án

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file .env (tham khảo .env.example) và điền các biến bắt buộc
cp .env.example .env

# 3. Đẩy schema Prisma lên database
npm run db:push

# 4. (Tuỳ chọn) Bật tìm kiếm nâng cao và tạo dữ liệu mẫu
npm run db:search   # pg_trgm extension + GIN index (idempotent)
npm run db:seed     # ~1 000 tin + 60 công ty mẫu (idempotent)

# 5. Chạy dev server
npm run dev
```

Mở **http://localhost:3000**.

### Cấp quyền quản trị

```bash
npm run make-admin -- your@email.com
```

---

## Xử lý sự cố

- **`P1001` / không kết nối được Neon:** thường do IPv6 hỏng — các script đã ép IPv4 sẵn; với lệnh Prisma thủ công, thêm `NODE_OPTIONS=--dns-result-order=ipv4first` phía trước.
- **Tính năng AI báo lỗi:** thiếu `GEMINI_API_KEY` trong `.env`.
- **Đăng nhập lỗi sau khi đổi `.env`:** khởi động lại dev server.
- **Web Push không hoạt động:** chạy `npx web-push generate-vapid-keys` rồi điền 4 biến `VAPID_*`. Cần HTTPS trên production.
- **E2E test lỗi khi chạy lần 2 trong cùng 1 giờ:** rate limiter in-memory giới hạn 5 lần đăng ký/giờ — khởi động lại dev server để reset.

