# Bảo mật sâu — Vòng 1 (Design)

- **Ngày:** 2026-09-17
- **Trạng thái:** Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh:** Lộ trình "bám sát web tuyển dụng thật" (Gói A–F) đã xong & nằm trong `main`.
  Gói A (bảo mật nền tảng) đã có: CSP + security headers, route protection tập trung
  (`proxy.ts` + `routeDecision`), guard `requireUser`/`requireRole`, rate-limit Upstash +
  fallback in-memory, kiểm độ mạnh mật khẩu, Google OAuth (NextAuth v5 JWT, không adapter).
  Vòng này đào sâu thêm mảng xác thực + gia cố ngầm + khả năng truy vết.

## Mục tiêu

Triết lý **cân bằng**: vừa vá các lỗ hổng ngầm quan trọng, vừa bổ sung tính năng bảo mật
người dùng thấy được, cho giống một web tuyển dụng thật.

Phạm vi Vòng 1 gồm 4 hạng mục:
1. Reset mật khẩu qua email.
2. Xác minh email khi đăng ký (ép **mềm**).
3. Vá lỗ hổng ngầm (origin check, rate-limit fail-closed cho auth, anti-enumeration, siết CSP).
4. Audit log bảo mật + trang admin xem log.

**Ngoài phạm vi (để Vòng 2):** 2FA/TOTP; quản lý & thu hồi phiên (token-version, đăng xuất
mọi nơi khi reset); lịch sử đăng nhập cho user.

## Quyết định kiến trúc: cơ chế token

Chọn **token băm lưu DB, dùng-một-lần, có hạn** (OWASP-aligned):
- Sinh token ngẫu nhiên 32 byte → gửi bản gốc trong link email.
- Lưu **SHA-256(token)** + `expiresAt` + `usedAt` trong DB (KHÔNG lưu token gốc).
- Khi verify: băm lại token nhận được, tra DB theo `tokenHash`, kiểm hạn & chưa dùng.

Lý do: thu hồi được, đảm bảo dùng-một-lần thật, lộ DB cũng không tái sử dụng được, khớp
pattern DI + Prisma sẵn có. (Loại JWT stateless vì không thu hồi/không đảm bảo one-time;
loại OTP vì dễ brute-force & UX không hợp luồng email.)

## 1. Mô hình dữ liệu (Prisma)

Thêm vào `User`:
- `emailVerified DateTime?` — null = chưa xác minh; timestamp = đã xác minh (quy ước NextAuth).
- Quan hệ: `authTokens AuthToken[]`, `auditLogs AuditLog[]`.

Bảng mới:

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
  tokenHash String           @unique  // SHA-256 hex của token gốc
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime         @default(now())

  @@index([userId, purpose])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?           // actor; null nếu login sai với email lạ
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action    String            // "login.success", "password.reset", "role.change"...
  targetId  String?           // đối tượng bị tác động (vd user bị đổi role)
  ip        String?
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

`action` dùng string + hằng union TS `AUDIT_ACTIONS` để linh hoạt mà vẫn type-safe ở call site.

Áp bằng `npm run db:push` (dự án dùng db push, không migrate). Cần chạy ở cả local & production.

## 2. Logic thuần (pattern dependency-injection, test bằng vitest + fake deps)

- `lib/auth/tokens.ts`
  - `generateToken(): { raw: string; hash: string }` — 32 byte ngẫu nhiên (crypto), raw hex/base64url, hash = SHA-256(raw) hex.
  - `hashToken(raw: string): string` — SHA-256 hex.
  - `tokenExpiry(purpose, now): Date` — EMAIL_VERIFY 24h, PASSWORD_RESET 1h.
- `lib/auth/email-verification.ts`
  - `createVerification(userId, deps)` — tạo AuthToken EMAIL_VERIFY, trả `{ raw }` để dựng link.
  - `confirmVerification(rawToken, deps)` — băm, tra DB, kiểm hạn/đã-dùng → set `emailVerified`, đánh dấu token used. Trả kết quả rõ ràng (ok / invalid / expired / used).
- `lib/auth/password-reset.ts`
  - `requestReset(email, deps)` — tra user; nếu tồn tại & có `passwordHash` → tạo token PASSWORD_RESET + trả `{ raw }`. Luôn trả trạng thái "đã xử lý" (không lộ tồn tại).
  - `confirmReset(rawToken, newPassword, deps)` — kiểm độ mạnh mật khẩu, băm token, kiểm token, cập nhật `passwordHash`, đánh dấu token used + vô hiệu các token PASSWORD_RESET khác của user.
- `lib/audit/log.ts`
  - `AUDIT_ACTIONS` (hằng union), `recordAudit(entry, deps)`.
- `lib/security/origin.ts`
  - `assertSameOrigin(req): boolean` / hàm trả 403 — so `Origin` (hoặc `Referer` fallback) với host hợp lệ (từ `APP_URL` và/hoặc host request).
- `lib/email/templates.ts`
  - `verifyEmailHtml(link)`, `resetPasswordHtml(link)`.

Wiring (không thuần, mỏng): server actions/route handlers gọi các hàm trên với deps thật
(Prisma, `sendEmail`, `hashPassword`/`verifyPassword`).

