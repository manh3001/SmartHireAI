# Vòng 4 — Đăng nhập Google (OAuth) & Dark mode

**Ngày:** 2026-09-01
**Tính năng:** OAuth Google login · Dark mode (light/dark/system)
**Trạng thái:** Approved, chờ implementation plan

---

## 1. Bối cảnh

Vòng 4 bổ sung 2 tính năng nền tảng đã hoãn từ trước:

1. **Đăng nhập Google (OAuth)** — thêm nút "Đăng nhập với Google" ở `/login` và `/register`; tự động liên kết theo email với tài khoản hiện có
2. **Dark mode** — toggle light/dark/system trên Navbar; CSS `.dark` đã có sẵn trong `globals.css`

**Trạng thái hiện tại (khảo sát codebase):**
- `auth.ts` — NextAuth v5, `session: { strategy: "jwt" }`, chỉ có `Credentials` provider, **không có DB adapter**
- `User.passwordHash` hiện là `String` (bắt buộc)
- `globals.css` — đã định nghĩa đầy đủ biến `:root` (light) và `.dark`, có `@custom-variant dark (&:is(.dark *))`; **chưa có** cơ chế gắn class `.dark` lên `<html>`
- `app/layout.tsx` — `<html lang="vi" className="...">`, chưa có ThemeProvider, chưa `suppressHydrationWarning`

**Hai tính năng độc lập** — có thể làm song song, nhưng nằm chung 1 spec/plan vì đều là "nền tảng" quy mô vừa.

---

## 2. Phần 1 — Đăng nhập Google (OAuth)

### 2.1 Quyết định thiết kế

- **Liên kết tài khoản:** tự động theo email. Cùng email → cùng tài khoản. An toàn vì Google đã xác thực email.
- **Session:** giữ nguyên JWT, **không** thêm DB adapter, **không** thêm bảng `Account`/`Session`.
- **Tạo/liên kết User:** xử lý thủ công trong `signIn` callback (upsert theo email).

### 2.2 Schema Changes (prisma db push)

```prisma
model User {
  // ...
  passwordHash String?   // đổi từ String → String? (user chỉ-Google không có mật khẩu)
  // ...
}
```

Không thêm model mới.

### 2.3 Luồng đăng nhập Google

1. User bấm "Đăng nhập với Google" ở `/login` hoặc `/register` → gọi `signIn("google")`
2. `signIn` callback nhận `profile` từ Google (email đã xác thực + name)
3. Resolve User theo email:
   - **Đã tồn tại** → đăng nhập vào tài khoản đó, **giữ nguyên role cũ**
   - **Chưa có** → tạo User mới: `role = CANDIDATE`, `passwordHash = null`, `name` từ Google (fallback email nếu trống)
4. `jwt` callback gắn `token.id` + `token.role`; `session` callback map sang `session.user` (như hiện tại)

### 2.4 Hàm thuần (testable)

```typescript
// lib/auth/oauth.ts
export type OAuthUser = { id: string; role: "CANDIDATE" | "RECRUITER" | "ADMIN" };
export type ResolveOAuthDeps = {
  findByEmail: (email: string) => Promise<OAuthUser | null>;
  createUser: (email: string, name: string) => Promise<OAuthUser>;
};
export async function resolveOAuthUser(
  email: string,
  name: string,
  deps: ResolveOAuthDeps,
): Promise<OAuthUser>;
// - findByEmail có → trả về (liên kết)
// - không có → createUser (role CANDIDATE)
```

### 2.5 Xử lý biên

| Tình huống | Xử lý |
|---|---|
| Password-login vào tài khoản chỉ-Google (`passwordHash = null`) | `Credentials.authorize` trả `null` (từ chối) |
| Google login cho email đã có mật khẩu | Liên kết, đăng nhập, giữ role cũ |
| Recruiter/Admin muốn dùng Google | Google login luôn tạo role CANDIDATE → NTD phải đăng ký bằng form mật khẩu. UI ghi rõ: nút Google nằm cạnh ghi chú "dành cho ứng viên" hoặc chỉ ở luồng ứng viên |
| Google không trả email | `signIn` callback trả `false` (chặn đăng nhập) |

