# Dọn nợ type-safety truy cập session (Design)

- **Ngày:** 2026-09-18
- **Trạng thái:** Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh:** Qua nhiều vòng, các reviewer liên tục nêu pattern `session.user!.id as string` là "latent
  defect"/nhiễu dư thừa. `types/next-auth.d.ts` ĐÃ khai báo `Session.user.id: string` (non-optional),
  nên `session.user.id` vốn có kiểu `string` — các `!` và `as string` là DƯ THỪA. Vòng này là refactor
  chất lượng: củng cố guard `lib/auth/session.ts` + quét bỏ assertion dư thừa toàn repo.

## Mục tiêu & phạm vi

- Vá khoảng trống type↔runtime trong guard session (đảm bảo `user.id` tồn tại ở runtime, khớp kiểu).
- Bỏ toàn bộ `session.user!.id as string` / `session.user!` dư thừa (10 chỗ `session.user!`, 8 chỗ
  `as string`) ở 6 file.
- Không đổi hành vi: 524 test hiện có phải giữ xanh.

**Ngoài phạm vi:** đổi kiến trúc session; codemod tự động; các nợ type khác (guard enum dư trong
`mapDraftToForm` — vô hại, giữ nguyên).

## 1. Củng cố guard — `lib/auth/session.ts`

- **`roleAccess`**: hiện `if (!session?.user) return "login"` — chỉ kiểm user tồn tại, KHÔNG kiểm
  `user.id`. Sửa thành kiểm cả `user.id`:
  `if (!session?.user?.id) return "login";` (giữ nguyên nhánh so role phía sau). Đây là thay đổi
  hành vi RẤT NHỎ, đúng hướng an toàn: một session có user nhưng thiếu id (không xảy ra trong thực
  tế vì jwt callback luôn set id) sẽ bị coi là chưa đăng nhập thay vì lọt qua.
- **Kiểu trả về tường minh:** thêm alias
  `type AuthedSession = Session & { user: { id: string } }` (hoặc tương đương thu hẹp `user.id`)
  và đặt làm kiểu trả về của `requireUser()` và `requireRole()` để tài liệu hoá cam kết "đã đăng
  nhập, có id". `requireUser` giữ nguyên kiểm `if (!session?.user?.id) redirect("/login")`.
- `getSessionUser` giữ nguyên.

## 2. Quét bỏ assertion dư thừa (6 file)

Ở các file sau, thay `session.user!.id as string` → `session.user.id` và `session.user!` →
`session.user` (mọi chỗ còn lại):
- `lib/admin/actions.ts`
- `lib/auth/session-actions.ts`
- `lib/auth/twofactor-actions.ts`
- `lib/jobs/ai-actions.ts`
- `lib/jobs/salary-suggest-actions.ts`
- `app/settings/security/page.tsx`

Vì kiểu vốn đã đúng (sau khi các guard trả `AuthedSession`), `tsc` phải vẫn xanh — bằng chứng
assertion là dư thừa. Nếu một chỗ nào đó tsc báo lỗi khi bỏ (do biến session không đến từ
requireUser/requireRole), giữ nguyên chỗ đó và ghi chú.

## 3. Kiểm thử & bằng chứng không đổi hành vi

Đây là refactor — không thêm hành vi mới:
- Cập nhật test `roleAccess` (`lib/auth/__tests__/session.test.ts` nếu có, hoặc thêm) với case mới:
  session có `user` nhưng thiếu `id` → `"login"`; case đủ id + đúng role → `"ok"`; sai role → `"forbidden"`;
  không user → `"login"`.
- Toàn bộ **524 test hiện có phải giữ xanh** (chứng minh không đổi hành vi).
- Kết thúc: `npx tsc --noEmit` 0, `npm run lint` 0 error, `npm test` xanh, `npm run build` PASS.

## 4. Việc người dùng phải tự làm
Không có (refactor thuần; không env/DB/UX thay đổi).

## Để dành vòng sau
Rà các assertion `!`/`as` dư thừa ở chỗ khác (ngoài truy cập session); thu hẹp kiểu trả về của
`getSessionUser`; e2e cho luồng mới.
