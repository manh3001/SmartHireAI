# Gói A — Bảo mật nền tảng (Security Foundation)

- **Ngày**: 2026-08-27
- **Trạng thái**: Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh**: Vòng 1 của lộ trình "nâng cấp bám sát web tuyển dụng thật" (mục tiêu cân bằng portfolio / production / học kỹ thuật). Gói A là nền móng; các gói B–F (tìm kiếm & dữ liệu, UI/UX, hiệu năng & hạ tầng, realtime, chất lượng & vận hành) làm ở vòng sau.

## 1. Mục tiêu & phi mục tiêu

**Mục tiêu**: chuẩn hoá và lấp các lỗ hổng bảo mật nền tảng hiện có, đạt mức "nói được khi phỏng vấn" và an toàn thực tế ở quy mô portfolio/production nhỏ, mà không phá vỡ cơ chế đang đúng.

**Vấn đề hiện tại (đã khảo sát code)**:
- Không có `middleware.ts` → không có bảo vệ route tập trung; mỗi page/action tự kiểm tra.
- Guard rải rác: pattern `auth()` + check role + `redirect` lặp lại nhiều nơi; chỉ có `requireAdmin` là helper (`lib/admin/guard.ts`).
- Rate limiter in-memory (`lib/ai/rate-limit.ts`, `Map`): chỉ đúng trong 1 instance, reset khi cold-start, và **chỉ áp cho AI**. `register`/`login` không bị giới hạn → brute-force / credential-stuffing / spam.
- `next.config.ts` trống → thiếu security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
- Mật khẩu chỉ `min(8)` (`lib/auth/validation.ts`), không yêu cầu độ mạnh; register có thể lộ user-enumeration.

**Phi mục tiêu (để gói sau)**: upload file/CDN, WAF, 2FA, email verification, OAuth social login, audit log tập trung.

## 2. Kiến trúc — 3 lớp phòng thủ (defence-in-depth)

```
Request → [1] middleware.ts            security headers + route protection (edge, mọi request)
        → [2] lib/auth/session.ts      guard tập trung cho Server Actions/pages (requireUser/requireRole)
        → [3] lib/security/ratelimit.ts Upstash Redis, áp cho login/register/AI/mutation nhạy cảm
```

Nguyên tắc: **không xoá cơ chế đang đúng** (ownership check theo `userId`, `requireAdmin`). Middleware KHÔNG thay guard trong server action — cả hai cùng tồn tại (defence-in-depth).

## 3. Security headers & CSP

Thêm `async headers()` vào `next.config.ts`, áp mọi route. Chuỗi CSP sinh từ builder thuần `lib/security/csp.ts` → `buildCsp({ isProd }): string` (unit-test được, không viết chuỗi tay trong config).

| Header | Giá trị |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `img-src 'self' data: https:`; `connect-src 'self'` + Neon/Upstash/Gemini; `script-src 'self'` (dev thêm `'unsafe-eval'` cho Turbopack, chỉ khi `!isProd`); `style-src 'self' 'unsafe-inline'` (Tailwind/inline) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

Trade-off ghi rõ: chấp nhận `style-src 'unsafe-inline'` vì Tailwind v4 + inline style; `script-src 'unsafe-eval'` chỉ ở dev.

## 4. `middleware.ts` — bảo vệ route tập trung

- File `middleware.ts` ở gốc, dùng `auth` của Auth.js v5 (edge-compatible).
- **Matcher**: bỏ qua `_next`, static assets, `/api/auth`, file ảnh.
- Bảng khai báo thuần `routeRules` (path prefix → yêu cầu: `authed` | role) trong `lib/auth/route-rules.ts`, test được.
- **Route riêng tư** (`/dashboard`, `/cv`, `/jobs/new`, `/applications`, `/messages`, `/notifications`, `/company`, `/admin`): chưa login → redirect `/login?callbackUrl=...`.
- **Theo role**: `/admin/*` chỉ ADMIN; `/jobs/new`, `/company/edit` chỉ RECRUITER. Sai role → redirect `/dashboard`.

## 5. Guard tập trung — `lib/auth/session.ts`

Gộp pattern lặp thành helper:

```ts
requireUser(): Promise<Session>       // chưa login → redirect /login
requireRole(role): Promise<Session>   // sai role → redirect /dashboard
getSessionUser(): Promise<SessionUser | null> // không redirect, cho nhánh optional
```

