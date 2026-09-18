# Bảo mật sâu — Vòng 2 (Design)

- **Ngày:** 2026-09-18
- **Trạng thái:** Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh:** Nối tiếp Vòng 1 (`docs/superpowers/specs/2026-09-17-security-deep-round1-design.md`,
  đã merge main `d199e77`). Nền auth: NextAuth v5 **JWT, không adapter**; đã có `AuditLog` +
  `recordAudit`, guard `requireUser`/`requireRole`, rate-limit + fail-closed cho auth,
  reset mật khẩu (`lib/auth/reset-actions.ts` + `confirmReset`). Vòng này đào sâu bảo mật
  **phiên đăng nhập** + lịch sử đăng nhập + gia cố còn nợ.

## Mục tiêu & phạm vi

Vòng 2 gồm 3 hạng mục (2FA/TOTP để dành vòng riêng):
- **B — Quản lý & thu hồi phiên:** đăng xuất mọi thiết bị; tự thu hồi phiên khi reset mật khẩu.
- **C — Lịch sử đăng nhập:** trang cho user xem các lần đăng nhập gần đây.
- **D — Gia cố còn nợ:** `getClientIp` an toàn/validated/configurable; ghi audit login bị rate-limit.

**Ngoài phạm vi (vòng sau):** 2FA/TOTP; liệt kê & thu hồi TỪNG phiên/thiết bị riêng lẻ (cần
session store thay vì JWT thuần).

## Quyết định kiến trúc: thu hồi phiên với JWT

Chọn **`tokenVersion` (Int) trên `User` + kiểm mỗi request** (đã duyệt). Đăng nhập nhúng
`tokenVersion` vào JWT; callback `jwt` so với DB mỗi request, lệch → vô hiệu phiên. Tăng
version → thu hồi tức thì trên mọi thiết bị. (Loại phương án `sessionsValidFrom`+`iat` vì phụ
thuộc `iat` ổn định; loại phương án "session ngắn hạn không kiểm mỗi request" vì thu hồi không
tức thì, phá mục đích.)

## 1. Mô hình dữ liệu (Prisma)

Thêm vào `User`:
- `tokenVersion Int @default(0)`

Không bảng mới. C tái dùng `AuditLog`. Áp bằng `npm run db:push` (local + production).

## 2. B — Quản lý & thu hồi phiên

### Logic thuần (test được)
- `lib/auth/token-version.ts`
  - `type TokenVersionCheck = "valid" | "revoked" | "deleted"`
  - `checkTokenVersion(input: { tokenVersion: number | undefined; dbVersion: number | null }): TokenVersionCheck`
    - `dbVersion === null` (user không còn) → `"deleted"`.
    - `tokenVersion` đã set (number) và `!== dbVersion` → `"revoked"`.
    - còn lại → `"valid"` (đăng nhập lần đầu khi `tokenVersion` chưa set, hoặc khớp).

### Wiring auth.ts (callback `jwt`)
Sau khi thiết lập `token.id` (các nhánh sign-in credentials/OAuth hiện có), thêm:
- Truy vấn `prisma.user.findUnique({ where: { id: token.id }, select: { tokenVersion: true } })`.
- `checkTokenVersion({ tokenVersion: token.tokenVersion, dbVersion: dbUser?.tokenVersion ?? null })`:
  - `"deleted"` hoặc `"revoked"` → `return null` (Auth.js v5: trả `null` từ `jwt` callback ⇒ hủy phiên).
  - `"valid"` → `token.tokenVersion = dbUser.tokenVersion` (set khi đăng nhập lần đầu / làm mới).
- Chi phí: 1 `findUnique` có index (PK) mỗi request đã đăng nhập — chấp nhận.
- `session` callback: (tùy chọn) không cần expose `tokenVersion` ra client.

### Hành động tăng version
- `lib/auth/session-actions.ts` — server action `revokeAllSessions()`:
  - `requireUser` → `prisma.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } })`
    → `recordAudit(session.revoke_all, userId)` → `signOut({ redirectTo: "/login" })`.
  - Logic thuần tối thiểu (chủ yếu wiring); test phần audit/increment qua fake deps nếu tách được,
    còn lại dựa build/tsc.
- **Reset mật khẩu:** trong `applyReset` (`lib/auth/reset-actions.ts`, Vòng 1) thêm
  `tokenVersion: { increment: 1 }` vào lệnh `tx.user.update(... { passwordHash })` — cùng
  transaction đã có → reset xong tự thu hồi mọi phiên cũ.