### 2.6 UI

- `/login`: thêm nút "Đăng nhập với Google" (icon Google + divider "hoặc") phía trên/dưới form mật khẩu
- `/register`: thêm nút tương tự
- Nút là client component gọi `signIn("google", { redirectTo: "/dashboard" })`

### 2.7 Prerequisite (người dùng cấu hình)

- Tạo OAuth 2.0 Client ở Google Cloud Console
- Điền vào `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (dev) + domain production
- Cập nhật `.env.example` với 2 biến mới

### 2.8 Test (Phần 1)

- `resolveOAuthUser`: nhánh liên kết (findByEmail có) vs tạo mới (findByEmail null → createUser gọi đúng args, role CANDIDATE)
- `Credentials.authorize`: từ chối khi `passwordHash = null` (không cho password-login vào tài khoản Google)

---

## 3. Phần 2 — Dark mode

### 3.1 Quyết định thiết kế

- Dùng thư viện `next-themes` (chuẩn, tự chống FOUC)
- 3 chế độ: `light` / `dark` / `system`, mặc định `system`
- Persist bằng localStorage (next-themes lo), **không** lưu vào DB
- Toggle hiện cho **mọi người** (kể cả chưa đăng nhập)

### 3.2 Thành phần

- **`components/ThemeProvider.tsx`** — client wrapper quanh `next-themes` `ThemeProvider`, cấu hình `attribute="class"`, `defaultTheme="system"`, `enableSystem`
- **`app/layout.tsx`** — bọc `{children}` bằng `<ThemeProvider>`; thêm `suppressHydrationWarning` vào `<html>`
- **`components/ThemeToggle.tsx`** — client component, nút icon (Sun/Moon), dùng `useTheme()`; dropdown 3 lựa chọn light/dark/system. Tránh hydration mismatch bằng cách chỉ render sau khi `mounted`
- **`components/Navbar.tsx`** — chèn `<ThemeToggle />` (cả desktop lẫn mobile)

### 3.3 Chống nháy (FOUC)

`next-themes` tự chèn inline script chạy trước hydration → gắn class `.dark` ngay khi tải, không nháy nền trắng ở dark mode. `suppressHydrationWarning` trên `<html>` là bắt buộc để tránh warning do server/client khác class.

### 3.4 Rà soát màu hardcoded

Rà các màu cứng gãy ở dark mode và đổi sang token dark-aware **chỉ nơi ảnh hưởng rõ** (không refactor tràn lan):
- `components/Navbar.tsx`: badge thông báo `bg-red-500 text-white` → cân nhắc `bg-destructive text-destructive-foreground` (kiểm tra tương phản)
- Rà quét các trang chính (landing, dashboard, jobs, login/register) ở dark mode, sửa chỗ chữ/nền không đọc được

### 3.5 Test (Phần 2)

- Dark mode là tích hợp UI + visual; **không viết unit test giả** cho toggle (phụ thuộc DOM/localStorage/next-themes)
- Kiểm thủ công: bật dark → reload không nháy → chuyển trang giữ theme → toggle 3 chế độ hoạt động

---

## 4. Phạm vi không làm (YAGNI)

**OAuth:**
- Không thêm provider khác (GitHub, Facebook) — chỉ Google
- Không "đặt mật khẩu sau" cho user chỉ-Google (họ dùng Google để đăng nhập)
- Không bảng Account/Session (JWT đủ)

**Dark mode:**
- Không theme tùy chỉnh màu (chỉ light/dark/system)
- Không lưu theme theo user vào DB (localStorage đủ)
- Không dark mode cho PDF export (PDF luôn nền trắng để in)

---

## 5. Thứ tự triển khai đề xuất

1. Schema: `passwordHash` optional
2. OAuth: hàm thuần `resolveOAuthUser` + test
3. OAuth: cập nhật `auth.ts` (Google provider + signIn callback + authorize từ chối null-password)
4. OAuth: UI nút Google ở `/login` + `/register`; cập nhật `.env.example`
5. Dark mode: `next-themes` + ThemeProvider + layout
6. Dark mode: ThemeToggle + gắn Navbar + rà màu hardcoded
