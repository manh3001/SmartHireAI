# 2FA/TOTP — Xác thực 2 lớp (Design)

- **Ngày:** 2026-09-18
- **Trạng thái:** Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh:** Vòng bảo mật thứ 3, nối tiếp [[security-deep-round1]] + [[security-deep-round2]]
  (đã merge main). Nền auth: NextAuth v5 **credentials + JWT, không adapter**; đã có `AuditLog`
  + `recordAudit`, `requireUser`, rate-limit (scope `login`…), reset mật khẩu, thu hồi phiên
  (`tokenVersion`), trang `/settings/security`. Vòng này thêm **2FA/TOTP** (opt-in per-user).

## Mục tiêu & phạm vi

Thêm xác thực 2 lớp bằng ứng dụng authenticator (TOTP): kích hoạt (QR + xác nhận), đăng nhập
2 bước, mã dự phòng dùng-một-lần, tắt & tạo lại mã. Tất cả tự phục vụ tại `/settings/security`.

**Ngoài phạm vi:** 2FA bắt buộc theo chính sách/admin; SMS/email OTP; WebAuthn/passkey; buộc thu
hồi mọi phiên khi bật/tắt 2FA (có thể thêm sau, tái dùng `tokenVersion`).

## Quyết định đã chốt
- **Dependency:** thêm `qrcode` (render QR server-side). TOTP tự viết bằng `node:crypto` (không lib).
- **Login UX:** 2 bước — ô nhập mã chỉ hiện SAU khi mật khẩu đúng và tài khoản đã bật 2FA.
- **Secret at-rest:** mã hoá AES-256-GCM, khoá dẫn xuất từ `AUTH_SECRET` (không thêm env bắt buộc).

## 1. Mô hình dữ liệu (Prisma)

Thêm vào `User`:
- `totpSecret String?` — secret TOTP đã **mã hoá** (không lưu plaintext).
- `totpEnabled Boolean @default(false)`.
- Quan hệ `backupCodes TwoFactorBackupCode[]`.

Bảng mới:
```prisma
model TwoFactorBackupCode {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash  String   @unique   // SHA-256 hex của mã gốc
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([userId])
}
```
Áp bằng `npm run db:push` (local + production).

## 2. TOTP thuần — `lib/auth/totp.ts` (node:crypto)

- `generateSecret(): string` — 20 byte ngẫu nhiên, encode **base32** (RFC 4648, không padding).
- `base32Encode(buf: Buffer): string` / `base32Decode(s: string): Buffer` — helpers thuần.
- `totpUri(input: { secret: string; email: string; issuer?: string }): string` — chuỗi
  `otpauth://totp/<issuer>:<email>?secret=...&issuer=...&algorithm=SHA1&digits=6&period=30`.
- `generateTotp(secret: string, forTime?: number): string` — mã 6 số HMAC-SHA1, bước 30s
  (RFC 6238) — dùng cho test/nội bộ.
- `verifyTotp(secret: string, code: string, opts?: { now?: number; window?: number }): boolean`
  — so mã với cửa sổ ±`window` bước (mặc định 1 = ±30s), so sánh an toàn thời gian.
- Test bằng **vector chuẩn RFC 6238** (secret "12345678901234567890" → mã tại các mốc thời gian
  đã biết) + roundtrip base32.

## 3. Mã hoá secret — `lib/auth/totp-crypto.ts`

- Khoá 32 byte dẫn xuất từ `process.env.AUTH_SECRET` bằng `scryptSync(AUTH_SECRET, salt, 32)`
  (salt cố định trong module — mục tiêu là mã hoá at-rest, không phải chống brute-force khoá).
- `encryptSecret(plain: string): string` — AES-256-GCM, trả `iv:tag:ciphertext` (base64/hex).
- `decryptSecret(enc: string): string`.
- Test: roundtrip `decryptSecret(encryptSecret(x)) === x`; hai lần mã hoá cùng input ra khác nhau
  (IV ngẫu nhiên).

## 4. Mã dự phòng — `lib/auth/backup-codes.ts` (thuần)

- `generateBackupCodes(n = 10): { plain: string[]; hashes: string[] }` — mã dạng `xxxxx-xxxxx`
  (chữ+số, dễ đọc), `hash = SHA-256(plain)` (dùng `hashToken` sẵn có từ Vòng 1 nếu phù hợp,
  hoặc SHA-256 trực tiếp).
- `hashBackupCode(plain: string): string`.
- Wiring tiêu thụ: khi dùng, tra `codeHash`, kiểm `usedAt == null`, đánh dấu `usedAt` (atomic
  `updateMany({ codeHash, usedAt: null })`, chỉ chấp nhận khi `count === 1`).

## 5. Kích hoạt 2FA (server actions — `lib/auth/twofactor-actions.ts`)

