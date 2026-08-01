# Phase 14 — Admin (vai trò quản trị + dashboard toàn sàn)

Ngày: 2026-08-01

Phase đầu trong nhóm Dashboard. Thứ tự đã chốt: **Admin (phase 14) → Dashboard theo
vai (phase 15)**. Mỗi phase một spec → plan → build riêng.

## Mục tiêu

Thêm vai trò `ADMIN` cho nền tảng: một trang quản trị `/admin` chỉ admin truy cập
được, gồm (1) dashboard thống kê toàn hệ thống và (2) quản lý cơ bản user & JD
(xoá, gỡ công khai). Admin được cấp quyền qua script theo email, KHÔNG cho tự đăng
ký (bảo mật).

Quyết định phạm vi (đã chốt với người dùng):
- Vai Admin: **xem thống kê + quản lý cơ bản** (xoá user, xoá/gỡ-công-khai JD).
- Tạo admin: **script cấp quyền theo email** (không seed từ env).
- Số liệu: cả 4 nhóm — đếm tổng quan, phân bố đơn theo trạng thái, hoạt động AI,
  phân bố lương JD.

## 1. Hạ tầng vai trò ADMIN + tài khoản admin

- **Prisma:** thêm `ADMIN` vào `enum Role` (`prisma/schema.prisma`). Áp bằng
  `npm run db:push`.
- **Lan toả kiểu role:**
  - `types/next-auth.d.ts`: `role: "CANDIDATE" | "RECRUITER" | "ADMIN"`.
  - `auth.ts`: cùng union trong callbacks `jwt`/`session` (fallback vẫn
    `"CANDIDATE"`).
  - `lib/auth/register.ts` `RegisterDeps.role` và `registerSchema` **giữ nguyên**
    (chỉ CANDIDATE/RECRUITER) → không ai tự đăng ký thành admin.
- **Script cấp quyền:** `scripts/make-admin.ts`, chạy `npm run make-admin -- <email>`.
  - Tìm user theo email; không thấy → in lỗi + exit code ≠ 0.
  - Đặt `role = "ADMIN"` (idempotent — chạy lại vẫn ADMIN).
  - Chạy bằng `node scripts/make-admin.ts <email>` — Node 24 (repo đang dùng
    v24.11.1) strip types `.ts` natively, KHÔNG cần thêm `tsx`. Script `package.json`:
    `"make-admin": "cross-env NODE_OPTIONS=--dns-result-order=ipv4first node scripts/make-admin.ts"`
    (tránh P1001 Neon IPv4).
  - Script tự khởi tạo `new PrismaClient()` từ `@prisma/client` (import trực tiếp,
    tránh phụ thuộc alias `@/` mà Node không resolve), và đọc email từ
    `process.argv[2]`.
- **Bảo vệ route:** `lib/admin/guard.ts` export `requireAdmin()` — đọc `auth()`,
  nếu `role !== "ADMIN"` thì `redirect("/dashboard")` (chưa đăng nhập →
  `redirect("/login")`). Dùng ở `app/admin/layout.tsx`; mọi server action quản trị
  cũng gọi guard.
  - Để test được không cần Next runtime: tách phần **quyết định** thuần
    `adminAccess(session): "ok" | "login" | "forbidden"` trong `guard.ts`, còn
    `requireAdmin()` chỉ ánh xạ kết quả sang `redirect(...)`.
- **Navbar:** hiện link "Quản trị" (`/admin`) chỉ khi `session.user.role ===
  "ADMIN"`.

## 2. Dashboard thống kê toàn sàn (`/admin`)

Trang server component (`app/admin/page.tsx`) đọc số liệu qua lớp tách bạch:

- **`lib/admin/stats.ts`** — `getAdminStats()` chạy các truy vấn Prisma
  (`count` / `groupBy` / `aggregate`) song song bằng `Promise.all`, trả về object
  số liệu đã định hình.
- **`lib/admin/stats-shape.ts`** — các hàm THUẦN (không DB) để định hình/tính toán,
  unit-test được:
  - `shapeStatusDistribution(groups)`: từ kết quả `groupBy status` → mảng đúng 7
    trạng thái theo thứ tự vòng đời (SUBMITTED, SCREENING, INTERVIEW, OFFER, HIRED,
    REJECTED, WITHDRAWN), kèm nhãn tiếng Việt + count (trạng thái vắng mặt = 0).
  - `shapeRoleCounts(groups)`: từ `groupBy role` → {candidates, recruiters, admins,
    total}.
  - `summarizeSalaries(list)`: từ danh sách `{salaryMin, salaryMax}` → {count (JD có
    ít nhất một đầu lương), avgMidpoint, min, max}; bỏ JD không lương; JD chỉ có một
    đầu thì trung điểm = chính đầu đó.