## 3. Các luồng

### Đăng ký
- Sau khi tạo user thành công (credentials): gọi `createVerification` → gửi email link
  `/verify-email?token=…`. `emailVerified` để null.
- Anti-enumeration: **giữ** thông báo "Email đã được đăng ký" khi trùng (giống web thật);
  anti-enumeration tập trung ở luồng reset & login.

### Xác minh email
- Trang `/verify-email` (server component, đọc `?token`): gọi `confirmVerification` → hiển thị
  kết quả (thành công / link hỏng / hết hạn). Thành công → set `emailVerified`, ghi audit
  `email.verify`.
- **Gửi lại email xác minh:** server action, rate-limited (scope `register` hoặc scope mới).
- Tài khoản Google (OAuth): tự set `emailVerified` khi `email_verified === true` (chỉnh
  `lib/auth/oauth.ts` + nơi upsert user).
- **Ép mềm:** chặn *ứng tuyển* (candidate) và *đăng tin/tạo job* (recruiter) khi
  `emailVerified` null → trả lỗi thân thiện ("Vui lòng xác minh email trước") + **banner nhắc**
  ở dashboard (component client đọc trạng thái từ session/server).

### Quên & Reset mật khẩu
- `/forgot-password`: form nhập email → server action `requestPasswordReset` → **luôn** trả
  thông báo chung ("Nếu email tồn tại, chúng tôi đã gửi link đặt lại"). Chỉ gửi mail nếu user
  tồn tại & có `passwordHash` (bỏ qua tài khoản chỉ-Google). Rate-limited scope `passwordReset`.
- `/reset-password?token=…`: form mật khẩu mới (dùng `password-strength` sẵn có) → server action
  `confirmPasswordReset` → cập nhật `passwordHash`, vô hiệu token, ghi audit `password.reset`.
- Ghi chú: đăng xuất mọi phiên khi reset cần token-version (JWT) → **để Vòng 2**.

## 4. Vá lỗ hổng ngầm

- **Origin check** cho route handler đổi trạng thái: `app/api/register`,
  `app/api/cv/[id]/evaluate|analyze|chat`, `app/api/jobs/[id]/view`. Thiếu/khác origin → 403.
  (Server Actions của Next 16 đã tự chống origin; phần này bù cho route handler.)
- **Rate-limit fail-closed cho auth:** thêm chính sách per-scope trong `checkRateLimit` —
  scope `login`/`register`/`passwordReset` khi Upstash lỗi → **từ chối** (fail-closed);
  scope `ai`/`mutation` giữ **fail-open** (ưu tiên uptime). Cập nhật `rate-config.ts` thêm
  `passwordReset` + cờ `failClosed`.
- **Anti-enumeration:** reset trả thông báo chung (đã nêu); xác nhận login trả lỗi chung
  (NextAuth mặc định đã chung — kiểm & giữ).
- **Siết CSP** (`lib/security/csp.ts`): thu hẹp `connect-src` từ `https:` → allowlist
  (`'self'` + host Sentry ingest lấy từ `NEXT_PUBLIC_SENTRY_DSN`). Neon/Upstash/Gemini/Resend
  là server-to-server nên trình duyệt không cần. **Rủi ro:** dễ vỡ Sentry → cần kiểm tay kỹ;
  nếu DSN rỗng thì giữ nguyên hành vi cũ an toàn.

## 5. Audit log

- Ghi tại: `login.success`, `login.failure`, `register`, `email.verify`,
  `password.reset.request`, `password.reset`, `role.change` (admin), `user.delete` (admin).
- Trang **`/admin/audit`** (ADMIN-only qua route-rules sẵn có): bảng read-only, phân trang,
  lọc theo `action` và/hoặc `userId`. Tái dùng layout & UI admin hiện có.

## 6. Env & cấu hình

- Không thêm env **bắt buộc**. `RESEND_API_KEY` + `EMAIL_FROM` đã dùng cho email hiện có;
  thiếu → `sendEmail` bỏ qua êm (phù hợp chế độ mềm ở dev/local, verification không gửi nhưng
  không chặn login).
- Link trong email dùng `APP_URL` sẵn có.
- Cập nhật `.env.example` ghi chú các biến liên quan.

## 7. Kiểm thử

- Unit test (vitest, fake deps) cho: `tokens`, `email-verification`, `password-reset`,
  `audit/log`, `security/origin`, chính sách fail-closed trong `ratelimit`.
- Cập nhật test cũ nếu chữ ký/hành vi đổi (register nay tạo token + gửi mail).
- Toàn bộ suite phải xanh + `npx tsc --noEmit` 0 lỗi + `npm run build` PASS.

## 8. Việc người dùng phải tự làm (ngoài code)

- Chạy `npm run db:push` ở production để áp schema mới.
- (Tùy chọn) cấu hình `RESEND_API_KEY` + `EMAIL_FROM` để email chạy thật.
- Kiểm tay: luồng đăng ký→nhận mail xác minh→verify; quên mật khẩu→reset; banner nhắc; trang
  `/admin/audit`; xác nhận Sentry vẫn báo lỗi sau khi siết CSP.
