# Thiết kế Phase 5: Nhà tuyển dụng đăng JD (tối giản)

**Ngày:** 2026-07-29
**Tác giả:** Nguyễn Đức Mạnh
**Trạng thái:** Đã duyệt (chờ lập kế hoạch triển khai)
**Tiền đề:** Nối tiếp Phase 1–4. Tái dùng Phase 3 (đánh giá). Xem `2026-07-27-cv-ai-platform-design.md`.

## 1. Mục tiêu

Cho nhà tuyển dụng (NTD) đăng mô tả công việc (JD) công khai, và ứng viên duyệt các JD đó rồi để AI đánh giá độ phù hợp của CV mình với một JD đã đăng. Thể hiện ý tưởng kết nối hai bên ở mức tối giản.

## 2. Phạm vi

**Trong phạm vi:**
- Chọn vai trò **Ứng viên / Nhà tuyển dụng** khi đăng ký (dùng field `role` đã có).
- Dashboard nhận biết vai trò: NTD → quản lý JD; ứng viên → danh sách CV (như hiện tại).
- NTD: đăng JD công khai (tiêu đề, công ty, nội dung); xem danh sách JD của mình; xóa JD.
- Ứng viên: xem danh sách JD công khai (`/jobs`), xem chi tiết JD (`/jobs/[id]`), chọn một CV → đánh giá CV theo JD đó (dùng lại Phase 3).

**Ngoài phạm vi (YAGNI):**
- Sửa JD (chỉ xem + xóa).
- Ứng tuyển, lọc/tìm kiếm CV, marketplace đầy đủ.
- NTD xem CV ứng viên (chỉ demo chiều ứng viên đánh giá).
- Phân trang JD.

## 3. Mô hình dữ liệu (Prisma)

- Dùng lại model **`JobDescription`** đã có `{ id, userId, title, company, rawText, createdAt, evaluations }`.
- **Thêm** trường: `isPublic Boolean @default(false)`.
  - NTD đăng → `isPublic = true` → hiển thị ở `/jobs`.
  - JD ứng viên tự dán ở Phase 3 → giữ `false` (mặc định) → riêng tư, không đổi hành vi cũ.
- Enum `Role { CANDIDATE, RECRUITER }` đã có sẵn ở model `User`.

## 4. Đăng ký có vai trò

- `registerSchema` (Zod, `lib/auth/validation.ts`) thêm trường `role: "CANDIDATE" | "RECRUITER"` mặc định `"CANDIDATE"` — cập nhật theo TDD.
- `registerUser` (`lib/auth/register.ts`): `RegisterDeps.create` nhận thêm `role`; truyền vào khi tạo user — cập nhật test.
- API `/api/register`: `prisma.user.create` truyền `role`.
- Form đăng ký: thêm lựa chọn vai trò (radio/select), gửi kèm khi submit.

## 5. Luồng & kiến trúc

```
Đăng ký (chọn vai trò) ──► User.role = CANDIDATE | RECRUITER

NTD:
  Dashboard (role=RECRUITER) ──► danh sách JD của mình + nút "Đăng JD"
  /jobs/new ──► server action createJobDescription (isPublic=true)
  Dashboard ──► deleteJobDescription

Ứng viên:
  /jobs ──► danh sách JD công khai (isPublic=true, mọi NTD)
  /jobs/[id] ──► chi tiết JD + chọn CV của mình + "Đánh giá bằng AI"
             ──► POST /api/cv/[cvId]/evaluate (jdText = JD.rawText)  [tái dùng Phase 3]
             ──► chuyển tới /cv/[cvId]/evaluate xem kết quả (trong lịch sử)
```

- Server action tạo/xóa JD kiểm tra `role === RECRUITER` và quyền sở hữu.
- Ứng viên chỉ chọn CV của chính mình để đánh giá.

## 6. Server actions & API

- `createJobDescription(formData)` — chỉ NTD; tạo `JobDescription { userId, title, company, rawText, isPublic: true }`; `revalidatePath`.
- `deleteJobDescription(formData)` — chỉ chủ JD; `deleteMany({ id, userId })`.
- Đánh giá JD công khai: **tái dùng** API `/api/cv/[cvId]/evaluate` (Phase 3) — client ở `/jobs/[id]` gửi `jdText`, `jdTitle`, `jdCompany` lấy từ JD → sau khi 201, chuyển tới trang đánh giá của CV.

## 7. Xử lý lỗi & quyền

- Trang NTD (`/jobs/new`, quản lý JD) chặn nếu role != RECRUITER (redirect hoặc thông báo).
- Ứng viên không đăng được JD (server action từ chối nếu role != RECRUITER).
- Xóa JD: chỉ chủ sở hữu.
- Ứng viên đánh giá: chỉ CV của mình (đã có kiểm tra trong Phase 3).
- JD rỗng nội dung → validate, không tạo.

## 8. Kiểm thử (Vitest, TDD cho logic thuần)

- `registerSchema` chấp nhận role hợp lệ, từ chối role sai, mặc định CANDIDATE khi thiếu — TDD.
- `registerUser` truyền role vào `create` — cập nhật test hiện có (mock).
- Server action + trang: build + kiểm tra thủ công (tạo 1 tài khoản NTD + 1 ứng viên).
- Không E2E browser.

## 9. Cấu trúc file

```
Sửa:
  prisma/schema.prisma            + isPublic vào JobDescription
  lib/auth/validation.ts          + role vào registerSchema
  lib/auth/register.ts            + role vào RegisterDeps.create + registerUser
  app/api/register/route.ts       truyền role khi tạo user
  app/register/page.tsx           + chọn vai trò
  app/dashboard/page.tsx          nhận biết vai trò (NTD → JD, ứng viên → CV)
Thêm:
  lib/jobs/actions.ts             createJobDescription, deleteJobDescription
  app/jobs/new/page.tsx           form đăng JD (NTD)
  app/jobs/page.tsx               danh sách JD công khai
  app/jobs/[id]/page.tsx          chi tiết JD (server: nạp JD + CV của ứng viên)
  app/jobs/[id]/EvaluateFromJob.tsx  client: chọn CV + gọi đánh giá
```

## 10. Giao diện

- Dashboard NTD: tiêu đề "Tin tuyển dụng của bạn" + nút "Đăng JD"; mỗi JD là card (tiêu đề, công ty, ngày, nút Xóa).
- `/jobs`: lưới/danh sách card JD công khai (tiêu đề, công ty, trích đoạn).
- `/jobs/[id]`: nội dung JD + (nếu là ứng viên đã đăng nhập) chọn CV + nút "Đánh giá bằng AI".
- Dùng shadcn + tông xanh hiện có.

## 11. Thứ tự triển khai (plan sẽ chi tiết hóa)

1. Prisma: thêm `isPublic` vào JobDescription, `db push`.
2. Đăng ký có role: `registerSchema` + `registerUser` + API + form (TDD phần schema/logic).
3. Server actions JD + dashboard nhận biết vai trò + `/jobs/new`.
4. Trang `/jobs` (danh sách) + `/jobs/[id]` (chi tiết + đánh giá, tái dùng Phase 3).