- **4 nhóm số liệu hiển thị:**
  1. **Đếm tổng quan:** user (tách vai qua `groupBy role`), CV, JD (tổng +
     `isPublic`), công ty (`companyProfile.count`), đơn (`application.count`) →
     dải stat cards.
  2. **Phân bố đơn theo trạng thái:** `application.groupBy({ by: ["status"],
     _count })` → `shapeStatusDistribution` → thanh bar Tailwind.
  3. **Hoạt động AI:** `evaluation.aggregate({ _count, _avg: { overallScore } })` +
     `screening.count()` → số lượt + điểm trung bình (làm tròn).
  4. **Phân bố lương JD:** lấy `jobDescription.findMany({ select: { salaryMin,
     salaryMax } })` → `summarizeSalaries` → hiển thị số JD có lương, lương trung
     bình (triệu, dùng `formatSalary`/`toMillions` của phase 13 nếu tiện), khoảng
     thấp–cao nhất.
- Hiển thị bằng `Card`/stat cards + bar thủ công (Tailwind). **Không thêm thư viện
  chart** (YAGNI).

## 3. Quản lý user & JD

- **`app/admin/users/page.tsx`** — bảng mọi user: email, tên, vai, ngày tạo, số
  CV/JD/đơn (`_count`). Hành động **Xoá user** qua server action
  `deleteUserAsAdmin(id)`:
  - Gọi `requireAdmin()` trước.
  - **Chặn tự xoá chính mình**; **chặn xoá user có role ADMIN** (kể cả admin khác).
  - Xoá cascade dữ liệu liên quan (schema đã có `onDelete: Cascade`).
  - UI có xác nhận trước khi xoá.
- **`app/admin/jobs/page.tsx`** — bảng mọi JD: tiêu đề, công ty, chủ sở hữu (email),
  `isPublic`, ngày tạo. Hành động:
  - **Toggle công khai** `setJobPublicAsAdmin(id, isPublic)`.
  - **Xoá JD** `deleteJobAsAdmin(id)`.
- Chỉ **xem + xoá + toggle công khai**, KHÔNG sửa nội dung (YAGNI).
- Tất cả action trong `lib/admin/actions.ts`; mỗi hàm gọi `requireAdmin()` đầu tiên,
  `revalidatePath` trang tương ứng.
  - Logic chặn (self/admin) tách thành hàm thuần `canDeleteUser(actorId,
    target)` để test không cần Prisma.

## 4. Test (TDD, theo pattern repo)

- `lib/admin/__tests__/stats-shape.test.ts`:
  - `shapeStatusDistribution`: đủ 7 trạng thái đúng thứ tự; trạng thái vắng = 0;
    tổng đúng.
  - `shapeRoleCounts`: đếm đúng theo vai + total.
  - `summarizeSalaries`: bỏ JD không lương; trung điểm min–max; một đầu; danh sách
    rỗng → count 0.
- `lib/admin/__tests__/guard.test.ts`:
  - `adminAccess`: null session → "login"; role CANDIDATE/RECRUITER → "forbidden";
    ADMIN → "ok".
- `lib/admin/__tests__/actions.test.ts`:
  - `canDeleteUser`: chặn tự xoá; chặn xoá ADMIN; cho xoá CANDIDATE/RECRUITER khác.
- Không viết test render trang (theo pattern hiện tại).

## Ngoài phạm vi (YAGNI)

- Seed admin từ env; nhiều admin qua UI.
- Sửa nội dung user/JD trong admin; phân trang/tìm kiếm nâng cao trong bảng quản lý.
- Thư viện biểu đồ.
- Dashboard theo vai (NTD/ứng viên) — thuộc phase 15.

## Ghi chú kỹ thuật

- Prisma pinned v6; `NODE_OPTIONS=--dns-result-order=ipv4first` cho mọi lệnh DB.
- Guard/stats/actions tách phần thuần để test không cần Next/Prisma runtime, theo
  đúng kiểu dependency-injection của `registerUser`/`apply` sẵn có.