- `beginTotpEnrollment()`: `requireUser`; nếu đã `totpEnabled` → trả lỗi "đã bật". Sinh secret →
  lưu **encryptSecret** vào `user.totpSecret`, `totpEnabled=false`. Trả `{ qrDataUrl, secretBase32 }`
  (QR từ `qrcode.toDataURL(totpUri(...))`).
- `confirmTotpEnrollment(code)`: `requireUser`; decrypt secret đang lưu; `verifyTotp` → nếu sai
  trả lỗi; nếu đúng → `totpEnabled=true`, sinh 10 backup codes (xoá codes cũ nếu có, tạo mới),
  audit `2fa.enable`. Trả `{ backupCodes: string[] }` (hiện **một lần**).
- Rate-limit `confirmTotpEnrollment` (scope `login`) chống dò mã.

## 6. Đăng nhập 2 bước

- **Pre-check** (`verifyPasswordStep(email, password)` server action): rate-limit scope `login`;
  verify mật khẩu (tái dùng `resolveCredentials`); trả `"invalid" | "ok" | "needs2fa"`
  (`needs2fa` khi mật khẩu đúng và `totpEnabled`). KHÔNG tạo phiên.
- **Client** (`/login`): submit email+mật khẩu → gọi `verifyPasswordStep`:
  - `invalid` → báo lỗi chung.
  - `ok` → gọi `signIn("credentials", { email, password })`.
  - `needs2fa` → hiện ô mã → user nhập → gọi `signIn("credentials", { email, password, code })`.
- **`authorize` (auth.ts)** nhận thêm `code`; sau khi verify mật khẩu, nếu `totpEnabled`:
  **bắt buộc** `code` hợp lệ = TOTP hợp lệ **hoặc** backup code chưa dùng (tiêu thụ nếu dùng).
  Thiếu/sai → `return null`. Đây là chốt chặn thật (defense-in-depth, kể cả client bỏ pre-check).
  Logic quyết định tách thuần: `resolveTwoFactor({ totpEnabled, secret, code, ... }, deps)` để test.
- Audit: login.success/failure giữ như cũ; (tuỳ chọn) `2fa.backup_used` khi dùng mã dự phòng.

## 7. Tắt & tạo lại mã dự phòng

- `disableTwoFactor(code)`: `requireUser`; yêu cầu TOTP/backup hợp lệ → `totpSecret=null`,
  `totpEnabled=false`, xoá mọi backup code, audit `2fa.disable`.
- `regenerateBackupCodes(code)`: `requireUser`; yêu cầu mã hợp lệ → xoá + tạo 10 mã mới, trả bản
  mới (hiện một lần).

## 8. UI `/settings/security`

Mở rộng trang Vòng 2. Thêm khối **"Xác thực 2 lớp (2FA)"**:
- Chưa bật → nút "Bật 2FA" → wizard: hiện QR + khoá nhập tay → ô nhập mã xác nhận → khi thành công
  hiện danh sách mã dự phòng (nhắc lưu lại).
- Đã bật → trạng thái "Đang bật", số mã dự phòng còn lại, nút "Tạo lại mã dự phòng", nút "Tắt 2FA"
  (đều mở dialog nhập mã xác nhận).
- Client components cho wizard/dialog; toast (sonner) cho phản hồi. Copy tiếng Việt.

## 9. Audit & hằng số

Thêm `AUDIT_ACTIONS`: `twoFactorEnable = "2fa.enable"`, `twoFactorDisable = "2fa.disable"`
(+ tuỳ chọn `twoFactorBackupUsed = "2fa.backup_used"`).

## 10. Kiểm thử

- Thuần (vitest): `totp` (RFC 6238 vectors, base32 roundtrip, verifyTotp window/sai/hết-hạn);
  `totp-crypto` (roundtrip, IV khác nhau); `backup-codes` (sinh n mã, hash khớp, format);
  `resolveTwoFactor` (totpEnabled off → bỏ qua; TOTP đúng/sai; backup đúng/đã-dùng); enroll/confirm/
  disable với fake deps; `verifyPasswordStep` (invalid/ok/needs2fa).
- Kết thúc: `npx tsc --noEmit` 0, `npm run lint` 0 error, `npm test` xanh, `npm run build` PASS.

## 11. Việc người dùng phải tự làm
- `npm install` (dependency `qrcode` mới) — hoặc plan sẽ thêm vào package.json.
- `npm run db:push` production (`totpSecret`, `totpEnabled`, bảng `TwoFactorBackupCode`).
- Kiểm tay: bật 2FA (quét QR bằng Google Authenticator/Authy) → đăng xuất → đăng nhập nhập mã →
  thử một mã dự phòng → tạo lại mã → tắt 2FA.

## Để dành vòng sau
2FA bắt buộc theo policy · WebAuthn/passkey · thu hồi mọi phiên khi bật/tắt 2FA · "nhớ thiết bị này 30 ngày".