### Hằng audit mới
`AUDIT_ACTIONS.sessionRevokeAll = "session.revoke_all"` (thêm vào `lib/audit/log.ts`).

## 3. C — Lịch sử đăng nhập

Tái dùng `AuditLog`. Trên `/settings/security`, server component query:
`prisma.auditLog.findMany({ where: { userId, action: "login.success" }, orderBy: { createdAt: "desc" }, take: 10, select: { id, ip, createdAt } })`
→ bảng "Đăng nhập gần đây" (thời gian định dạng vi-VN + IP, `—` nếu thiếu).

Ghi chú: login **thất bại** lưu `userId = null` (Vòng 1, chống enumeration) nên không gắn được
vào user → chỉ hiển thị lần đăng nhập **thành công**. Đây là chủ đích.

## 4. D — Gia cố còn nợ

### D1 — `getClientIp` an toàn hơn (`lib/security/ip.ts`)
- Đọc IP từ header cấu hình được: `process.env.CLIENT_IP_HEADER` (mặc định `x-forwarded-for`).
- Với `x-forwarded-for`: lấy entry ĐẦU (client gốc), `trim`.
- **Validate** kết quả đúng dạng IPv4 hoặc IPv6; không hợp lệ → `"unknown"`.
- Fallback `x-real-ip` như cũ nếu header chính vắng.
- Tách hàm thuần `isValidIp(s: string): boolean` (IPv4 + IPv6 rút gọn) để test.
- **Mô hình tin cậy (ghi trong comment + .env.example):** XFF chỉ đáng tin khi có proxy làm
  sạch header (Vercel ghi đè giá trị client gửi lên → đáng tin). Deploy tự host KHÔNG có proxy
  làm sạch: kẻ tấn công spoof được → trỏ `CLIENT_IP_HEADER` sang header chỉ proxy của bạn đặt.
- Giữ chữ ký `getClientIp(req: Request | undefined): string` (không phá call site hiện có).

### D2 — Audit login bị rate-limit (`auth.ts`)
Trong `authorize`, nhánh `if (!ok) return null` (bị rate-limit) thêm:
`recordAudit({ action: AUDIT_ACTIONS.loginFailure, userId: null, ip, metadata: { email, reason: "rate_limited" } }, { save: ... })`
→ brute-force bị chặn vẫn để lại vết. (Dùng cùng safe-mapping metadata như Vòng 1.)

## 5. Trang `/settings/security`

Trang mới, server component (khu settings chưa có layout chung → trang độc lập, style khớp
`app/settings/profile/page.tsx`):
- Khối **Đăng nhập gần đây** — bảng từ C.
- Khối **Phiên đăng nhập** — nút "Đăng xuất khỏi mọi thiết bị" (client component gọi
  `revokeAllSessions`), có **Dialog xác nhận** tái dùng `components/ui/dialog`.
- Thêm link "Bảo mật" vào dropdown Navbar (cạnh "Đăng xuất") để truy cập trang.

## 6. Kiểm thử
- Unit (vitest, fake deps / thuần): `checkTokenVersion` (valid/revoked/deleted), `isValidIp` +
  `getClientIp` (chọn header, lấy entry đầu, validate, fallback, unknown).
- Cập nhật test cũ nếu hành vi đổi: `getClientIp` (kiểm test hiện có ở `lib/security/__tests__/ip.test.ts`
  vẫn xanh hoặc cập nhật kỳ vọng); `reset-actions`/`applyReset` transaction thêm `tokenVersion`.
- auth.ts jwt-callback + `revokeAllSessions` chủ yếu kiểm qua `tsc` + `build` (wiring).
- Kết thúc: `npx tsc --noEmit` 0 lỗi, `npm test` xanh, `npm run build` PASS.

## 7. Việc người dùng phải tự làm
- `npm run db:push` ở production (thêm cột `tokenVersion`).
- (Tùy chọn) `CLIENT_IP_HEADER` nếu tự host không phải Vercel.
- Kiểm tay: mở 2 trình duyệt → "đăng xuất mọi thiết bị" đá cả hai; reset mật khẩu → phiên cũ bị
  đăng xuất; trang `/settings/security` hiển thị lịch sử đăng nhập.

## Để dành vòng sau
2FA/TOTP · liệt kê & thu hồi từng phiên/thiết bị riêng lẻ (cần session store) · gắn login thất
bại vào user để hiện trong lịch sử (cân nhắc, đánh đổi với anti-enumeration nội bộ).