- `adminAccess` (trong `lib/admin/guard.ts`) → tổng quát hoá thành `roleAccess(session, role): "ok" | "login" | "forbidden"` thuần; `requireAdmin` gọi lại `roleAccess(session, "ADMIN")` để không phá chỗ đang dùng.
- Refactor các action rải rác (`lib/jobs/actions.ts`, `lib/applications/*`, `lib/company/actions.ts`, `lib/messages/actions.ts`, `lib/cv/actions.ts`) dùng helper mới. Giữ nguyên các ownership check (`where: { id, userId }`).

## 6. Rate-limit — Upstash Redis (`lib/security/ratelimit.ts`)

- `@upstash/ratelimit` + `@upstash/redis`, cấu hình `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
- Sliding window theo điểm áp:

| Điểm áp | Khoá | Ngưỡng (khởi điểm) |
|---|---|---|
| Login (`authorize` trong `auth.ts`) | `ip + email` | 5 / 15 phút |
| Register API (`app/api/register/route.ts`) | `ip` | 5 / giờ |
| AI (evaluate/chat/screening/recommend) | `userId` | 20 / giờ (thay `Map` cũ) |
| Mutation nhạy cảm (apply, gửi message) | `userId` | 30 / phút |

- Key builder thuần `rateKey(scope, id): string` (test được).
- **Fail-open có kiểm soát**: Redis lỗi → cho qua + `console.warn` (không chặn người dùng thật vì sự cố hạ tầng). Ghi chú rõ; cân nhắc fail-closed nhẹ cho login trong plan.
- Giữ `createRateLimiter` in-memory cũ làm **fallback khi không cấu hình Upstash** (dev/test). Không xoá test cũ. Một lớp adapter chọn Redis-hay-in-memory theo env.

## 7. Password policy & auth hardening

- `passwordStrength(pw): { ok: boolean; error?: string }` thuần: `>= 8`, có chữ và số, `<= 72` (giới hạn bcrypt). `registerSchema.password` dùng qua `.refine(...)`, message tiếng Việt.
- **Chống user-enumeration**: register email trùng trả phản hồi đồng nhất, không tiết lộ "email đã tồn tại" theo cách phân biệt được; login luôn cùng một lỗi "Email hoặc mật khẩu không đúng".
- Ghi chú cấu hình production: `AUTH_TRUST_HOST`, cookie `secure`.

## 8. Kiểm thử (TDD, đúng phong cách repo — chỉ logic thuần)

- `roleAccess` — ma trận role × yêu cầu.
- `buildCsp` — chứa directive bắt buộc; production KHÔNG có `unsafe-eval` trong `script-src`.
- `routeRules` — map path prefix → yêu cầu quyền.
- `rateKey` + logic chọn limiter (mock Redis / thiếu env → fallback).
- `passwordStrength` — ca hợp lệ & không hợp lệ.

Middleware & route: kiểm thử tay theo checklist (repo hiện không unit-test route/middleware). E2E để Gói F.

## 9. Biến môi trường mới

`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` → cập nhật `.env.example`, README (kèm ghi chú: thiếu Upstash thì fallback in-memory cho dev/test).

## 10. Tiêu chí hoàn thành (Definition of Done)

- `middleware.ts` chặn đúng route riêng tư & theo role (checklist tay pass).
- Security headers xuất hiện trên response (kiểm tra `curl -I` / devtools).
- Login & register bị rate-limit (thử vượt ngưỡng → 429/khoá).
- AI rate-limit chuyển sang Upstash, fallback in-memory khi thiếu env.
- Các server action dùng guard tập trung; không còn pattern lặp thủ công ở các file đã liệt kê.
- Password yếu bị từ chối; login trả lỗi mờ.
- `npm test` xanh (test mới + cũ). `npm run build` & `npm run lint` pass.

## 11. Roadmap tổng (B–F, tham chiếu)

- **B. Tìm kiếm & dữ liệu**: Postgres full-text (`tsvector`) + GIN index, facet lọc, phân trang cursor, seed dữ liệu lớn (Faker), index cột lọc/sort.
- **C. UI/UX production**: hoàn thiện design token, trang chủ + master-detail jobs, skeleton/empty/error states, a11y, responsive.
- **D. Hiệu năng & hạ tầng**: tag-based cache/revalidate, sửa N+1, logo `Bytes` → object storage + `next/image`, streaming RSC.
- **E. Realtime**: polling → SSE cho notifications/messages, email thật (Resend), web push (tuỳ chọn).
- **F. Chất lượng & vận hành**: GitHub Actions CI (lint+test+build), Sentry, structured logging, Playwright e2e, analytics cơ bản.
